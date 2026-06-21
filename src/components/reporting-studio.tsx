"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { DateRangePicker } from "@/components/date-range-picker";
import { GlassPanel } from "@/components/glass-panel";
import { MetricTile } from "@/components/metric-tile";
import { ProcessingIndicator, ProcessingOverlay } from "@/components/processing-overlay";
import { SignUpNudge } from "@/components/sign-up-nudge";
import { StatusPill } from "@/components/status-pill";
import type {
  AccountOption,
  ReportingRunRequest,
  ReportingRunResponse,
} from "@/lib/metis/types";

type ReportingStudioProps = {
  accounts: AccountOption[];
  accessToken?: string;
  /**
   * When set, the reporting API call sends `connectionId` instead of
   * `accessToken` and the server decrypts the saved token. Used by
   * /app/reports for authed users.
   */
  connectionId?: string;
  mode?: "workspace" | "standalone" | "authed";
};

type UploadedToneFile = {
  id: string;
  name: string;
  content: string;
  charCount: number;
};

const ACCEPTED_TONE_CONTEXT_MIME_TYPES = new Set(["text/plain", "text/markdown"]);
const MAX_TONE_CONTEXT_FILE_SIZE = 1024 * 1024;
const EMPTY_METRIC_VALUE = "—";

function isAcceptedToneContextFile(file: File) {
  return (
    ACCEPTED_TONE_CONTEXT_MIME_TYPES.has(file.type) ||
    /\.(txt|md|markdown)$/i.test(file.name)
  );
}

function formatCharacterCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildToneContextValue(
  manualToneExamples: string,
  uploadedToneFiles: UploadedToneFile[],
) {
  return [manualToneExamples.trim(), ...uploadedToneFiles.map((file) => file.content.trim())]
    .filter(Boolean)
    .join("\n\n");
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatRangeLabel(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return "Pick a reporting window";
  const start = fromIsoDate(startIso);
  const end = fromIsoDate(endIso);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${SHORT_MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${SHORT_MONTHS[start.getMonth()]} ${start.getDate()} – ${SHORT_MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${SHORT_MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} – ${SHORT_MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

function defaultReportingWindow(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
}

function formatMetricValue(
  value: number | null,
  {
    style = "decimal",
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  }: {
    style?: "currency" | "percent" | "decimal";
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {},
) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  if (style === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value);
  }

  if (style === "percent") {
    return `${new Intl.NumberFormat("en-US", {
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(value)}%`;
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

type MetricViewModel = {
  kicker: string;
  value: string;
  copy: string;
};

function buildMetrics(result: ReportingRunResponse | null): MetricViewModel[] {
  if (!result) {
    return [
      { kicker: "Spend", value: EMPTY_METRIC_VALUE, copy: "Total spend across the window." },
      { kicker: "Cost per result", value: EMPTY_METRIC_VALUE, copy: "Average cost per leading result." },
      { kicker: "CTR", value: EMPTY_METRIC_VALUE, copy: "Top-line click-through rate." },
      { kicker: "CPM", value: EMPTY_METRIC_VALUE, copy: "Cost to reach one thousand impressions." },
      { kicker: "CPC", value: EMPTY_METRIC_VALUE, copy: "Average cost per click." },
    ];
  }

  const primaryResultLabel = result.snapshot.totals.primaryResult?.label ?? "Primary result";

  return [
    {
      kicker: "Spend",
      value: formatMetricValue(result.snapshot.totals.spend, {
        style: "currency",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      copy: "Total spend for the exact reporting window.",
    },
    {
      kicker: "Cost per result",
      value: formatMetricValue(result.snapshot.totals.primaryResult?.costPerResult ?? null, {
        style: "currency",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      copy: `${primaryResultLabel} is the result signal for this window.`,
    },
    {
      kicker: "CTR",
      value: formatMetricValue(result.snapshot.totals.ctr, {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
      copy: "Top-line click-through rate.",
    },
    {
      kicker: "CPM",
      value: formatMetricValue(result.snapshot.totals.cpm, {
        style: "currency",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      copy: "Cost per thousand impressions.",
    },
    {
      kicker: "CPC",
      value: formatMetricValue(result.snapshot.totals.cpc, {
        style: "currency",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      copy: "Average cost per click.",
    },
  ];
}

function buildOperatorItems(items: string[] | undefined): { id: string; text: string }[] {
  return (items ?? []).map((item, index) => ({
    id: `${index}-${item.slice(0, 24)}`,
    text: item,
  }));
}

export function ReportingStudio({
  accounts,
  accessToken,
  connectionId,
  mode = "workspace",
}: ReportingStudioProps) {
  const toneFileInputRef = useRef<HTMLInputElement | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);

  const reportingDefault =
    accounts.find((account) => account.role === "reporting-default") ?? accounts[0];
  const initialRange = useMemo(() => defaultReportingWindow(), []);

  const outputAnchorRef = useRef<HTMLDivElement | null>(null);

  const [accountId, setAccountId] = useState(reportingDefault?.id ?? "");
  const [dateStart, setDateStart] = useState(initialRange.startDate);
  const [dateEnd, setDateEnd] = useState(initialRange.endDate);
  const [manualToneExamples, setManualToneExamples] = useState("");
  const [uploadedToneFiles, setUploadedToneFiles] = useState<UploadedToneFile[]>([]);
  const [toneContextError, setToneContextError] = useState("");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [result, setResult] = useState<ReportingRunResponse | null>(null);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [isInputsCollapsed, setIsInputsCollapsed] = useState(false);
  // Temporary A/B for the operator-view demotion. User picks one in-browser,
  // then we delete the loser. Kept on this state intentionally — no cookie.
  const [outputVariant, setOutputVariant] = useState<"tabs" | "disclosure">("tabs");
  const [tabsView, setTabsView] = useState<"client" | "numbers">("client");
  const [isNumbersExpanded, setIsNumbersExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toneExamples = buildToneContextValue(manualToneExamples, uploadedToneFiles);
  const metrics = buildMetrics(result);
  const isStandalone = mode === "standalone";
  const hasManualToneExamples = manualToneExamples.trim().length > 0;
  const toneContextSourceCount =
    (hasManualToneExamples ? 1 : 0) + uploadedToneFiles.length;
  const whatChangedItems = buildOperatorItems(result?.report.whatChanged);
  const riskItems = buildOperatorItems(result?.report.risks);
  const nextActionItems = buildOperatorItems(result?.report.nextActions);

  const activeAccountLabel =
    accounts.find((account) => account.id === accountId)?.label ?? "No account selected";

  // Auto-collapse the inputs once a result lands; the user can re-open via
  // the summary chip's "Edit window" action. Also scroll the output region
  // into view so the user lands on the answer, not the form.
  useEffect(() => {
    if (!result) return;
    setIsInputsCollapsed(true);
    if (typeof window !== "undefined" && outputAnchorRef.current) {
      window.requestAnimationFrame(() => {
        outputAnchorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [result]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const ingestToneFiles = async (incoming: File[]) => {
    if (!incoming.length) return;

    const existingIds = new Set(uploadedToneFiles.map((file) => file.id));
    const nextFiles: UploadedToneFile[] = [];
    const issues: string[] = [];

    for (const file of incoming) {
      const id = `${file.name}-${file.size}-${file.lastModified}`;

      if (!isAcceptedToneContextFile(file)) {
        issues.push(`${file.name} is not a supported TXT or MD file.`);
        continue;
      }
      if (file.size > MAX_TONE_CONTEXT_FILE_SIZE) {
        issues.push(`${file.name} is larger than 1 MB.`);
        continue;
      }
      if (existingIds.has(id) || nextFiles.some((item) => item.id === id)) {
        issues.push(`${file.name} is already loaded.`);
        continue;
      }

      const content = (await file.text()).trim();
      if (!content) {
        issues.push(`${file.name} is empty.`);
        continue;
      }

      nextFiles.push({
        id,
        name: file.name,
        content,
        charCount: content.length,
      });
    }

    if (nextFiles.length) {
      setUploadedToneFiles((current) => [...current, ...nextFiles]);
    }
    setToneContextError(issues.join(" "));
  };

  const handleToneFilePickerOpen = () => {
    toneFileInputRef.current?.click();
  };

  const handleToneFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    await ingestToneFiles(selectedFiles);
  };

  const handleToneFileRemove = (fileId: string) => {
    setUploadedToneFiles((current) => current.filter((file) => file.id !== fileId));
    setToneContextError("");
  };

  const handleToneFilesClear = () => {
    setUploadedToneFiles([]);
    setToneContextError("");
  };

  const handleDropzoneDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (Array.from(event.dataTransfer.types ?? []).includes("Files")) {
      event.preventDefault();
      setIsDraggingFiles(true);
    }
  };

  const handleDropzoneDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (Array.from(event.dataTransfer.types ?? []).includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDropzoneDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDraggingFiles(false);
  };

  const handleDropzoneDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    const dropped = Array.from(event.dataTransfer.files ?? []);
    await ingestToneFiles(dropped);
  };

  const resetCopyStateSoon = () => {
    if (copyResetTimeoutRef.current) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopyState("idle");
      copyResetTimeoutRef.current = null;
    }, 1800);
  };

  const copyTextToClipboard = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!succeeded) {
      throw new Error("Copy command failed.");
    }
  };

  const handleCopyFinalMessage = async () => {
    const finalMessage = result?.finalSlackMessage?.trim();
    if (!finalMessage) return;
    try {
      await copyTextToClipboard(finalMessage);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    resetCopyStateSoon();
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCopyState("idle");

    if (!accountId) {
      setError("Select a Meta ad account before generating the report.");
      return;
    }

    const payload: ReportingRunRequest & { connectionId?: string } = {
      accountId,
      dateStart,
      dateEnd,
      toneExamples,
      // Authed callers send a connectionId (server decrypts the saved token).
      // Standalone / workspace callers send the pasted accessToken.
      ...(connectionId ? { connectionId } : { accessToken }),
    };

    startTransition(async () => {
      setError("");

      try {
        const response = await fetch("/api/metis/reporting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as ReportingRunResponse & { message?: string };

        if (!response.ok) {
          throw new Error(body.message ?? "Reporting run failed.");
        }

        setResult(body);
      } catch (runError) {
        setResult(null);
        setError(runError instanceof Error ? runError.message : "Reporting run failed.");
      }
    });
  };

  const hasResult = result !== null;
  const showCollapsedChip = isInputsCollapsed && hasResult && !isPending;

  const statusPill = error ? (
    <StatusPill label="Run failed" tone="warning" />
  ) : isPending ? (
    <StatusPill label="Running" tone="info" isActive />
  ) : result ? (
    <StatusPill label="Slack-ready" tone="success" />
  ) : (
    <StatusPill label="Ready" tone="neutral" />
  );

  return (
    <div className="reporting-studio">
      {showCollapsedChip ? (
        <div className="reporting-studio-summary-chip" role="region" aria-label="Current reporting window">
          <div className="reporting-studio-summary-text">
            <span className="reporting-studio-summary-account">{activeAccountLabel}</span>
            <span className="reporting-studio-summary-dot" aria-hidden="true">·</span>
            <span className="reporting-studio-summary-range">
              {formatRangeLabel(dateStart, dateEnd)}
            </span>
            <span className="reporting-studio-summary-dot" aria-hidden="true">·</span>
            <span className="reporting-studio-summary-sources">
              {toneContextSourceCount} tone source{toneContextSourceCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="reporting-studio-summary-actions">
            {statusPill}
            <button
              type="button"
              className="reporting-studio-summary-edit"
              onClick={() => setIsInputsCollapsed(false)}
            >
              Edit window
            </button>
          </div>
        </div>
      ) : (
        <GlassPanel
          className="reporting-studio-hero"
          eyebrow="Reporting window"
          title="Set up the report"
          actions={statusPill}
          busy={isPending}
          overlay={
            isPending ? (
              <ProcessingOverlay
                eyebrow="Generating report"
                title="Building the summary"
                description="Metis is pulling Meta insights, writing the factual read, and shaping the client-style update."
                steps={[
                  "Pull campaign insights",
                  "Build factual summary",
                  "Shape client-style update",
                ]}
              />
            ) : null
          }
        >
          <form className="reporting-studio-form" onSubmit={handleSubmit}>
            <div className="reporting-studio-controls">
              <div className="product-field reporting-studio-field reporting-studio-field--account">
                <label className="product-label" htmlFor="reporting-account">
                  Account
                </label>
                <div className="product-select-wrap">
                  <select
                    id="reporting-account"
                    className="product-select"
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                  <span className="product-select-indicator" aria-hidden="true" />
                </div>
              </div>

              <div className="product-field reporting-studio-field reporting-studio-field--range">
                <label className="product-label" htmlFor="reporting-date-range">
                  Reporting window
                </label>
                <DateRangePicker
                  id="reporting-date-range"
                  value={{ startDate: dateStart, endDate: dateEnd }}
                  onChange={(next) => {
                    setDateStart(next.startDate);
                    setDateEnd(next.endDate);
                  }}
                />
              </div>
            </div>

            <div className="product-field reporting-studio-tone">
              <div className="reporting-studio-tone-header">
                <label className="product-label" htmlFor="reporting-tone-text">
                  How you usually write updates
                </label>
                <span className="reporting-studio-tone-meta">
                  {toneContextSourceCount === 0
                    ? "Optional"
                    : `${toneContextSourceCount} source${toneContextSourceCount === 1 ? "" : "s"} ready`}
                </span>
              </div>

              <div
                className="reporting-studio-tone-dropzone"
                data-dragging={isDraggingFiles ? "true" : undefined}
                onDragEnter={handleDropzoneDragEnter}
                onDragOver={handleDropzoneDragOver}
                onDragLeave={handleDropzoneDragLeave}
                onDrop={handleDropzoneDrop}
              >
                {uploadedToneFiles.length ? (
                  <div className="reporting-studio-tone-chips" aria-live="polite">
                    {uploadedToneFiles.map((file) => (
                      <span key={file.id} className="reporting-studio-tone-chip">
                        <span className="reporting-studio-tone-chip-name">{file.name}</span>
                        <span className="reporting-studio-tone-chip-meta">
                          {formatCharacterCount(file.charCount)} chars
                        </span>
                        <button
                          type="button"
                          className="reporting-studio-tone-chip-remove"
                          onClick={() => handleToneFileRemove(file.id)}
                          aria-label={`Remove ${file.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                <textarea
                  id="reporting-tone-text"
                  className="reporting-studio-tone-text"
                  placeholder="Paste a past client update, or drag a TXT/MD file in. The numbers stay grounded — only the writing style is borrowed."
                  value={manualToneExamples}
                  onChange={(event) => setManualToneExamples(event.target.value)}
                />

                <div className="reporting-studio-tone-footer">
                  <button
                    type="button"
                    className="reporting-studio-tone-add"
                    onClick={handleToneFilePickerOpen}
                  >
                    + Add TXT or MD
                  </button>
                  {uploadedToneFiles.length ? (
                    <button
                      type="button"
                      className="reporting-studio-tone-clear"
                      onClick={handleToneFilesClear}
                    >
                      Clear files
                    </button>
                  ) : (
                    <span className="reporting-studio-tone-hint">or drag a file in</span>
                  )}
                </div>

                <input
                  ref={toneFileInputRef}
                  id="reporting-tone-upload"
                  className="reporting-context-file-input"
                  type="file"
                  accept=".txt,.md,.markdown,text/plain,text/markdown"
                  multiple
                  onChange={handleToneFileSelect}
                />
              </div>

              {toneContextError ? (
                <div className="product-warning">{toneContextError}</div>
              ) : null}
            </div>

            <button
              type="submit"
              className="reporting-studio-submit product-button"
              data-loading={isPending ? "true" : undefined}
              disabled={isPending || !accounts.length}
            >
              {isPending ? (
                <>
                  <ProcessingIndicator mode="inline" />
                  Generating report…
                </>
              ) : (
                "Generate report"
              )}
            </button>
          </form>
        </GlassPanel>
      )}

      {error ? <div className="product-warning">{error}</div> : null}
      {result?.toneRewriteBlocked ? (
        <div className="product-warning">
          The tone rewrite fell back to the factual Slack message: {result.toneRewriteBlocked}
        </div>
      ) : null}

      <div
        ref={outputAnchorRef}
        className="reporting-studio-output"
        data-processing={isPending ? "true" : undefined}
      >
        <div
          className="reporting-studio-variant-switch"
          role="group"
          aria-label="Output layout (temporary A/B)"
        >
          <span className="reporting-studio-variant-label">Output style</span>
          <button
            type="button"
            className="reporting-studio-variant-button"
            data-active={outputVariant === "tabs" ? "true" : undefined}
            onClick={() => setOutputVariant("tabs")}
            aria-pressed={outputVariant === "tabs"}
          >
            Tabs
          </button>
          <button
            type="button"
            className="reporting-studio-variant-button"
            data-active={outputVariant === "disclosure" ? "true" : undefined}
            onClick={() => setOutputVariant("disclosure")}
            aria-pressed={outputVariant === "disclosure"}
          >
            Inline disclosure
          </button>
        </div>

        {outputVariant === "tabs" ? (
          <GlassPanel className="reporting-studio-output-panel">
            <div className="reporting-studio-tabs" role="tablist" aria-label="Output view">
              <button
                type="button"
                role="tab"
                aria-selected={tabsView === "client"}
                className="reporting-studio-tab"
                data-active={tabsView === "client" ? "true" : undefined}
                onClick={() => setTabsView("client")}
              >
                Client message
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tabsView === "numbers"}
                className="reporting-studio-tab"
                data-active={tabsView === "numbers" ? "true" : undefined}
                onClick={() => setTabsView("numbers")}
              >
                View the numbers
              </button>
            </div>

            {tabsView === "client" ? (
              <ClientMessageCard
                finalMessage={result?.finalSlackMessage ?? null}
                runNotes={
                  hasResult && result
                    ? `Prepared from ${result.snapshot.rowCount} reporting rows across ${result.snapshot.dateRange.label}.`
                    : null
                }
                copyState={copyState}
                onCopy={handleCopyFinalMessage}
              />
            ) : (
              <NumbersView
                metrics={metrics}
                hasResult={hasResult}
                executiveSummary={result?.report.executiveSummary ?? null}
                whatChangedItems={whatChangedItems}
                riskItems={riskItems}
                nextActionItems={nextActionItems}
              />
            )}
          </GlassPanel>
        ) : (
          <>
            <GlassPanel className="reporting-studio-output-panel">
              <ClientMessageCard
                finalMessage={result?.finalSlackMessage ?? null}
                runNotes={
                  hasResult && result
                    ? `Prepared from ${result.snapshot.rowCount} reporting rows across ${result.snapshot.dateRange.label}.`
                    : null
                }
                copyState={copyState}
                onCopy={handleCopyFinalMessage}
              />
            </GlassPanel>

            <div className="reporting-studio-disclosure">
              <button
                type="button"
                className="reporting-studio-disclosure-toggle"
                onClick={() => setIsNumbersExpanded((prev) => !prev)}
                aria-expanded={isNumbersExpanded}
                aria-controls="reporting-studio-numbers"
              >
                <span>{isNumbersExpanded ? "Hide the numbers" : "View the numbers"}</span>
                <span
                  className="reporting-studio-disclosure-chevron"
                  data-open={isNumbersExpanded ? "true" : undefined}
                  aria-hidden="true"
                />
              </button>
              {isNumbersExpanded ? (
                <div id="reporting-studio-numbers" className="reporting-studio-disclosure-body">
                  <NumbersView
                    metrics={metrics}
                    hasResult={hasResult}
                    executiveSummary={result?.report.executiveSummary ?? null}
                    whatChangedItems={whatChangedItems}
                    riskItems={riskItems}
                    nextActionItems={nextActionItems}
                  />
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {isStandalone && result ? <SignUpNudge /> : null}
    </div>
  );
}

type ClientMessageCardProps = {
  finalMessage: string | null;
  runNotes: string | null;
  copyState: "idle" | "copied" | "failed";
  onCopy: () => void;
};

function ClientMessageCard({ finalMessage, runNotes, copyState, onCopy }: ClientMessageCardProps) {
  return (
    <article className="reporting-studio-message-card">
      <div className="reporting-studio-copy-dock">
        <button
          type="button"
          className="reporting-studio-copy-action"
          data-state={copyState}
          onClick={onCopy}
          disabled={!finalMessage}
          aria-label={
            copyState === "copied"
              ? "Final message copied"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy final message"
          }
        >
          <span className="reporting-studio-copy-action-icon" aria-hidden="true" />
        </button>
      </div>
      <div className="reporting-studio-message-head">
        <span className="product-eyebrow">Send-ready</span>
        <strong>Client-style message</strong>
      </div>
      {finalMessage ? (
        <p className="reporting-studio-message">{finalMessage}</p>
      ) : (
        <p className="reporting-studio-empty-note">
          The send-ready client update appears here after the first run.
        </p>
      )}
      {runNotes ? <p className="reporting-studio-run-notes">{runNotes}</p> : null}
    </article>
  );
}

type NumbersViewProps = {
  metrics: MetricViewModel[];
  hasResult: boolean;
  executiveSummary: string | null;
  whatChangedItems: { id: string; text: string }[];
  riskItems: { id: string; text: string }[];
  nextActionItems: { id: string; text: string }[];
};

function NumbersView({
  metrics,
  hasResult,
  executiveSummary,
  whatChangedItems,
  riskItems,
  nextActionItems,
}: NumbersViewProps) {
  return (
    <div className="reporting-studio-numbers">
      <div className="metric-grid reporting-studio-metric-grid">
        {metrics.map((metric) => (
          <MetricTile key={metric.kicker} {...metric} />
        ))}
      </div>

      {hasResult ? (
        <div className="product-list">
          {executiveSummary ? (
            <article className="product-list-item">
              <strong>Executive read</strong>
              <p className="product-help">{executiveSummary}</p>
            </article>
          ) : null}
          {whatChangedItems.length ? (
            <article className="product-list-item">
              <strong>What changed</strong>
              <ul className="reporting-studio-bullet-list">
                {whatChangedItems.map((item) => (
                  <li key={item.id} className="reporting-studio-bullet-item">
                    {item.text}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
          {riskItems.length ? (
            <article className="product-list-item">
              <strong>Risks</strong>
              <ul className="reporting-studio-bullet-list">
                {riskItems.map((item) => (
                  <li key={item.id} className="reporting-studio-bullet-item">
                    {item.text}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
          {nextActionItems.length ? (
            <article className="product-list-item">
              <strong>Next actions</strong>
              <ul className="reporting-studio-bullet-list">
                {nextActionItems.map((item) => (
                  <li key={item.id} className="reporting-studio-bullet-item">
                    {item.text}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
        </div>
      ) : (
        <p className="reporting-studio-empty-note">
          Run a report to see the factual read.
        </p>
      )}
    </div>
  );
}

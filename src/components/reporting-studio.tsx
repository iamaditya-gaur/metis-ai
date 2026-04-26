"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { GlassPanel } from "@/components/glass-panel";
import { MetricTile } from "@/components/metric-tile";
import { ProcessingIndicator, ProcessingOverlay } from "@/components/processing-overlay";
import { StatusPill } from "@/components/status-pill";
import type { AccountOption, ReportingRunRequest, ReportingRunResponse } from "@/lib/metis/types";

type ReportingStudioProps = {
  accounts: AccountOption[];
  accessToken?: string;
  mode?: "workspace" | "standalone";
};

type UploadedToneFile = {
  id: string;
  name: string;
  content: string;
  charCount: number;
};

const ACCEPTED_TONE_CONTEXT_MIME_TYPES = new Set(["text/plain", "text/markdown"]);
const MAX_TONE_CONTEXT_FILE_SIZE = 1024 * 1024;

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

function buildOperatorItems(items: string[] | undefined, fallback: string[]) {
  return (items?.length ? items : fallback).map((item, index) => ({
    id: `${index}-${item.slice(0, 24)}`,
    text: item,
  }));
}

function buildMetrics(result: ReportingRunResponse | null) {
  if (!result) {
    return [
      {
        kicker: "Spend",
        value: "$4,243.77",
        copy: "Total spend across the reporting window.",
      },
      {
        kicker: "Cost per result",
        value: "$22.58",
        copy: "Average cost based on the leading result signal in the run.",
      },
      {
        kicker: "CTR",
        value: "2.4%",
        copy: "Top-line click-through signal for creative and audience fit.",
      },
      {
        kicker: "CPM",
        value: "$13.23",
        copy: "Cost to reach one thousand impressions.",
      },
      {
        kicker: "CPC",
        value: "$0.55",
        copy: "Average cost per click for the selected window.",
      },
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
      copy: "Total spend for the exact reporting window shown above.",
    },
    {
      kicker: "Cost per result",
      value: formatMetricValue(result.snapshot.totals.primaryResult?.costPerResult ?? null, {
        style: "currency",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      copy: `${primaryResultLabel} is used as the current result signal for this reporting window.`,
    },
    {
      kicker: "CTR",
      value: formatMetricValue(result.snapshot.totals.ctr, {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
      copy: "Top-line click-through signal for message and audience resonance.",
    },
    {
      kicker: "CPM",
      value: formatMetricValue(result.snapshot.totals.cpm, {
        style: "currency",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      copy: "Cost to generate one thousand impressions across the selected window.",
    },
    {
      kicker: "CPC",
      value: formatMetricValue(result.snapshot.totals.cpc, {
        style: "currency",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      copy: "Average click cost before translating performance into client-ready language.",
    },
  ];
}

export function ReportingStudio({
  accounts,
  accessToken,
  mode = "workspace",
}: ReportingStudioProps) {
  const toneFileInputRef = useRef<HTMLInputElement | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const reportingDefault =
    accounts.find((account) => account.role === "reporting-default") ?? accounts[0];
  const [accountId, setAccountId] = useState(reportingDefault?.id ?? "");
  const [dateStart, setDateStart] = useState("2026-04-18");
  const [dateEnd, setDateEnd] = useState("2026-04-24");
  const [manualToneExamples, setManualToneExamples] = useState(
    "Quick update from my side: spend held steady, CTR improved, but I want to keep an eye on frequency.\n\nMain takeaway is that creative B is still the cleanest winner.",
  );
  const [uploadedToneFiles, setUploadedToneFiles] = useState<UploadedToneFile[]>([]);
  const [toneContextError, setToneContextError] = useState("");
  const [result, setResult] = useState<ReportingRunResponse | null>(null);
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [isPending, startTransition] = useTransition();

  const toneExamples = buildToneContextValue(manualToneExamples, uploadedToneFiles);
  const metrics = buildMetrics(result);
  const isStandalone = mode === "standalone";
  const hasManualToneExamples = manualToneExamples.trim().length > 0;
  const toneContextSourceCount =
    (hasManualToneExamples ? 1 : 0) + uploadedToneFiles.length;
  const whatChangedItems = buildOperatorItems(result?.report.whatChanged, [
    "Spend held in a healthy range while click volume remained solid across the selected window.",
    "Campaign performance was uneven enough that the next read should focus on where efficiency concentrated.",
  ]);
  const riskItems = buildOperatorItems(result?.report.risks, [
    "Frequency is worth watching if the current delivery mix stays unchanged.",
    "Performance concentration across a small number of campaigns could become a dependency risk.",
  ]);
  const nextActionItems = buildOperatorItems(result?.report.nextActions, [
    "Check whether the strongest campaign can absorb more budget without weakening efficiency.",
    "Review the next window for early signs of cost pressure or repeat-delivery fatigue.",
  ]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const handleToneFilePickerOpen = () => {
    toneFileInputRef.current?.click();
  };

  const handleToneFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);

    event.target.value = "";

    if (!selectedFiles.length) {
      return;
    }

    const existingIds = new Set(uploadedToneFiles.map((file) => file.id));
    const nextFiles: UploadedToneFile[] = [];
    const issues: string[] = [];

    for (const file of selectedFiles) {
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

    setUploadedToneFiles((current) => [...current, ...nextFiles]);
    setToneContextError(issues.join(" "));
  };

  const handleToneFileRemove = (fileId: string) => {
    setUploadedToneFiles((current) => current.filter((file) => file.id !== fileId));
    setToneContextError("");
  };

  const handleToneFilesClear = () => {
    setUploadedToneFiles([]);
    setToneContextError("");
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

    if (!finalMessage) {
      return;
    }

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

    const payload: ReportingRunRequest = {
      accountId,
      dateStart,
      dateEnd,
      toneExamples,
      accessToken,
    };

    startTransition(async () => {
      setError("");

      try {
        const response = await fetch("/api/metis/reporting", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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

  return (
    <div className="reporting-studio">
      <GlassPanel
        className="reporting-studio-hero"
        eyebrow={isStandalone ? "AI Reporting Desk" : "Reporting Desk"}
        title={
          isStandalone
            ? "Generate the factual report first, then shape the final summary to sound like you"
            : "Run one reporting window, then review the operator and client views in parallel"
        }
        description={
          isStandalone
            ? "Choose the Meta ad account, define the reporting window, and paste past client or team updates if you want the final message to mirror your usual structure, phrasing, and reporting style. Metis keeps the factual read separate so the numbers stay grounded."
            : "This surface keeps the control layer compact at the top so the operator can set the account, date range, and optional tone context once, then scan the outputs below without context switching."
        }
        actions={
          error ? (
            <StatusPill label="Run failed" tone="warning" />
          ) : isPending ? (
            <StatusPill label="Running" tone="info" isActive />
          ) : result ? (
            <StatusPill label="Slack-ready" tone="success" />
          ) : (
            <StatusPill label="Ready" tone="neutral" />
          )
        }
        busy={isPending}
        overlay={
          isPending ? (
            <ProcessingOverlay
              eyebrow="Generating Report"
              title="Building the next reporting summary"
              description="Metis is pulling Meta insights, writing the factual performance read, and shaping the final message to match your past reporting style."
              steps={[
                "Pull campaign insights",
                "Build factual summary",
                "Shape final client-style update",
              ]}
            />
          ) : null
        }
      >
        <form className="reporting-studio-form" onSubmit={handleSubmit}>
          <div className="reporting-studio-strip">
            <div className="product-field reporting-studio-field-card">
              <label className="product-label" htmlFor="reporting-new-account">
                Meta ad account
              </label>
              <div className="product-select-wrap">
                <select
                  id="reporting-new-account"
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
              <p className="product-help">
                Choose the ad account whose delivery and spend should drive this reporting run.
              </p>
            </div>

            <div className="product-field reporting-studio-field-card">
              <label className="product-label" htmlFor="reporting-new-date-start">
                Start date
              </label>
              <input
                id="reporting-new-date-start"
                className="product-input"
                type="date"
                value={dateStart}
                onChange={(event) => setDateStart(event.target.value)}
              />
              <p className="product-help">
                Set the first day that should be included in the AI-generated summary.
              </p>
            </div>

            <div className="product-field reporting-studio-field-card">
              <label className="product-label" htmlFor="reporting-new-date-end">
                End date
              </label>
              <input
                id="reporting-new-date-end"
                className="product-input"
                type="date"
                value={dateEnd}
                onChange={(event) => setDateEnd(event.target.value)}
              />
              <p className="product-help">
                Set the last day of the reporting window so totals, trends, and commentary stay aligned.
              </p>
            </div>
          </div>

          <div className="reporting-studio-context-row">
            <div className="product-field reporting-studio-context-card">
              <label className="product-label" htmlFor="reporting-new-tone-examples">
                Past client or team updates
              </label>
              <div className="reporting-studio-context-tools">
                <div className="reporting-studio-context-toolbar">
                  <button
                    type="button"
                    className="product-button reporting-context-upload-button"
                    data-variant="secondary"
                    onClick={handleToneFilePickerOpen}
                  >
                    Upload TXT or MD
                  </button>
                  <input
                    ref={toneFileInputRef}
                    id="reporting-tone-upload"
                    className="reporting-context-file-input"
                    type="file"
                    accept=".txt,.md,.markdown,text/plain,text/markdown"
                    multiple
                    onChange={handleToneFileSelect}
                  />
                  {uploadedToneFiles.length ? (
                    <button
                      type="button"
                      className="reporting-context-clear-button"
                      onClick={handleToneFilesClear}
                    >
                      Clear uploads
                    </button>
                  ) : null}
                </div>
                <div className="reporting-studio-context-source-bar">
                  <span className="reporting-studio-context-source-label">
                    Context sources
                  </span>
                  <span className="reporting-studio-context-source-value">
                    {toneContextSourceCount} source{toneContextSourceCount === 1 ? "" : "s"} ready
                  </span>
                </div>
              </div>
              {uploadedToneFiles.length ? (
                <div className="reporting-context-upload-list" aria-live="polite">
                  {uploadedToneFiles.map((file) => (
                    <article key={file.id} className="reporting-context-upload-chip">
                      <div className="reporting-context-upload-copy">
                        <strong>{file.name}</strong>
                        <span>{formatCharacterCount(file.charCount)} chars</span>
                      </div>
                      <button
                        type="button"
                        className="reporting-context-remove-button"
                        onClick={() => handleToneFileRemove(file.id)}
                        aria-label={`Remove ${file.name}`}
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}
              {toneContextError ? <div className="product-warning">{toneContextError}</div> : null}
              <textarea
                id="reporting-new-tone-examples"
                className="product-textarea reporting-studio-context"
                value={manualToneExamples}
                onChange={(event) => setManualToneExamples(event.target.value)}
              />
              <p className="product-help">
                Optional. Paste earlier summaries, client updates, or team reports here, or upload
                TXT and MD files above. Metis combines both sources into the same style context for
                the final message.
              </p>
            </div>

            <div className="reporting-studio-cta">
              <div className="reporting-studio-cta-copy">
                <p className="product-label">Generate outputs</p>
                <p className="product-help">
                  Metis produces the factual performance summary first, then writes the final
                  client-facing message using the pasted or uploaded examples you provide. Your
                  past messages influence style and structure only, not the underlying facts.
                </p>
              </div>
              <button
                type="submit"
                className="product-button"
                data-loading={isPending ? "true" : undefined}
                disabled={isPending || !accounts.length}
              >
                {isPending ? (
                  <>
                    <ProcessingIndicator mode="inline" />
                    Generating report...
                  </>
                ) : (
                  "Generate AI summary"
                )}
              </button>
            </div>
          </div>
        </form>
      </GlassPanel>

      {error ? <div className="product-warning">{error}</div> : null}
      {result?.toneRewriteBlocked ? (
        <div className="product-warning">
          The tone rewrite fell back to the factual Slack message: {result.toneRewriteBlocked}
        </div>
      ) : null}

      <div className="reporting-studio-panels" data-processing={isPending ? "true" : undefined}>
        <GlassPanel
          className="reporting-studio-panel reporting-studio-panel--metrics"
          eyebrow="Performance"
          title="Core metrics"
          description="Start with the top-line numbers so the factual read and the client-ready message are anchored to the same delivery signals."
        >
          <div className="metric-grid reporting-studio-metric-grid">
            {metrics.map((metric) => (
              <MetricTile key={metric.kicker} {...metric} />
            ))}
          </div>
        </GlassPanel>

        <GlassPanel
          className="reporting-studio-panel"
          eyebrow="Operator View"
          title="Factual summary"
          description="This section stays grounded in the reporting data and explains what changed before any client-style rewriting happens."
        >
          <div className="product-list">
            <article className="product-list-item">
              <strong>Executive read</strong>
              <p className="product-help">
                {result?.report.executiveSummary ??
                  "For 2026-04-18 to 2026-04-24, spend reached 4,243.77 on 320,745 impressions and 7,695 clicks. Overall delivery remained healthy, with meaningful variance across campaigns and rising frequency worth watching."}
              </p>
            </article>
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
          </div>
        </GlassPanel>

        <GlassPanel
          className="reporting-studio-panel"
          eyebrow="Client View"
          title="Client-style message"
          description="This is the final send-ready update. If past messages were supplied, Metis uses them to make the summary sound much closer to how you have historically reported performance."
        >
          <div className="product-list">
            <article className="product-list-item reporting-studio-message-card">
              <div className="reporting-studio-copy-dock">
                <button
                  type="button"
                  className="reporting-studio-copy-action"
                  data-state={copyState}
                  onClick={handleCopyFinalMessage}
                  disabled={!result?.finalSlackMessage}
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
                <strong>Final message</strong>
              </div>
              <p className="reporting-studio-message">
                {result?.finalSlackMessage ??
                  "Quick update from my side: spend held in a solid place and click volume stayed strong. Main thing I want to watch next is frequency, since that is where pressure could start to show if we leave the current mix untouched."}
              </p>
            </article>
            <article className="product-list-item">
              <strong>Run notes</strong>
              <p className="product-help">
                {result
                  ? `Prepared from ${result.snapshot.rowCount} reporting rows across ${result.snapshot.dateRange.label}.`
                  : "Once the run completes, this section will show the final client-ready update for the selected reporting window."}
              </p>
            </article>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

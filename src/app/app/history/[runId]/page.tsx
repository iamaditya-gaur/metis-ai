import { AppShell } from "@/components/app-shell";
import { GlassPanel } from "@/components/glass-panel";
import { HistoryCopyButton } from "@/components/history-copy-button";
import { MetricTile } from "@/components/metric-tile";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";

type RunDetail = {
  run_id: string;
  flow_type: string | null;
  status: string | null;
  env: string | null;
  selected_account_id: string | null;
  model: string | null;
  summary: string | null;
  started_at: string;
  finished_at: string | null;
  total_prompt_tokens: number | null;
  total_completion_tokens: number | null;
  total_tokens: number | null;
  total_cost_usd: number | null;
  total_latency_ms: number | null;
  llm_calls: unknown;
  tool_calls: unknown;
  artifacts: unknown;
};

type ReportArtifact = {
  kind?: string;
  report?: {
    slackMessage?: string | null;
    [key: string]: unknown;
  };
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return value;
  return ts.toLocaleString();
}

function formatNumber(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

function extractClientMessage(artifacts: unknown): string | null {
  if (!Array.isArray(artifacts)) return null;
  for (const entry of artifacts as ReportArtifact[]) {
    if (entry && entry.kind === "report") {
      const message = entry.report?.slackMessage;
      if (typeof message === "string" && message.trim().length > 0) {
        return message.trim();
      }
    }
  }
  return null;
}

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("metis_runs")
    .select(
      "run_id, flow_type, status, env, selected_account_id, model, summary, started_at, finished_at, total_prompt_tokens, total_completion_tokens, total_tokens, total_cost_usd, total_latency_ms, llm_calls, tool_calls, artifacts",
    )
    .eq("run_id", runId)
    .maybeSingle();

  const run = data as RunDetail | null;

  if (!run) {
    return (
      <AppShell
        eyebrow="History"
        title="Run not found"
        description="This run either does not exist or belongs to a different account."
        backHref="/app/history"
        backLabel="History"
      >
        <GlassPanel eyebrow="Missing" title="Nothing to show">
          <p className="history-detail-empty">
            The run you&apos;re looking for isn&apos;t in your history.
          </p>
        </GlassPanel>
      </AppShell>
    );
  }

  const clientMessage = extractClientMessage(run.artifacts);

  return (
    <AppShell
      eyebrow="History"
      title="Report detail"
      description={`Run ${run.run_id} · ${formatDate(run.started_at)}`}
      backHref="/app/history"
      backLabel="History"
    >
      <div className="history-detail">
        <GlassPanel
          className="history-detail-message"
          eyebrow="Send-ready"
          title="Client-style message"
          actions={
            <StatusPill
              label={run.status ?? "unknown"}
              tone={run.status === "success" ? "success" : "warning"}
            />
          }
        >
          {clientMessage ? (
            <>
              <p className="history-detail-message-body">{clientMessage}</p>
              <div className="history-detail-message-foot">
                <HistoryCopyButton value={clientMessage} label="Copy message" />
              </div>
            </>
          ) : (
            <p className="history-detail-empty">
              No client-style message was recorded for this run.
            </p>
          )}
        </GlassPanel>

        <GlassPanel
          className="history-detail-summary-panel"
          eyebrow="Operator view"
          title="Executive read"
        >
          <p className="history-detail-summary">
            {run.summary ?? "(no executive summary was captured)"}
          </p>
        </GlassPanel>

        <div className="history-detail-metrics">
          <MetricTile
            kicker="Cost"
            value={run.total_cost_usd != null ? `$${run.total_cost_usd.toFixed(4)}` : "—"}
            copy="Total OpenRouter spend on this run."
          />
          <MetricTile
            kicker="Tokens"
            value={formatNumber(run.total_tokens)}
            copy={`Prompt ${formatNumber(run.total_prompt_tokens)} · Completion ${formatNumber(run.total_completion_tokens)}`}
          />
          <MetricTile
            kicker="Latency"
            value={run.total_latency_ms != null ? `${run.total_latency_ms} ms` : "—"}
            copy="End-to-end LLM time for the run."
          />
          <MetricTile
            kicker="Model"
            value={run.model ?? "—"}
            copy={run.env ? `Env: ${run.env}` : ""}
          />
        </div>

        <GlassPanel eyebrow="Details" title="LLM calls">
          <details className="history-detail-block">
            <summary>Expand JSON</summary>
            <pre className="history-detail-pre">
              {JSON.stringify(run.llm_calls ?? [], null, 2)}
            </pre>
          </details>
        </GlassPanel>

        <GlassPanel eyebrow="Details" title="Tool invocations">
          <details className="history-detail-block">
            <summary>Expand JSON</summary>
            <pre className="history-detail-pre">
              {JSON.stringify(run.tool_calls ?? [], null, 2)}
            </pre>
          </details>
        </GlassPanel>
      </div>
    </AppShell>
  );
}

import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { GlassPanel } from "@/components/glass-panel";
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
        description="This run either doesn't exist or belongs to a different account."
      >
        <GlassPanel eyebrow="Missing" title="Nothing to show">
          <Link href="/app/history" className="product-button" data-variant="secondary">
            Back to history
          </Link>
        </GlassPanel>
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow="History"
      title="Report detail"
      description={`Run ${run.run_id} · ${formatDate(run.started_at)}`}
    >
      <div className="history-detail">
        <GlassPanel
          eyebrow="Summary"
          title="Executive read"
          actions={
            <StatusPill
              label={run.status ?? "unknown"}
              tone={run.status === "success" ? "success" : "warning"}
            />
          }
        >
          <p className="history-detail-summary">{run.summary ?? "(no summary)"}</p>
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

        <GlassPanel eyebrow="LLM calls" title="Per-call detail">
          <details className="history-detail-block">
            <summary>Expand JSON</summary>
            <pre className="history-detail-pre">
              {JSON.stringify(run.llm_calls ?? [], null, 2)}
            </pre>
          </details>
        </GlassPanel>

        <GlassPanel eyebrow="Tools" title="Tool invocations">
          <details className="history-detail-block">
            <summary>Expand JSON</summary>
            <pre className="history-detail-pre">
              {JSON.stringify(run.tool_calls ?? [], null, 2)}
            </pre>
          </details>
        </GlassPanel>

        <div className="history-detail-actions">
          <Link href="/app/history" className="product-button" data-variant="secondary">
            Back to history
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

import { EmptyState } from "@/components/empty-state";
import { GlassPanel } from "@/components/glass-panel";
import { StatusPill } from "@/components/status-pill";
import type { RunDetailRecord } from "@/lib/metis/types";

type RunDetailProps = {
  run: RunDetailRecord | null;
};

export function RunDetail({ run }: RunDetailProps) {
  if (!run) {
    return (
      <GlassPanel eyebrow="Run Detail" title="Run not found">
        <EmptyState
          title="This run does not exist in the local log"
          copy="Check the run ID or execute a new workflow from reporting or builder to create fresh observability entries."
        />
      </GlassPanel>
    );
  }

  return (
    <div className="product-detail-grid">
      <GlassPanel
        eyebrow="Run Detail"
        title={run.runId}
        description="The detail view should expose final output, steps, and tool calls without collapsing into raw JSON everywhere."
        actions={<StatusPill label={run.status} tone={run.statusTone} />}
      >
        <div className="product-grid product-grid--two">
          <article className="product-list-item">
            <p className="product-label">Flow</p>
            <strong>{run.flowType === "builder" ? "Builder" : "Reporting"}</strong>
          </article>
          <article className="product-list-item">
            <p className="product-label">Selected account</p>
            <strong>{run.accountLabel}</strong>
          </article>
          <article className="product-list-item">
            <p className="product-label">Started</p>
            <strong>{new Date(run.startedAt).toLocaleString()}</strong>
          </article>
          <article className="product-list-item">
            <p className="product-label">Model</p>
            <strong>{run.model ?? "n/a"}</strong>
          </article>
        </div>
      </GlassPanel>

      <GlassPanel eyebrow="Steps" title="Agent and tool sequence">
        {run.agentSteps.length ? (
          <div className="product-list">
            {run.agentSteps.map((step, index) => (
              <article key={`${run.runId}-step-${index + 1}`} className="product-list-item">
                <strong>{index + 1}. {(step as { step?: string }).step ?? "Step"}</strong>
                <pre className="product-code">{JSON.stringify(step, null, 2)}</pre>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No step data captured"
            copy="Future runs should capture step-by-step handoffs here."
          />
        )}
      </GlassPanel>

      <GlassPanel eyebrow="Tool Calls" title="Sanitized tool call preview">
        <pre className="product-code">{JSON.stringify(run.toolCalls, null, 2)}</pre>
      </GlassPanel>

      <GlassPanel eyebrow="Artifacts" title="Sanitized artifact preview">
        <pre className="product-code">{JSON.stringify(run.artifacts, null, 2)}</pre>
      </GlassPanel>
    </div>
  );
}

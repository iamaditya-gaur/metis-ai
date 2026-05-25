import { LlmCallPanel } from "@/components/observability/llm-call-panel";
import type { LlmCallDetail, RunDetailFull } from "@/lib/observability/queries";

type Props = {
  run: RunDetailFull;
};

type AgentStepRecord = {
  step: string;
  status: string;
  [key: string]: unknown;
};

function formatLatency(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(usd: number | null): string {
  if (usd === null || usd === undefined) return "—";
  if (usd < 0.0001) return `<$0.0001`;
  return `$${usd.toFixed(4)}`;
}

function stepBadge(status: string): string {
  switch (status) {
    case "success":
      return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30";
    case "skipped":
      return "bg-zinc-500/10 text-zinc-300 border border-zinc-500/30";
    case "fallback":
    case "permission-denied":
      return "bg-amber-500/10 text-amber-300 border border-amber-500/30";
    case "error":
    case "fail":
    case "failed":
      return "bg-red-500/10 text-red-300 border border-red-500/30";
    default:
      return "bg-zinc-500/10 text-zinc-300 border border-zinc-500/30";
  }
}

export function TraceTree({ run }: Props) {
  const agentSteps = (run.agentSteps as AgentStepRecord[]) ?? [];
  const llmCallsByStep = new Map<string, LlmCallDetail>();
  for (const call of run.llmCalls) {
    llmCallsByStep.set(call.step, call);
  }

  const startedAt = new Date(run.startedAt);
  const finishedAt = run.finishedAt ? new Date(run.finishedAt) : null;
  const wallMs = finishedAt ? finishedAt.getTime() - startedAt.getTime() : null;

  return (
    <div className="space-y-6">
      {/* Header / aggregates */}
      <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">Run</div>
            <h2 className="mt-0.5 font-mono text-base text-white">{run.runId}</h2>
            <p className="mt-2 text-sm text-zinc-300">
              {run.summary ?? "No executive summary captured for this run."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span
                className={`rounded-md px-2 py-0.5 font-medium ${stepBadge(run.status)}`}
              >
                {run.status}
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5">
                env: <strong className="text-zinc-200">{run.env}</strong>
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5">
                {run.flowType}
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5">
                {run.accountLabel}
              </span>
              {run.userId ? (
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5">
                  user: <strong className="text-zinc-200">{run.userId}</strong>
                </span>
              ) : (
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-zinc-500">
                  pre-auth run
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right">
            <Aggregate label="Total cost" value={formatCost(run.totals.costUsd)} />
            <Aggregate
              label="LLM latency"
              value={formatLatency(run.totals.latencyMs)}
            />
            <Aggregate label="Tokens" value={(run.totals.totalTokens ?? 0).toLocaleString()} />
            <Aggregate
              label="Wall clock"
              value={wallMs !== null ? formatLatency(wallMs) : "—"}
            />
          </div>
        </div>
      </div>

      {/* Step-by-step trace */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Pipeline
        </h3>
        <ol className="relative space-y-3 border-l border-white/10 pl-6">
          {agentSteps.map((step, idx) => {
            const call = llmCallsByStep.get(step.step);
            const errorMessage =
              typeof step.errorMessage === "string" ? step.errorMessage : null;
            const blocked = typeof step.blocked === "string" ? step.blocked : null;

            return (
              <li key={`${step.step}-${idx}`} className="relative">
                <span className="absolute -left-[33px] top-3 h-2.5 w-2.5 rounded-full bg-zinc-700 ring-4 ring-zinc-950" />
                <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {step.step}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${stepBadge(step.status)}`}
                    >
                      {step.status}
                    </span>
                  </div>

                  {errorMessage || blocked ? (
                    <p className="mt-2 text-xs text-red-300">
                      {errorMessage ?? blocked}
                    </p>
                  ) : null}

                  {call ? (
                    <div className="mt-3">
                      <LlmCallPanel call={call} />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Aggregate({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-zinc-100">{value}</div>
    </div>
  );
}

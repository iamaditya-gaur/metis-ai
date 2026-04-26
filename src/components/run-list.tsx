import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { GlassPanel } from "@/components/glass-panel";
import { StatusPill } from "@/components/status-pill";
import type { RunListItem } from "@/lib/metis/types";

type RunListProps = {
  runs: RunListItem[];
};

export function RunList({ runs }: RunListProps) {
  return (
    <GlassPanel
      eyebrow="Runs"
      title="Recent local runs"
      description="The first MVP observability surface should make prior runs scannable without exposing raw implementation detail first."
    >
      {runs.length ? (
        <div className="product-list">
          {runs.map((run) => (
            <Link key={run.runId} href={`/app/runs/${run.runId}`} className="product-list-item">
              <div className="product-list-title">
                <strong>
                  {run.flowType === "builder" ? "Builder" : "Reporting"} · {run.accountLabel}
                </strong>
                <StatusPill label={run.status} tone={run.statusTone} />
              </div>
              <p className="product-help">{run.summary ?? "No summary captured for this run yet."}</p>
              <div className="product-list-meta">
                <span>{run.runId}</span>
                <span>{new Date(run.startedAt).toLocaleString()}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No runs logged yet"
          copy="Once the reporting or builder routes execute through the app, this screen will surface the local JSONL run history here."
        />
      )}
    </GlassPanel>
  );
}

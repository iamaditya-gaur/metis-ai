import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { GlassPanel } from "@/components/glass-panel";
import { MetricTile } from "@/components/metric-tile";
import { MissionControlSwitcher } from "@/components/mission-control-switcher";
import { RunList } from "@/components/run-list";
import { listRunSummaries } from "@/lib/metis/runs";
import { defaultAccountBadges } from "@/lib/metis/types";

const missionMetrics = [
  {
    kicker: "Reporting default",
    value: "CB",
    copy: "Pinned for reporting until the operator deliberately changes it.",
  },
  {
    kicker: "Builder default",
    value: "Adi personal",
    copy: "Pinned for paused draft creation and called out as the safe default.",
  },
  {
    kicker: "POC state",
    value: "12/12",
    copy: "All thin-proof POC slices are complete and ready to be lifted into the UI.",
  },
];

export default async function MissionControlPage() {
  const runs = await listRunSummaries(4);

  return (
    <AppShell
      eyebrow="Mission Control"
      title="Operator workspace for proven Meta reporting and builder flows"
      description="The first MVP should let you move from setup to account-aware workflow selection to inspectable runs without turning the product into a generic dashboard."
      sidebarAccounts={defaultAccountBadges}
      topbarAccounts={defaultAccountBadges}
    >
      <div className="metric-grid">
        {missionMetrics.map((metric) => (
          <MetricTile key={metric.kicker} {...metric} />
        ))}
      </div>

      <div className="product-grid product-grid--two">
        <GlassPanel
          eyebrow="Workflow selection"
          title="Choose the path, keep the account context"
          description="One shared mission-control entry keeps workflow choice simple while still making the reporting and builder defaults visible."
        >
          <MissionControlSwitcher />
          <div className="product-button-row">
            <Link href="/app/reporting" className="product-button">
              Open reporting
            </Link>
            <Link href="/app/builder" className="product-button" data-variant="secondary">
              Open builder
            </Link>
          </div>
        </GlassPanel>

        <GlassPanel
          eyebrow="Run posture"
          title="Use the already-proven flows first"
          description="This MVP should wrap the passing reporting and builder chains before any broader expansion or new agent complexity gets introduced."
        >
          <div className="product-list">
            <article className="product-list-item">
              <strong>Reporting</strong>
              <p className="product-help">Read real insights, generate a factual summary, apply tone context, send Slack output, then log the run.</p>
            </article>
            <article className="product-list-item">
              <strong>Builder</strong>
              <p className="product-help">Generate strategy, copy, and a validated paused-only draft path before any Meta write occurs.</p>
            </article>
          </div>
        </GlassPanel>
      </div>

      <RunList runs={runs} />
    </AppShell>
  );
}

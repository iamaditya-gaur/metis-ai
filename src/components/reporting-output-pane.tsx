import { GlassPanel } from "@/components/glass-panel";
import { MetricTile } from "@/components/metric-tile";
import { StatusPill } from "@/components/status-pill";
import type { ReportingRunResponse } from "@/lib/metis/types";

type ReportingOutputPaneProps = {
  result: ReportingRunResponse | null;
  error: string;
  isPending: boolean;
};

export function ReportingOutputPane({
  result,
  error,
  isPending,
}: ReportingOutputPaneProps) {
  const metrics = result
    ? [
        {
          kicker: "Spend",
          value:
            result.snapshot.totals.spend !== null ? `$${result.snapshot.totals.spend}` : "n/a",
          copy: "Grounded in the current reporting window.",
        },
        {
          kicker: "Cost per result",
          value:
            result.snapshot.totals.primaryResult?.costPerResult !== null &&
            result.snapshot.totals.primaryResult?.costPerResult !== undefined
              ? `$${result.snapshot.totals.primaryResult.costPerResult}`
              : "n/a",
          copy: "Uses the leading result signal returned in the reporting data.",
        },
        {
          kicker: "CTR",
          value: result.snapshot.totals.ctr !== null ? `${result.snapshot.totals.ctr}%` : "n/a",
          copy: "Useful signal for message framing, not just raw delivery volume.",
        },
        {
          kicker: "CPM",
          value: result.snapshot.totals.cpm !== null ? `$${result.snapshot.totals.cpm}` : "n/a",
          copy: "Cost per thousand impressions across the selected date range.",
        },
        {
          kicker: "CPC",
          value: result.snapshot.totals.cpc !== null ? `$${result.snapshot.totals.cpc}` : "n/a",
          copy: "Keep cost efficiency grounded before applying tone rewrite.",
        },
      ]
    : [
        {
          kicker: "Spend",
          value: "$4,243.77",
          copy: "Grounded in the proven POC reporting window.",
        },
        {
          kicker: "Cost per result",
          value: "$22.58",
          copy: "Uses the leading result signal returned in the reporting data.",
        },
        {
          kicker: "CTR",
          value: "2.4%",
          copy: "Useful signal for message framing, not just raw delivery volume.",
        },
        {
          kicker: "CPM",
          value: "$13.23",
          copy: "Cost per thousand impressions across the selected date range.",
        },
        {
          kicker: "CPC",
          value: "$0.55",
          copy: "Keep cost efficiency grounded before applying tone rewrite.",
        },
      ];

  return (
    <GlassPanel
      eyebrow="Output"
      title="Facts first, message second"
      description="The operator should be able to inspect the factual summary separately from the Slack-ready client message."
      actions={
        error ? (
          <StatusPill label="Run failed" tone="warning" />
        ) : isPending ? (
          <StatusPill label="Running" tone="info" />
        ) : result ? (
          <StatusPill label="Slack-ready" tone="success" />
        ) : (
          <StatusPill label="Awaiting run" tone="neutral" />
        )
      }
    >
      <div className="metric-grid">
        {metrics.map((metric) => (
          <MetricTile key={metric.kicker} {...metric} />
        ))}
      </div>

      {error ? <div className="product-warning">{error}</div> : null}
      {result?.toneRewriteBlocked ? (
        <div className="product-warning">
          Tone rewrite fell back to the factual Slack message: {result.toneRewriteBlocked}
        </div>
      ) : null}

      <div className="product-grid product-grid--two">
        <article className="product-list-item">
          <p className="product-label">Factual summary</p>
          <p className="product-help">
            {result?.report.executiveSummary ??
              "For 2026-04-18 to 2026-04-24, spend reached 4,243.77 on 320,745 impressions and 7,695 clicks. Overall delivery remained healthy, with meaningful variance across campaigns and rising frequency worth watching."}
          </p>
        </article>

        <article className="product-list-item">
          <p className="product-label">Client-style message</p>
          <p className="product-help">
            {result?.finalSlackMessage ??
              "Quick update from my side: spend held in a solid place and click volume stayed strong. Main thing I want to watch next is frequency, since that is where pressure could start to show if we leave the current mix untouched."}
          </p>
        </article>
      </div>
    </GlassPanel>
  );
}

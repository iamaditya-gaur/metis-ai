import { GlassPanel } from "@/components/glass-panel";
import { StatusPill } from "@/components/status-pill";
import type { SetupReadiness } from "@/lib/metis/types";

type SetupReadinessCardProps = {
  readiness: SetupReadiness;
};

export function SetupReadinessCard({ readiness }: SetupReadinessCardProps) {
  const readinessItems = [
    {
      label: "Meta token",
      ready: readiness.metaTokenReady,
      copy: "Use the existing long-lived token path and keep it server-side only.",
    },
    {
      label: "Reporting account",
      ready: readiness.reportingAccountReady,
      copy: "Default stays pinned to CB for reporting until a deliberate change is made.",
    },
    {
      label: "Draft account",
      ready: readiness.draftAccountReady,
      copy: "Builder writes stay pointed at Adi personal by default for draft-safe execution.",
    },
    {
      label: "OpenRouter + Slack",
      ready: readiness.openRouterReady && readiness.slackReady,
      copy: "Reporting needs both summary generation and Slack delivery available to preserve the proven flow.",
    },
    {
      label: "Observability log",
      ready: readiness.observabilityReady,
      copy: `Current log path: ${readiness.logPath}`,
    },
  ];

  return (
    <GlassPanel
      eyebrow="Readiness"
      title="Locked setup decisions"
      description="This screen keeps the non-negotiable environment, account, and safety assumptions visible before any run starts."
    >
      <div className="product-list">
        {readinessItems.map((item) => (
          <article key={item.label} className="product-list-item">
            <div className="product-list-title">
              <strong>{item.label}</strong>
              <StatusPill
                label={item.ready ? "Ready" : "Missing"}
                tone={item.ready ? "success" : "warning"}
              />
            </div>
            <p className="product-help">{item.copy}</p>
          </article>
        ))}
      </div>
    </GlassPanel>
  );
}

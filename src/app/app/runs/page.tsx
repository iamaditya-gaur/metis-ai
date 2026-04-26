import { AppShell } from "@/components/app-shell";
import { RunList } from "@/components/run-list";
import { listRunSummaries } from "@/lib/metis/runs";
import { defaultAccountBadges } from "@/lib/metis/types";

export default async function RunsPage() {
  const runs = await listRunSummaries();

  return (
    <AppShell
      eyebrow="Runs"
      title="Inspect local observability before adding more surface area"
      description="The first run viewer should stay simple: list recent runs, expose the selected account, and make the final output inspectable without burying the operator in raw data."
      sidebarAccounts={defaultAccountBadges}
      topbarAccounts={defaultAccountBadges}
    >
      <RunList runs={runs} />
    </AppShell>
  );
}

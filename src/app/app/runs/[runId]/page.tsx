import { AppShell } from "@/components/app-shell";
import { RunDetail } from "@/components/run-detail";
import { getRunDetail } from "@/lib/metis/runs";
import { defaultAccountBadges } from "@/lib/metis/types";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = await getRunDetail(runId);

  return (
    <AppShell
      eyebrow="Run Detail"
      title="Review the run path before changing the workflow"
      description="Run details should make the exact account, steps, and outputs visible so trust comes from inspection instead of guesswork."
      sidebarAccounts={defaultAccountBadges}
      topbarAccounts={defaultAccountBadges}
    >
      <RunDetail run={run} />
    </AppShell>
  );
}

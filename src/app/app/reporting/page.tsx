import { AppShell } from "@/components/app-shell";
import { ReportingWorkspace } from "@/components/reporting-workspace";
import { getAccessibleAccounts } from "@/lib/metis/accounts";
import { defaultAccountBadges } from "@/lib/metis/types";

export default async function ReportingPage() {
  const accounts = await getAccessibleAccounts().catch(() => []);

  return (
    <AppShell
      eyebrow="Reporting"
      title="Read account performance, then shape the client message safely"
      description="Reporting should default to the client account, keep the reporting window explicit, and separate metric-grounded facts from the final Slack-ready message."
      sidebarAccounts={defaultAccountBadges}
      topbarAccounts={defaultAccountBadges}
    >
      <ReportingWorkspace accounts={accounts} />
    </AppShell>
  );
}

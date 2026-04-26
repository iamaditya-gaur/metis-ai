import { AppShell } from "@/components/app-shell";
import { ReportingStudio } from "@/components/reporting-studio";
import { getAccessibleAccounts } from "@/lib/metis/accounts";
import { defaultAccountBadges } from "@/lib/metis/types";

export default async function ReportingNewPage() {
  const accounts = await getAccessibleAccounts().catch(() => []);

  return (
    <AppShell
      eyebrow="Reporting New"
      title="Run one reporting desk that keeps controls up top and outputs side by side"
      description="This redesigned reporting surface is built for production operators who want one clean input strip, a fast metric read, and a clear split between factual analysis and the final client-facing message."
      sidebarAccounts={defaultAccountBadges}
      topbarAccounts={defaultAccountBadges}
    >
      <ReportingStudio accounts={accounts} />
    </AppShell>
  );
}

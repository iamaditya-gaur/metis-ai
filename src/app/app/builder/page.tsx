import { AppShell } from "@/components/app-shell";
import { BuilderWorkspace } from "@/components/builder-workspace";
import { getAccessibleAccounts } from "@/lib/metis/accounts";
import { defaultAccountBadges } from "@/lib/metis/types";

export default async function BuilderPage() {
  const accounts = await getAccessibleAccounts().catch(() => []);

  return (
    <AppShell
      eyebrow="Builder"
      title="Preview strategy and copy before any paused draft write"
      description="Builder should start from the safe draft account, keep that account name visible, and make the review gate unavoidable before creating any paused objects."
      sidebarAccounts={defaultAccountBadges}
      topbarAccounts={defaultAccountBadges}
    >
      <BuilderWorkspace accounts={accounts} />
    </AppShell>
  );
}

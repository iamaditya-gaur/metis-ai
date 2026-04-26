import { getAccessibleAccounts } from "@/lib/metis/accounts";
import { getSetupReadiness } from "@/lib/metis/env";
import { AccountSelectorCard } from "@/components/account-selector-card";
import { AppShell } from "@/components/app-shell";
import { SetupReadinessCard } from "@/components/setup-readiness-card";
import { defaultAccountBadges } from "@/lib/metis/types";

export default async function SetupPage() {
  const [readiness, accounts] = await Promise.all([
    getSetupReadiness(),
    getAccessibleAccounts().catch(() => []),
  ]);

  return (
    <AppShell
      eyebrow="Setup"
      title="Confirm readiness before the first real run"
      description="The setup surface should answer one question quickly: are the environment, accounts, and safety defaults all in the right state to trust the next run."
      sidebarAccounts={defaultAccountBadges}
      topbarAccounts={defaultAccountBadges}
    >
      <div className="product-grid product-grid--two">
        <SetupReadinessCard readiness={readiness} />
        <AccountSelectorCard accounts={accounts} />
      </div>
    </AppShell>
  );
}

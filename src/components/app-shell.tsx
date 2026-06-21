import { AppTopbar } from "@/components/app-topbar";
import type { AccountBadge } from "@/lib/metis/types";

type AppShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  /** Legacy prop, no longer rendered. Kept so old pages still compile. */
  sidebarAccounts?: AccountBadge[];
  topbarAccounts?: AccountBadge[];
  children: React.ReactNode;
};

/**
 * Per-page header + main wrapper. The sidebar and outer shell live in
 * `/app/app/layout.tsx` so they stay mounted across navigation — which is
 * what makes `loading.tsx` skeletons feel instant instead of flashing.
 *
 * Pages still call <AppShell eyebrow="…" title="…" description="…"> for the
 * topbar; loading.tsx can render the same <AppTopbar /> directly with a
 * skeleton body.
 */
export function AppShell({
  eyebrow,
  title,
  description,
  topbarAccounts,
  children,
}: AppShellProps) {
  return (
    <>
      <AppTopbar
        eyebrow={eyebrow}
        title={title}
        description={description}
        chips={topbarAccounts}
      />
      <main className="product-content">{children}</main>
    </>
  );
}

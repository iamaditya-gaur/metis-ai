import Link from "next/link";

import { AppTopbar } from "@/components/app-topbar";
import type { AccountBadge } from "@/lib/metis/types";

type AppShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  /** Legacy prop, no longer rendered. Kept so old pages still compile. */
  sidebarAccounts?: AccountBadge[];
  topbarAccounts?: AccountBadge[];
  /** When set, renders a "← <label>" chevron link above the page header. */
  backHref?: string;
  backLabel?: string;
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
  backHref,
  backLabel,
  children,
}: AppShellProps) {
  return (
    <>
      {backHref ? (
        <Link href={backHref} className="app-shell-back-link">
          <BackChevron />
          <span>{backLabel ?? "Back"}</span>
        </Link>
      ) : null}
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

function BackChevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

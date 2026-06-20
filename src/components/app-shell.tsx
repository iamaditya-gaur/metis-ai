import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { createClient } from "@/lib/supabase/server";
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
 * Authed product chrome. Server component — pulls the signed-in user itself
 * so individual pages don't need to thread it through.
 */
export async function AppShell({
  eyebrow,
  title,
  description,
  topbarAccounts,
  children,
}: AppShellProps) {
  let userEmail: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
  } catch {
    // If Supabase env isn't configured (e.g. broken local), render without a
    // user — middleware already enforced auth before we got here.
  }

  return (
    <div className="product-shell">
      <AppSidebar user={userEmail !== null ? { email: userEmail } : null} />
      <div className="product-main">
        <AppTopbar
          eyebrow={eyebrow}
          title={title}
          description={description}
          chips={topbarAccounts}
        />
        <main className="product-content">{children}</main>
      </div>
    </div>
  );
}

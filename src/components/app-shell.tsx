import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import type { AccountBadge } from "@/lib/metis/types";

type AppShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  sidebarAccounts: AccountBadge[];
  topbarAccounts?: AccountBadge[];
  children: React.ReactNode;
};

export function AppShell({
  eyebrow,
  title,
  description,
  sidebarAccounts,
  topbarAccounts,
  children,
}: AppShellProps) {
  return (
    <div className="product-shell">
      <AppSidebar accounts={sidebarAccounts} />
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

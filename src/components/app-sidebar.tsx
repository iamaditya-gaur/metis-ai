"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { AccountBadge } from "@/lib/metis/types";

const navItems = [
  {
    href: "/app",
    label: "Mission Control",
    copy: "Choose a workflow, keep account context visible, and track recent runs.",
  },
  {
    href: "/app/setup",
    label: "Setup",
    copy: "Check readiness, confirm accessible accounts, and keep defaults obvious.",
  },
  {
    href: "/app/reporting",
    label: "Reporting",
    copy: "Run factual reporting first, then apply client-safe tone context.",
  },
  {
    href: "/app/reporting-new",
    label: "Reporting New",
    copy: "Use the redesigned reporting desk with top-line controls and parallel output panes.",
  },
  {
    href: "/app/builder",
    label: "Builder",
    copy: "Preview strategy, copy, and paused draft actions before any write.",
  },
  {
    href: "/app/runs",
    label: "Runs",
    copy: "Inspect recent reporting and builder runs from the local log.",
  },
];

type AppSidebarProps = {
  accounts: AccountBadge[];
};

export function AppSidebar({ accounts }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="product-sidebar">
      <div className="product-brand">
        <span className="product-brand-mark">M</span>
        <div>
          <p className="product-brand-title">Metis AI</p>
          <p className="product-brand-copy">
            Reporting and builder workflows for Meta operators. Local-first until the app is stable.
          </p>
        </div>
      </div>

      <nav className="product-nav" aria-label="Primary">
        {navItems.map((item) => {
          const isActive =
            item.href === "/app"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="product-nav-link"
              data-active={isActive}
            >
              <span className="product-nav-label">{item.label}</span>
              <span className="product-nav-copy">{item.copy}</span>
            </Link>
          );
        })}
      </nav>

      <div className="product-account-stack">
        {accounts.map((account) => (
          <div key={account.role} className="product-account-card">
            <span className="product-account-role">{account.role}</span>
            <strong className="product-account-label">{account.label}</strong>
          </div>
        ))}
      </div>

      <p className="product-sidebar-footnote">
        Safety rule stays locked: reporting can read broadly, builder can write narrowly, and every write remains paused-only.
      </p>
    </aside>
  );
}

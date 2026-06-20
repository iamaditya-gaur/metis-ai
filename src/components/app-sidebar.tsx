"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/(auth)/actions";

const navItems = [
  {
    href: "/app/reports",
    label: "Reports",
    copy: "Pick a connection, pick a window, generate a client-ready summary.",
  },
  {
    href: "/app/history",
    label: "History",
    copy: "Re-open any report you have generated before.",
  },
  {
    href: "/app/connections",
    label: "Connections",
    copy: "Manage saved Meta tokens. One per agency client or account.",
  },
  {
    href: "/app/settings",
    label: "Settings",
    copy: "Email, password, and where summaries get delivered.",
  },
];

type AppSidebarProps = {
  user: { email: string | null } | null;
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="product-sidebar">
      <Link href="/app/reports" className="product-brand product-brand-link">
        <span className="product-brand-mark">M</span>
        <div>
          <p className="product-brand-title">Metis AI</p>
          <p className="product-brand-copy">
            Meta ad reports that sound like you wrote them.
          </p>
        </div>
      </Link>

      <nav className="product-nav" aria-label="Primary">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
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

      <div className="product-sidebar-footer">
        {user ? (
          <div className="product-user-card">
            <span className="product-account-role">Signed in</span>
            <strong className="product-account-label">{user.email}</strong>
            <form action={signOutAction}>
              <button
                type="submit"
                className="product-button"
                data-variant="secondary"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link href="/login" className="product-button" data-variant="secondary">
            Sign in
          </Link>
        )}
      </div>
    </aside>
  );
}

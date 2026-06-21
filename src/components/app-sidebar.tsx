"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { signOutAction } from "@/app/(auth)/actions";
import { NavLink } from "@/components/nav-link";

const navItems = [
  {
    href: "/app/reports",
    label: "Reports",
    copy: "Generate a client-ready summary.",
    icon: <IconBarChart />,
  },
  {
    href: "/app/history",
    label: "History",
    copy: "Re-open past reports.",
    icon: <IconClock />,
  },
  {
    href: "/app/connections",
    label: "Connections",
    copy: "Manage saved Meta tokens.",
    icon: <IconLink />,
  },
  {
    href: "/app/settings",
    label: "Settings",
    copy: "Email, password, profile.",
    icon: <IconCog />,
  },
];

type Props = {
  user: { email: string | null } | null;
  defaultCollapsed?: boolean;
};

export function AppSidebar({ user, defaultCollapsed = true }: Props) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Persist collapsed state so the next page render and the next session
  // both pick up the user's preference without a flash.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.cookie = `metis.sidebar=${isCollapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }, [isCollapsed]);

  // Close the mobile drawer whenever the route changes — otherwise the
  // overlay sticks around over the next page.
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isMobileOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isMobileOpen]);

  return (
    <>
      <button
        type="button"
        className="product-mobile-trigger"
        aria-label="Open navigation"
        aria-expanded={isMobileOpen}
        onClick={() => setIsMobileOpen(true)}
      >
        <IconMenu />
      </button>

      {isMobileOpen ? (
        <button
          type="button"
          className="product-mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setIsMobileOpen(false)}
        />
      ) : null}

      <aside
        className="product-sidebar"
        data-collapsed={isCollapsed ? "true" : undefined}
        data-mobile-open={isMobileOpen ? "true" : undefined}
        aria-label="Primary"
      >
        <div className="product-brand-row">
          <Link href="/app/reports" className="product-brand product-brand-link">
            <span className="product-brand-mark" aria-hidden="true">
              M
            </span>
            <span className="product-brand-text">
              <span className="product-brand-title">Metis AI</span>
              <span className="product-brand-copy">
                Meta ad reports that sound like you wrote them.
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="product-sidebar-toggle"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((prev) => !prev)}
          >
            <IconMenu />
          </button>
        </div>

        <nav className="product-nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                copy={item.copy}
                icon={item.icon}
                isActive={isActive}
                isCollapsed={isCollapsed}
              />
            );
          })}
        </nav>

        <div className="product-sidebar-footer">
          {user ? (
            <div className="product-user-card">
              <span className="product-account-role">Signed in</span>
              <strong className="product-account-label" title={user.email ?? ""}>
                {user.email}
              </strong>
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
            <Link
              href="/login"
              className="product-button"
              data-variant="secondary"
            >
              Sign in
            </Link>
          )}
        </div>

      </aside>
    </>
  );
}

/* ---- inline icons (no new dependency) ----------------------------------- */

const iconBaseProps = {
  viewBox: "0 0 24 24",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconBarChart() {
  return (
    <svg {...iconBaseProps} aria-hidden="true">
      <line x1="6" y1="20" x2="6" y2="16" />
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg {...iconBaseProps} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 16 14" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg {...iconBaseProps} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1 1" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1-1" />
    </svg>
  );
}

function IconCog() {
  return (
    <svg {...iconBaseProps} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.2 16.9l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.2l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg {...iconBaseProps} aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}


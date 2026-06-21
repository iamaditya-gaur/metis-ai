"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";

type NavLinkProps = {
  href: string;
  label: string;
  copy: string;
  icon: React.ReactNode;
  isActive: boolean;
  isCollapsed?: boolean;
};

/**
 * Sidebar link with built-in pending feedback. The inner `<LinkPendingMark>`
 * subscribes to `useLinkStatus()` (Next 15.3+) so the click registers
 * visually within ~10ms — no more "did anything happen?" dead clicks.
 */
export function NavLink({
  href,
  label,
  copy,
  icon,
  isActive,
  isCollapsed = false,
}: NavLinkProps) {
  return (
    <Link
      href={href}
      className="product-nav-link"
      data-active={isActive}
      data-collapsed={isCollapsed ? "true" : undefined}
      title={isCollapsed ? label : undefined}
      prefetch
    >
      <LinkPendingMark>
        <span className="product-nav-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="product-nav-text">
          <span className="product-nav-label">{label}</span>
          <span className="product-nav-copy">{copy}</span>
        </span>
      </LinkPendingMark>
    </Link>
  );
}

function LinkPendingMark({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span
      className="product-nav-link-inner"
      data-pending={pending ? "true" : undefined}
    >
      {children}
      <span className="product-nav-link-bar" aria-hidden="true" />
    </span>
  );
}

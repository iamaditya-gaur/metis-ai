import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <main className="auth-main">
        <Link href="/" className="auth-brand" aria-label="Metis home">
          <span className="auth-brand-mark">M</span>
          <span className="auth-brand-word">Metis</span>
        </Link>
        <div className="auth-card">{children}</div>
        <p className="auth-footnote">
          Reporting that stays grounded in your Meta data and sounds like you wrote it.
        </p>
      </main>
    </div>
  );
}

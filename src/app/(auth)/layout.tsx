import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="product-root auth-root">
      <main className="auth-main">
        <Link href="/" className="auth-brand">
          <span className="auth-brand-mark">M</span>
          <span className="auth-brand-word">Metis</span>
        </Link>
        <div className="auth-card">{children}</div>
        <p className="auth-footnote">
          Metis turns Meta ad data into reporting that sounds like you wrote it.
        </p>
      </main>
    </div>
  );
}

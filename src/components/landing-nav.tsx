import Link from "next/link";

type LandingNavProps = {
  user: { email: string | null } | null;
  /** Accounts paused: one button straight to the no-login tool. */
  paused?: boolean;
};

export function LandingNav({ user, paused = false }: LandingNavProps) {
  return (
    <header className="landing-nav fx-load--drop">
      <Link href="/" className="landing-nav-brand" aria-label="Metis AI home">
        <span className="landing-nav-mark" aria-hidden="true">
          M
        </span>
        <span className="landing-nav-wordmark">Metis AI</span>
      </Link>

      <nav className="landing-nav-actions" aria-label="Account">
        {paused ? (
          <Link
            href="/reporting"
            className="landing-nav-cta landing-nav-cta--primary"
          >
            Open Metis
          </Link>
        ) : user ? (
          <Link
            href="/app/reports"
            className="landing-nav-cta landing-nav-cta--primary"
          >
            Open app
          </Link>
        ) : (
          <>
            <Link href="/login" className="landing-nav-cta landing-nav-cta--ghost">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="landing-nav-cta landing-nav-cta--primary"
            >
              Get started
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

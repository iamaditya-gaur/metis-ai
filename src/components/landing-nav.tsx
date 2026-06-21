import Link from "next/link";

type LandingNavProps = {
  user: { email: string | null } | null;
};

export function LandingNav({ user }: LandingNavProps) {
  return (
    <header className="landing-nav">
      <Link href="/" className="landing-nav-brand" aria-label="Metis AI home">
        <span className="landing-nav-mark" aria-hidden="true">
          M
        </span>
        <span className="landing-nav-wordmark">Metis AI</span>
      </Link>

      <nav className="landing-nav-actions" aria-label="Account">
        {user ? (
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

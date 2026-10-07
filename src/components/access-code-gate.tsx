import Link from "next/link";

import { GlassPanel } from "@/components/glass-panel";

type AccessCodeGateProps = {
  status?: string;
  configured: boolean;
};

const STATUS_MESSAGES: Record<string, string> = {
  wrong: "That code didn't work. Check it and try again.",
  locked: "Too many wrong tries. Wait 15 minutes, then try again.",
  off: "The tool is locked right now. Ask the owner for access.",
};

/**
 * Server-rendered screen shown on `/reporting` until the browser holds a
 * valid access cookie. Plain form POST to `/api/access` — the code is checked
 * on the server only and never stored in the page or browser storage.
 */
export function AccessCodeGate({ status, configured }: AccessCodeGateProps) {
  const message = !configured
    ? STATUS_MESSAGES.off
    : status
      ? STATUS_MESSAGES[status] ?? null
      : null;

  return (
    <main className="reporting-launch">
      <div className="reporting-launch-shell access-gate-shell">
        <Link href="/" className="landing-nav-brand" aria-label="Metis AI home">
          <span className="landing-nav-mark" aria-hidden="true">
            M
          </span>
          <span className="landing-nav-wordmark">Metis AI</span>
        </Link>

        <GlassPanel
          className="reporting-launch-panel"
          eyebrow="Invite only"
          title="Enter your access code"
          description="Metis is invite-only right now. Enter the code you were given to open the reporting tool. This browser stays unlocked for 14 days."
        >
          <form className="reporting-token-form" method="post" action="/api/access">
            <div className="product-field">
              <label className="product-label" htmlFor="access-code">
                Access code
              </label>
              <input
                id="access-code"
                name="code"
                type="password"
                className="product-input"
                autoComplete="current-password"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={256}
                required
                autoFocus
                disabled={!configured}
              />
            </div>

            {message ? <div className="product-warning">{message}</div> : null}

            <button type="submit" className="product-button" disabled={!configured}>
              Unlock
            </button>
          </form>
        </GlassPanel>
      </div>
    </main>
  );
}

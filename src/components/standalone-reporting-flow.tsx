"use client";

import { useState, useTransition } from "react";

import { GlassPanel } from "@/components/glass-panel";
import { ProcessingIndicator, ProcessingOverlay } from "@/components/processing-overlay";
import { ReportingStudio } from "@/components/reporting-studio";
import { StatusPill } from "@/components/status-pill";
import type { AccountOption } from "@/lib/metis/types";

type AccountsResponse = {
  accounts?: AccountOption[];
  message?: string;
};

export function StandaloneReportingFlow() {
  const [draftToken, setDraftToken] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [error, setError] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConnect = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedToken = draftToken.trim();

    if (!trimmedToken) {
      setError("Paste a valid Meta access token before continuing.");
      return;
    }

    startTransition(async () => {
      setError("");

      try {
        const response = await fetch("/api/metis/accounts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessToken: trimmedToken,
          }),
        });
        const body = (await response.json()) as AccountsResponse;

        if (!response.ok) {
          throw new Error(body.message ?? "Could not load Meta ad accounts.");
        }

        const nextAccounts = Array.isArray(body.accounts) ? body.accounts : [];

        if (!nextAccounts.length) {
          throw new Error(
            "This token did not return any accessible ad accounts. Use a token with reporting access to at least one Meta ad account.",
          );
        }

        setAccounts(nextAccounts);
        setSessionToken(trimmedToken);
      } catch (connectError) {
        setSessionToken(null);
        setAccounts([]);
        setError(
          connectError instanceof Error
            ? connectError.message
            : "Could not load Meta ad accounts.",
        );
      }
    });
  };

  const handleReset = () => {
    setSessionToken(null);
    setAccounts([]);
    setError("");
    setDraftToken("");
  };

  if (sessionToken) {
    return (
      <main className="reporting-launch">
        <div className="reporting-launch-shell">
          <header className="reporting-standalone-head">
            <div className="reporting-standalone-copy">
              <span className="product-eyebrow">Standalone Reporting</span>
              <h1 className="reporting-standalone-title">
                Generate Meta ads reports that sound like your own client or team updates
              </h1>
              <p className="product-description">
                Your token is connected for this session. Select the ad account, run the reporting
                window, and turn the factual performance read into a final summary that stays close
                to how you have reported results in the past.
              </p>
            </div>

            <div className="reporting-standalone-actions">
              <StatusPill label="Token connected" tone="success" />
              <button
                type="button"
                className="product-button"
                data-variant="secondary"
                onClick={handleReset}
              >
                Use a different token
              </button>
            </div>
          </header>

          {error ? <div className="product-warning">{error}</div> : null}

          <GlassPanel
            className="reporting-session-panel"
            eyebrow="Session"
            title="Reporting access is live for this session"
            description="Metis uses the connected Meta access token only to load accessible ad accounts and fetch the reporting data needed for the summaries you generate here."
            actions={<StatusPill label={`${accounts.length} account${accounts.length === 1 ? "" : "s"}`} tone="info" />}
          >
            <div className="reporting-session-grid">
              <div className="reporting-session-card">
                <span className="product-label">What happens next</span>
                <p className="product-help">
                  Choose the reporting account, set your date range, and paste past client or team
                  updates if you want the final message to mirror your usual reporting style more
                  closely.
                </p>
              </div>
              <div className="reporting-session-card">
                <span className="product-label">Token handling</span>
                <p className="product-help">
                  The token is sent server-side for this session flow and is never included in the
                  generated summaries, Slack message text, or visible output panels.
                </p>
              </div>
            </div>
          </GlassPanel>

          <ReportingStudio
            key={sessionToken}
            accounts={accounts}
            accessToken={sessionToken}
            mode="standalone"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="reporting-launch">
      <div className="reporting-launch-shell">
        <div className="reporting-launch-grid">
          <GlassPanel
            className="reporting-launch-panel reporting-launch-panel--intro"
            eyebrow="AI Client Reporting"
            title="Generate Meta ads summaries that sound much closer to how you already report performance"
            description="Connect a Meta access token, run one reporting window, and give Metis a few past updates. It will keep the facts grounded in the data while shaping the final summary to sound much closer to your own reporting style."
            actions={
              <button
                type="button"
                className="product-button reporting-guide-button"
                data-variant="secondary"
                onClick={() => setIsGuideOpen(true)}
              >
                Guide: Get Your Meta Access Token
              </button>
            }
          >
            <div className="reporting-launch-list">
              <article className="reporting-launch-item">
                <strong>1. Connect your Meta access token</strong>
                <p className="product-help">
                  Start by pasting a valid Meta access token with reporting access to the ad
                  accounts you want to analyze.
                </p>
              </article>
              <article className="reporting-launch-item">
                <strong>2. Add your reporting window and past message examples</strong>
                <p className="product-help">
                  Choose the account and date range, then paste a few past client or team updates
                  if you want the final summary to match your usual structure, tone, and phrasing.
                </p>
              </article>
              <article className="reporting-launch-item">
                <strong>3. Review the facts first, then the send-ready summary</strong>
                <p className="product-help">
                  Metis keeps the factual performance read separate from the final client-facing
                  message so the numbers stay correct while the delivery sounds much closer to you.
                </p>
              </article>
            </div>
            <p className="product-help">
              Open the guide if you do not already have a Meta token or if you want a clear
              step-by-step path before connecting your account.
            </p>
          </GlassPanel>

          <GlassPanel
            className="reporting-launch-panel reporting-launch-panel--token"
            eyebrow="Connect Meta Reporting"
            title="Paste a Meta access token to start generating personalized reporting summaries"
            description="Use a valid long-lived user token with access to the Meta ad accounts you want to report on."
            actions={
              isPending ? <StatusPill label="Loading accounts" tone="info" isActive /> : null
            }
            busy={isPending}
            overlay={
              isPending ? (
                <ProcessingOverlay
                  eyebrow="Connecting Meta"
                  title="Loading ad accounts for this session"
                  description="Metis is checking the token and loading the ad accounts that this Meta access token can report on."
                  steps={["Verify token access", "Load accessible ad accounts"]}
                />
              ) : null
            }
          >
            <form className="reporting-token-form" onSubmit={handleConnect}>
              <div className="product-field">
                <label className="product-label" htmlFor="reporting-access-token">
                  Meta access token
                </label>
                <textarea
                  id="reporting-access-token"
                  className="product-textarea reporting-token-input"
                  value={draftToken}
                  onChange={(event) => setDraftToken(event.target.value)}
                  placeholder="EAAB..."
                  spellCheck={false}
                />
                <p className="product-help">
                  Metis uses this token only to load accessible ad accounts and pull the reporting
                  data needed to generate your summaries.
                </p>
              </div>

              {error ? <div className="product-warning">{error}</div> : null}

              <div className="reporting-token-foot">
                <p className="product-help">
                  The token is sent server-side and is never included in client-ready message
                  output, team updates, Slack copy, or visible reporting panels.
                </p>
                <button
                  type="submit"
                  className="product-button"
                  data-loading={isPending ? "true" : undefined}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <ProcessingIndicator mode="inline" />
                      Loading ad accounts...
                    </>
                  ) : (
                    "Load ad accounts"
                  )}
                </button>
              </div>
            </form>
          </GlassPanel>
        </div>
      </div>

      {isGuideOpen ? (
        <div
          className="reporting-guide-modal-backdrop"
          role="presentation"
          onClick={() => setIsGuideOpen(false)}
        >
          <section
            className="glass-panel reporting-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reporting-guide-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="glass-panel-content reporting-guide-modal-content">
            <div className="reporting-guide-modal-head">
              <div className="reporting-guide-modal-copy">
                <span className="product-eyebrow">Meta Access Token Guide</span>
                <h2 id="reporting-guide-title" className="glass-panel-title">
                  How To Get Your Meta Access Token for Reporting
                </h2>
                <p className="glass-panel-description">
                  Follow the path that matches where you are today. This flow is written for users
                  who may not already have a Meta developer app.
                </p>
              </div>

              <button
                type="button"
                className="product-button reporting-guide-close"
                data-variant="secondary"
                onClick={() => setIsGuideOpen(false)}
              >
                Close guide
              </button>
            </div>

            <div className="reporting-guide-modal-body">
              <article className="reporting-guide-block reporting-guide-block--intro">
                <strong>Start here</strong>
                <p className="product-help">
                  This reporting product needs a Meta user access token that can read the ad
                  accounts and insights you want to summarize. For most users, the simplest path is
                  to use Meta&apos;s Graph API Explorer with a developer app tied to the same
                  Facebook profile that already has access to the ad account.
                </p>
                <div className="reporting-guide-link-row">
                  <a
                    className="product-button reporting-guide-link"
                    data-variant="secondary"
                    href="https://developers.facebook.com/apps/create/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open app creation
                  </a>
                  <a
                    className="product-button reporting-guide-link"
                    data-variant="secondary"
                    href="https://developers.facebook.com/tools/explorer/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Graph API Explorer
                  </a>
                  <a
                    className="product-button reporting-guide-link"
                    data-variant="secondary"
                    href="https://developers.facebook.com/tools/debug/accesstoken/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Access Token Debugger
                  </a>
                </div>
              </article>

              <div className="reporting-guide-grid">
                <article className="reporting-guide-block">
                  <span className="product-label">Path A</span>
                  <strong>You do not have a Meta developer app yet</strong>
                  <ol className="reporting-guide-steps">
                    <li>Open Meta for Developers and sign in with the same Facebook profile that has access to the ad account you want to report on.</li>
                    <li>Create a new app. If Meta asks for an app type, choose the option that best fits a business or integration workflow.</li>
                    <li>Finish the basic app setup so the app appears in your developer dashboard.</li>
                    <li>Keep the app in your own control. For this reporting flow, you do not need to publish a public consumer app before testing your own token.</li>
                  </ol>
                </article>

                <article className="reporting-guide-block">
                  <span className="product-label">Path B</span>
                  <strong>You already have a Meta developer app</strong>
                  <ol className="reporting-guide-steps">
                    <li>Open your existing app in Meta for Developers.</li>
                    <li>Make sure you are logged into Facebook with the profile that can access the ad account you want to summarize.</li>
                    <li>Use that same app when generating the token in Graph API Explorer.</li>
                  </ol>
                </article>
              </div>

              <div className="reporting-guide-grid">
                <article className="reporting-guide-block">
                  <span className="product-label">Generate Token</span>
                  <strong>Create the token in Graph API Explorer</strong>
                  <ol className="reporting-guide-steps">
                    <li>Open Graph API Explorer and select your developer app.</li>
                    <li>Choose to generate a user access token.</li>
                    <li>Approve the permissions Meta requests for the reporting flow. At minimum, allow ad-reading access. If Meta prompts for additional business-related permissions required by your setup, approve those too.</li>
                    <li>After the token appears, copy it and bring it back to this reporting screen.</li>
                  </ol>
                </article>

                <article className="reporting-guide-block">
                  <span className="product-label">Verify Access</span>
                  <strong>Confirm the token can actually read your ad account</strong>
                  <ol className="reporting-guide-steps">
                    <li>Paste the token into Meta&apos;s Access Token Debugger to confirm it is valid and tied to the expected Facebook user.</li>
                    <li>Return here and paste the token into the Meta access token field.</li>
                    <li>Click <em>Load ad accounts</em>. If your expected account appears, the token is good for this reporting flow.</li>
                  </ol>
                </article>
              </div>

              <article className="reporting-guide-block reporting-guide-block--tips">
                <span className="product-label">Common blockers</span>
                <ul className="reporting-studio-bullet-list">
                  <li className="reporting-studio-bullet-item">
                    You are logged into the wrong Facebook profile, so the token cannot see the ad
                    account you want.
                  </li>
                  <li className="reporting-studio-bullet-item">
                    The token was created without the ad-reading permission needed for Meta ads
                    reporting.
                  </li>
                  <li className="reporting-studio-bullet-item">
                    The Facebook user has page access but not ad account access, so Meta returns no
                    reporting accounts.
                  </li>
                </ul>
              </article>
            </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

"use client";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Modal that walks a user through getting a Meta access token via the Graph
 * API Explorer. Same content the standalone reporting flow has shown for a
 * while — extracted here so the authed Connections page can reuse it.
 */
export function MetaTokenGuide({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="reporting-guide-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="glass-panel reporting-guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meta-token-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="glass-panel-content reporting-guide-modal-content">
          <div className="reporting-guide-modal-head">
            <div className="reporting-guide-modal-copy">
              <span className="product-eyebrow">Meta Access Token Guide</span>
              <h2 id="meta-token-guide-title" className="glass-panel-title">
                How to get your Meta access token
              </h2>
              <p className="glass-panel-description">
                Follow the path that matches where you are today. Written for
                people who may not already have a Meta developer app.
              </p>
            </div>
            <button
              type="button"
              className="product-button reporting-guide-close"
              data-variant="secondary"
              onClick={onClose}
            >
              Close guide
            </button>
          </div>

          <div className="reporting-guide-modal-body">
            <article className="reporting-guide-block reporting-guide-block--intro">
              <strong>Start here</strong>
              <p className="product-help">
                Metis needs a Meta user access token that can read the ad
                accounts and insights you want to summarize. For most users,
                the simplest path is to use Meta&apos;s Graph API Explorer with
                a developer app tied to the same Facebook profile that already
                has ad-account access.
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
                <strong>You don&apos;t have a Meta developer app yet</strong>
                <ol className="reporting-guide-steps">
                  <li>
                    Open Meta for Developers and sign in with the Facebook
                    profile that already has access to the ad account.
                  </li>
                  <li>
                    Create a new app. If Meta asks for an app type, pick the
                    one that best fits a business or integration workflow.
                  </li>
                  <li>
                    Finish basic setup so the app appears in your developer
                    dashboard.
                  </li>
                  <li>
                    Keep the app private. You don&apos;t need to publish a
                    public consumer app to test your own token.
                  </li>
                </ol>
              </article>

              <article className="reporting-guide-block">
                <span className="product-label">Path B</span>
                <strong>You already have a Meta developer app</strong>
                <ol className="reporting-guide-steps">
                  <li>Open your existing app in Meta for Developers.</li>
                  <li>
                    Make sure you&apos;re logged into Facebook with the profile
                    that can access the ad account you want to summarize.
                  </li>
                  <li>
                    Use that same app when generating the token in Graph API
                    Explorer.
                  </li>
                </ol>
              </article>
            </div>

            <div className="reporting-guide-grid">
              <article className="reporting-guide-block">
                <span className="product-label">Generate token</span>
                <strong>Create the token in Graph API Explorer</strong>
                <ol className="reporting-guide-steps">
                  <li>Open Graph API Explorer and select your developer app.</li>
                  <li>Choose to generate a user access token.</li>
                  <li>
                    Approve the permissions Meta requests. At minimum, allow
                    ad-reading. Approve any extra business permissions Meta
                    prompts for, if your setup needs them.
                  </li>
                  <li>
                    Copy the token and bring it back to this screen.
                  </li>
                </ol>
              </article>

              <article className="reporting-guide-block">
                <span className="product-label">Verify access</span>
                <strong>Confirm the token can actually read your ad account</strong>
                <ol className="reporting-guide-steps">
                  <li>
                    Paste the token into Meta&apos;s Access Token Debugger to
                    confirm it&apos;s valid and tied to the expected user.
                  </li>
                  <li>Come back here and paste it into the token field.</li>
                  <li>
                    Submit. If your expected ad account appears in the list,
                    the token is good to go.
                  </li>
                </ol>
              </article>
            </div>

            <article className="reporting-guide-block reporting-guide-block--tips">
              <span className="product-label">Common blockers</span>
              <ul className="reporting-studio-bullet-list">
                <li className="reporting-studio-bullet-item">
                  Logged into the wrong Facebook profile, so the token
                  can&apos;t see the ad account you want.
                </li>
                <li className="reporting-studio-bullet-item">
                  Token was created without the ad-reading permission.
                </li>
                <li className="reporting-studio-bullet-item">
                  The Facebook user has page access but not ad account access,
                  so Meta returns no reporting accounts.
                </li>
              </ul>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}

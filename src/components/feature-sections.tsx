const benefitCards = [
  {
    title: "Faster reporting",
    body: "Cut the 45-minute Sunday-night recap to under five. One Meta connection, one window, one click.",
  },
  {
    title: "Grounded in real data",
    body: "Numbers come from Meta, not the model. Metis pulls insights, totals, and trend signals before it writes a single sentence.",
  },
  {
    title: "Sounds like you",
    body: "Drop in a few past updates and Metis mirrors your voice — same structure, same phrasing, no AI tells.",
  },
];

const steps = [
  {
    title: "Connect your Meta account",
    body: "One paste of a Meta access token. Tokens are encrypted at rest and never appear in the generated message.",
  },
  {
    title: "Pick a reporting window",
    body: "Last 7 days, last month, or a custom range. Metis pulls the insights, totals, and changes for that window.",
  },
  {
    title: "Get a send-ready update",
    body: "A factual operator read on the left, a client-style message on the right. Copy, paste, ship.",
  },
];

export function FeatureSections() {
  return (
    <>
      <section className="section section-block stack-lg">
        <div className="stack-md">
          <span className="kicker">What you get</span>
          <h2 className="section-title">
            The factual read and the client-style message, side by side.
          </h2>
          <p className="section-copy">
            Metis splits every run into two views: the operator can verify the
            numbers, and the client gets a message that sounds like the person
            who runs the account actually wrote it.
          </p>
        </div>

        <div className="split-grid">
          <article className="surface-card surface-card--accent">
            <span className="surface-label">Operator view</span>
            <h3 className="text-3xl font-semibold uppercase tracking-tight">
              Numbers and notes you can stand behind.
            </h3>
            <p className="section-copy pt-4">
              Spend, CTR, CPM, CPC, cost per result — pulled from the Meta
              Insights API for the exact window. Plus an executive read of
              what changed, where the risk sits, and what to watch next.
            </p>
            <ul className="surface-list">
              <li>Top-line metrics pulled straight from Meta.</li>
              <li>Executive read, what changed, risks, and next actions.</li>
              <li>Honest empty states — never invented numbers.</li>
            </ul>
          </article>

          <article className="surface-card surface-card--muted">
            <span className="surface-label bg-[var(--accent-3)]">Client view</span>
            <h3 className="text-3xl font-semibold uppercase tracking-tight">
              A send-ready message in your voice.
            </h3>
            <p className="section-copy pt-4">
              Drop in past client updates or team messages once. Metis mirrors
              your structure, phrasing, and tone on every future report — so
              the final message reads like you wrote it, not like a model.
            </p>
            <ul className="surface-list">
              <li>Mirrors the writing style of your past updates.</li>
              <li>Save tone presets and reuse them across runs.</li>
              <li>One-click copy into Slack, email, or a doc.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="section section-block stack-lg">
        <div className="accent-rule" aria-hidden="true" />
        <div className="benefits-grid">
          {benefitCards.map((card) => (
            <article key={card.title} className="surface-card">
              <span className="eyebrow-label">Why it matters</span>
              <h3 className="text-2xl font-semibold uppercase tracking-tight">
                {card.title}
              </h3>
              <p className="section-copy pt-3">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-block stack-lg">
        <div className="stack-md">
          <span className="kicker">How it works</span>
          <h2 className="section-title">
            Three steps from connection to copy-and-paste.
          </h2>
        </div>

        <div className="steps-grid">
          {steps.map((step, index) => (
            <article key={step.title} className="step-card stack-sm">
              <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="text-2xl font-semibold uppercase tracking-tight">
                {step.title}
              </h3>
              <p className="section-copy">{step.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

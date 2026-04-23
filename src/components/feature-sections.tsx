const benefitCards = [
  {
    title: "Faster planning",
    body: "Start from a structured strategic draft instead of rebuilding campaign thinking from scratch every time.",
  },
  {
    title: "Sharper messaging",
    body: "Anchor campaign direction in the company’s positioning, tone, and objective instead of generic prompts.",
  },
  {
    title: "Cleaner reporting",
    body: "Turn reporting inputs into summaries teams can actually review, share, and build on with confidence.",
  },
];

const steps = [
  {
    title: "Start with the real brief",
    body: "Provide the company context, campaign objective, and the level of support needed so the output has the right frame from the start.",
  },
  {
    title: "Generate the working draft",
    body: "Get campaign analysis, messaging direction, and strategic structure the team can refine instead of invent.",
  },
  {
    title: "Review performance clearly",
    body: "Turn reporting inputs into concise summaries that make next steps easier for operators and stakeholders.",
  },
];

export function FeatureSections() {
  return (
    <>
      <section className="section section-block stack-lg">
        <div className="stack-md">
          <span className="kicker">What The Product Covers</span>
          <h2 className="section-title">
            Built around the two workflows that usually slow teams down most.
          </h2>
          <p className="section-copy">
            Metis AI is designed around campaign creation and campaign review:
            the work that typically gets scattered across docs, decks, chat
            threads, and spreadsheets.
          </p>
        </div>

        <div className="split-grid">
          <article className="surface-card surface-card--accent">
            <span className="surface-label">Campaign Builder</span>
            <h3 className="text-3xl font-semibold uppercase tracking-tight">
              Turn business context into a stronger campaign starting point.
            </h3>
            <p className="section-copy pt-4">
              Give the system the company context and campaign goal, then use
              the output as a better first draft for planning and creative work.
            </p>
            <ul className="surface-list">
              <li>Understands the company before recommending direction.</li>
              <li>Drafts messaging aligned to the campaign objective.</li>
              <li>Produces a strategy outline teams can refine quickly.</li>
            </ul>
          </article>

          <article className="surface-card surface-card--muted">
            <span className="surface-label bg-[var(--accent-3)]">Reporting</span>
            <h3 className="text-3xl font-semibold uppercase tracking-tight">
              Turn reporting inputs into clearer narrative summaries.
            </h3>
            <p className="section-copy pt-4">
              Use campaign history, reporting windows, and prior communication
              style to create updates that are easier to review internally or
              share outward.
            </p>
            <ul className="surface-list">
              <li>Frames the reporting period before summarizing what changed.</li>
              <li>Writes updates in a tone the team can reuse.</li>
              <li>Makes operator-to-stakeholder handoff cleaner.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="section section-block stack-lg">
        <div className="accent-rule" aria-hidden="true" />
        <div className="benefits-grid">
          {benefitCards.map((card) => (
            <article key={card.title} className="surface-card">
              <span className="eyebrow-label">Why It Matters</span>
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
          <span className="kicker">How It Works</span>
          <h2 className="section-title">
            A tighter path from campaign input to usable output.
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

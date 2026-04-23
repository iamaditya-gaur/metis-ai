import { WaitlistForm } from "@/components/waitlist-form";

const trustItems = [
  "Understands the business before it drafts the campaign.",
  "Builds strategy, messaging, and reporting from one brief.",
  "Helps lean performance teams move with more structure.",
];

const metrics = [
  {
    label: "Built for",
    value: "Teams",
    description: "Performance marketers and agency operators managing live accounts.",
  },
  {
    label: "Creates",
    value: "Drafts",
    description: "Strategy, messaging, and reporting structure from the same context.",
  },
  {
    label: "Reduces",
    value: "Prep",
    description: "Less blank-page planning before campaigns launch or reports go out.",
  },
  {
    label: "Access",
    value: "Early",
    description: "Join the waitlist to get launch updates and onboarding priority.",
  },
];

export function Hero() {
  return (
    <section className="section section-block">
      <div className="hero-grid">
        <div className="hero-card stack-lg p-6 md:p-8">
          <span className="kicker">Waitlist Open For Early Operators</span>
          <div className="stack-md">
            <h1 className="display-title">
              Strategy, copy, and reporting for Meta teams that need better
              output without more operational drag.
            </h1>
            <p className="section-copy">
              I&apos;m building Metis AI. It helps media buying teams turn brand
              context into sharper campaign plans, stronger creative direction,
              and clearer reporting without rebuilding the same process every
              week.
            </p>
          </div>

          <div className="eyebrow-grid">
            <div className="eyebrow-card">
              <span className="eyebrow-label">Built For</span>
              <p className="eyebrow-value">
                Media buyers, performance marketers, and small agency teams.
              </p>
            </div>
            <div className="eyebrow-card">
              <span className="eyebrow-label">Best Use</span>
              <p className="eyebrow-value">
                Campaign planning, creative development, and reporting handoffs.
              </p>
            </div>
          </div>

          <div className="trust-strip">
            {trustItems.map((item) => (
              <div key={item} className="trust-chip">
                {item}
              </div>
            ))}
          </div>
        </div>

        <WaitlistForm
          title="Get first access"
          description="Join the waitlist for early access, release updates, and the first onboarding invite."
          buttonLabel="Join The Waitlist"
          source="hero-form"
        />
      </div>

      <div className="metrics-grid pt-6">
        {metrics.map((metric) => (
          <article key={metric.label} className="metric-card">
            <span className="metric-number">{metric.value}</span>
            <strong className="eyebrow-label">{metric.label}</strong>
            <span className="metric-label">{metric.description}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

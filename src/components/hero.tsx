import Link from "next/link";

const trustItems = [
  "Numbers come straight from Meta — nothing invented.",
  "The message mirrors how you actually write to clients.",
  "Copy, paste, send — no editing pass needed.",
];

const metrics = [
  {
    label: "Built for",
    value: "Operators",
    description: "Solo media buyers, agency leads, and in-house performance teams.",
  },
  {
    label: "Replaces",
    value: "45 min",
    description: "The weekly rewrite of the same client recap from a blank doc.",
  },
  {
    label: "Returns",
    value: "Send-ready",
    description: "A client-style message you can paste into Slack or email immediately.",
  },
  {
    label: "Pricing",
    value: "Free",
    description: "Free while in early access. No card required to start.",
  },
];

export function Hero() {
  return (
    <section className="section section-block">
      <div className="hero-grid hero-grid--single">
        <div className="hero-card stack-lg p-6 md:p-8">
          <span className="kicker">Reporting for Meta operators</span>
          <div className="stack-md">
            <h1 className="display-title">
              Stop rewriting your Meta ads report every Friday night.
            </h1>
            <p className="section-copy">
              Connect your Meta account and Metis turns real campaign numbers
              into a client-ready update — written in your voice, not a
              template&apos;s. Grounded in your data, ready to send in seconds.
            </p>
          </div>

          <div className="hero-cta-row">
            <Link href="/signup" className="hero-cta hero-cta--primary">
              Get started — it&apos;s free
            </Link>
            <Link href="/login" className="hero-cta hero-cta--ghost">
              Sign in
            </Link>
          </div>

          <div className="trust-strip">
            {trustItems.map((item) => (
              <div key={item} className="trust-chip">
                {item}
              </div>
            ))}
          </div>
        </div>
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

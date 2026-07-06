import Link from "next/link";

import { Reveal } from "@/components/reveal";

const trustItems = [
  "Numbers come straight from Meta — nothing invented.",
  "The message mirrors how you actually write to clients.",
  "Copy, paste, send — no editing pass needed.",
];

const metrics = [
  {
    label: "Built for",
    value: "Media buyers",
    description: "Solo buyers, agency leads, and in-house performance teams.",
  },
  {
    label: "Replaces",
    value: "45 min",
    description: "The same recap rewritten from a blank doc — weekly, monthly, whatever your cadence.",
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
          <span className="kicker fx-load fx-d1">
            Meta ads reporting, minus the rewrite
          </span>
          <div className="stack-md">
            <h1 className="display-title fx-load fx-load--stamp fx-d2">
              Never write the same ads report from scratch again.
            </h1>
            <p className="section-copy fx-load fx-d3">
              Connect your Meta account and Metis turns real campaign numbers
              into a send-ready update for your clients — or your own brand.
              Written in your voice, not a template&apos;s, and ready in
              seconds.
            </p>
          </div>

          <div className="hero-cta-row fx-load fx-d4">
            <Link href="/signup" className="hero-cta hero-cta--primary">
              Get started — it&apos;s free
            </Link>
            <Link href="/login" className="hero-cta hero-cta--ghost">
              Sign in
            </Link>
          </div>

          <div className="trust-strip fx-load fx-d5">
            {trustItems.map((item) => (
              <div key={item} className="trust-chip">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="metrics-grid pt-6">
        {metrics.map((metric, index) => (
          <Reveal
            as="article"
            key={metric.label}
            className="metric-card"
            delay={index * 80}
          >
            <strong className="eyebrow-label">{metric.label}</strong>
            <span className="metric-number">{metric.value}</span>
            <span className="metric-label">{metric.description}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

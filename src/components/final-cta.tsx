import Link from "next/link";

import { Reveal } from "@/components/reveal";

export function FinalCta() {
  return (
    <section className="section section-block pb-10">
      <Reveal className="cta-panel cta-panel--final">
        <div className="stack-md">
          <span className="kicker">Ready when you are</span>
          <h2 className="section-title">
            Stop rewriting the same update, report after report.
          </h2>
          <p className="section-copy">
            Connect a Meta account, drop in a few past updates, and Metis
            handles the recap from here on out. Free while in early access.
          </p>
        </div>

        <div className="cta-actions">
          <Link href="/signup" className="hero-cta hero-cta--primary">
            Get started — it&apos;s free
          </Link>
          <Link href="/login" className="hero-cta hero-cta--ghost">
            I already have an account
          </Link>
        </div>

        <p className="footer-note">
          No card required. You can connect a Meta account whenever you&apos;re
          ready.
        </p>
      </Reveal>
    </section>
  );
}

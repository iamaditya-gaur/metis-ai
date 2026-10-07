import Link from "next/link";

import { Reveal } from "@/components/reveal";

type FinalCtaProps = {
  /** Accounts paused: the CTA opens the invite-only tool instead of sign-up. */
  paused?: boolean;
};

export function FinalCta({ paused = false }: FinalCtaProps) {
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
          {paused ? (
            <Link href="/reporting" className="hero-cta hero-cta--primary">
              Open Metis
            </Link>
          ) : (
            <>
              <Link href="/signup" className="hero-cta hero-cta--primary">
                Get started — it&apos;s free
              </Link>
              <Link href="/login" className="hero-cta hero-cta--ghost">
                I already have an account
              </Link>
            </>
          )}
        </div>

        <p className="footer-note">
          {paused
            ? "Invite-only right now — you'll need an access code."
            : "No card required. You can connect a Meta account whenever you're ready."}
        </p>
      </Reveal>
    </section>
  );
}

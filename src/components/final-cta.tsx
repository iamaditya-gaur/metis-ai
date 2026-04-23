import { WaitlistForm } from "@/components/waitlist-form";

export function FinalCta() {
  return (
    <section className="section section-block pb-10">
      <div className="cta-panel footer-grid">
        <div className="stack-md">
          <span className="kicker">Join The Waitlist</span>
          <h2 className="section-title">
            If Meta is a serious growth channel for your team, Metis AI is
            worth getting in front of early.
          </h2>
          <p className="section-copy">
            Early access is for teams that want a more disciplined planning and
            reporting workflow before that process turns into another internal
            mess.
          </p>
          <p className="footer-note">
            Early updates include product access timing, setup notes, and
            launch announcements.
          </p>
        </div>

        <WaitlistForm
          title="Claim early access"
          description="Enter your work email to get product updates and the first onboarding invitation."
          buttonLabel="Join The Waitlist"
          source="footer-form"
        />
      </div>
    </section>
  );
}

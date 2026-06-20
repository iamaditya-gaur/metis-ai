import Link from "next/link";

/**
 * Conversion card rendered on the public /reporting demo after a report
 * successfully generates. Pushes the demo user toward sign-up so their next
 * report is one click away.
 */
export function SignUpNudge() {
  return (
    <aside className="signup-nudge" aria-label="Save this report by signing up">
      <div className="signup-nudge-copy">
        <span className="product-eyebrow">Save your work</span>
        <h3 className="signup-nudge-title">
          Next time, your token and your tone are already saved.
        </h3>
        <p className="product-help">
          Create a free account to keep this report in your history, save your
          Meta connection so you don&apos;t paste a token again, and pick up
          where you left off on any device.
        </p>
      </div>
      <div className="signup-nudge-actions">
        <Link href="/signup" className="product-button">
          Create a free account
        </Link>
        <Link
          href="/login"
          className="product-button"
          data-variant="secondary"
        >
          I already have one
        </Link>
      </div>
    </aside>
  );
}

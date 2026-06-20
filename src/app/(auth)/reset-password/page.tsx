import Link from "next/link";

import { ResetForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <>
      <header className="auth-card-header">
        <p className="product-eyebrow">Reset password</p>
        <h1 className="auth-card-title">Send me a reset link.</h1>
        <p className="auth-card-copy">
          Enter the email tied to your account. We&rsquo;ll send a one-click
          link to set a new password.
        </p>
      </header>
      <ResetForm />
      <footer className="auth-card-footer">
        <Link href="/login" className="auth-link auth-link-strong">
          Back to sign in
        </Link>
      </footer>
    </>
  );
}

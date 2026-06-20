import Link from "next/link";

import { SignUpForm } from "./signup-form";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function SignUpPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <>
      <header className="auth-card-header">
        <p className="product-eyebrow">Create your account</p>
        <h1 className="auth-card-title">Reporting that sounds like you.</h1>
        <p className="auth-card-copy">
          Save your Meta connections once, then turn any reporting window into
          a client-ready update in seconds. Free while in early access.
        </p>
      </header>
      <SignUpForm next={next} />
      <footer className="auth-card-footer">
        <span>
          Already have an account?{" "}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="auth-link auth-link-strong">
            Sign in
          </Link>
        </span>
      </footer>
    </>
  );
}

import Link from "next/link";

import { LoginForm } from "./login-form";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <>
      <header className="auth-card-header">
        <p className="product-eyebrow">Sign in</p>
        <h1 className="auth-card-title">Welcome back to Metis.</h1>
        <p className="auth-card-copy">
          Use the email you signed up with. Your saved connections and run
          history pick up where you left off.
        </p>
      </header>
      <LoginForm next={next} />
      <footer className="auth-card-footer">
        <Link href="/reset-password" className="auth-link">
          Forgot your password?
        </Link>
        <span className="auth-card-footer-sep" aria-hidden>•</span>
        <span>
          New here?{" "}
          <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="auth-link auth-link-strong">
            Create an account
          </Link>
        </span>
      </footer>
    </>
  );
}

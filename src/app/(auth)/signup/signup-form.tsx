"use client";

import { useActionState } from "react";

import { signUpAction, type AuthFormState } from "../actions";

const INITIAL: AuthFormState = { status: "idle" };

export function SignUpForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(signUpAction, INITIAL);

  if (state.status === "success") {
    return (
      <div className="auth-feedback auth-feedback-success" role="status">
        <p className="auth-feedback-title">Check your inbox.</p>
        <p>{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="next" value={next ?? "/app/reports"} />

      <div className="product-field">
        <label className="product-label" htmlFor="auth-email">
          Email
        </label>
        <input
          id="auth-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className="product-input"
          placeholder="you@yourcompany.com"
        />
      </div>

      <div className="product-field">
        <label className="product-label" htmlFor="auth-password">
          Password
        </label>
        <input
          id="auth-password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="product-input"
          placeholder="At least 8 characters"
        />
        <p className="product-help">
          Pick something you can remember. You can change it later in Settings.
        </p>
      </div>

      {state.status === "error" ? (
        <p className="auth-feedback auth-feedback-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        className="product-button"
        data-loading={isPending ? "true" : undefined}
        disabled={isPending}
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

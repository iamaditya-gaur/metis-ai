"use client";

import { useActionState } from "react";

import { signInAction, type AuthFormState } from "../actions";

const INITIAL: AuthFormState = { status: "idle" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(signInAction, INITIAL);

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
          autoComplete="current-password"
          minLength={8}
          className="product-input"
          placeholder="At least 8 characters"
        />
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
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

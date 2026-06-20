"use client";

import { useActionState } from "react";

import { resetPasswordAction, type AuthFormState } from "../actions";

const INITIAL: AuthFormState = { status: "idle" };

export function ResetForm() {
  const [state, formAction, isPending] = useActionState(
    resetPasswordAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="auth-form">
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

      {state.status === "error" ? (
        <p className="auth-feedback auth-feedback-error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="auth-feedback auth-feedback-success" role="status">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        className="product-button"
        data-loading={isPending ? "true" : undefined}
        disabled={isPending}
      >
        {isPending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

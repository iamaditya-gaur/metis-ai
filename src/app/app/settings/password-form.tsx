"use client";

import { useActionState } from "react";

import { updatePasswordAction } from "./actions";
import type { AuthFormState } from "@/app/(auth)/actions";

const INITIAL: AuthFormState = { status: "idle" };

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState(
    updatePasswordAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="auth-form">
      <div className="product-field">
        <label className="product-label" htmlFor="settings-password">
          New password
        </label>
        <input
          id="settings-password"
          name="new_password"
          type="password"
          required
          autoComplete="new-password"
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
        {isPending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

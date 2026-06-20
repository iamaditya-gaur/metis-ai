"use client";

import { useActionState } from "react";

import { updateProfileAction } from "./actions";
import type { AuthFormState } from "@/app/(auth)/actions";

const INITIAL: AuthFormState = { status: "idle" };

export function ProfileForm({ defaultFullName }: { defaultFullName: string }) {
  const [state, formAction, isPending] = useActionState(
    updateProfileAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="auth-form">
      <div className="product-field">
        <label className="product-label" htmlFor="settings-name">
          Full name
        </label>
        <input
          id="settings-name"
          name="full_name"
          type="text"
          required
          maxLength={120}
          defaultValue={defaultFullName}
          className="product-input"
          placeholder="e.g. Aditya Gaur"
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
        {isPending ? "Saving…" : "Save name"}
      </button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";

import { addConnectionAction, type AddConnectionResult } from "@/app/app/connections/actions";
import { MetaTokenGuide } from "@/components/meta-token-guide";

const INITIAL: AddConnectionResult = { status: "idle" };

export function AddConnectionForm() {
  const [state, formAction, isPending] = useActionState(
    addConnectionAction,
    INITIAL,
  );
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <>
      <form action={formAction} className="connections-add-form">
        <div className="product-field">
          <label className="product-label" htmlFor="connection-label">
            Label
          </label>
          <input
            id="connection-label"
            name="label"
            type="text"
            required
            maxLength={80}
            className="product-input"
            placeholder="e.g. Acme client, Personal, Client B"
          />
        </div>

        <div className="product-field">
          <label className="product-label" htmlFor="connection-token">
            Meta access token
          </label>
          <textarea
            id="connection-token"
            name="token"
            required
            spellCheck={false}
            className="product-textarea reporting-token-input"
            placeholder="EAAB..."
          />
          <p className="product-help">
            Need a token?{" "}
            <button
              type="button"
              className="auth-link auth-link-strong"
              onClick={() => setIsGuideOpen(true)}
            >
              Open the step-by-step guide
            </button>
            . Metis verifies it before saving.
          </p>
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
          {isPending ? "Verifying with Meta…" : "Save connection"}
        </button>
      </form>

      <MetaTokenGuide
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </>
  );
}

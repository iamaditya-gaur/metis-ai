"use client";

import { useActionState, useState } from "react";

import type { LlmKeySummary } from "@/lib/llm-keys/store";
import {
  deleteLlmKeyAction,
  saveManualKeyAction,
  type LlmKeyFormResult,
} from "@/app/app/settings/actions";

const INITIAL: LlmKeyFormResult = { status: "idle" };

/**
 * The connect surface — reused for first-time connect and for replacing an
 * existing key. One-click OpenRouter (opens in a new tab so the user keeps
 * their place here), plus a manual paste for either provider.
 */
function ConnectOptions() {
  const [state, formAction, isPending] = useActionState(saveManualKeyAction, INITIAL);

  return (
    <div className="llm-key-connect">
      <a
        className="product-button"
        href="/api/llm-keys/openrouter/start"
        target="_blank"
        rel="noopener noreferrer"
      >
        Connect OpenRouter (one click)
      </a>
      <form action={formAction} className="auth-form">
        <div className="product-field">
          <label className="product-label" htmlFor="llm-provider">
            Or paste an API key
          </label>
          <select
            id="llm-provider"
            name="provider"
            className="product-input"
            defaultValue="openrouter"
          >
            <option value="openrouter">OpenRouter key</option>
            <option value="openai">OpenAI key</option>
          </select>
        </div>
        <div className="product-field">
          <label className="product-label" htmlFor="llm-key">
            API key
          </label>
          <input
            id="llm-key"
            name="apiKey"
            type="password"
            autoComplete="off"
            className="product-input"
            placeholder="sk-…"
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
          {isPending ? "Checking…" : "Save key"}
        </button>
      </form>
    </div>
  );
}

type Props = {
  summary: LlmKeySummary | null;
  savedFlash: boolean;
  errorFlash: string | null;
};

export function LlmKeyCard({ summary, savedFlash, errorFlash }: Props) {
  const [showReplace, setShowReplace] = useState(false);

  if (summary) {
    return (
      <div className="llm-key-card">
        {savedFlash ? (
          <p className="auth-feedback auth-feedback-success" role="status">
            AI key connected.
          </p>
        ) : null}
        <p className="llm-key-status">
          <strong>{summary.provider === "openrouter" ? "OpenRouter" : "OpenAI"}</strong> key ending
          in <span className="llm-key-last4">···· {summary.lastFour}</span>
          {summary.lastValidatedAt ? (
            <span className="llm-key-verified">
              {" "}
              · verified {new Date(summary.lastValidatedAt).toLocaleDateString()}
            </span>
          ) : null}
        </p>
        <div className="llm-key-actions">
          <button
            type="button"
            className="product-button"
            data-variant="secondary"
            onClick={() => setShowReplace((open) => !open)}
            aria-expanded={showReplace}
          >
            {showReplace ? "Cancel" : "Replace key"}
          </button>
          <form action={deleteLlmKeyAction}>
            <button type="submit" className="product-button" data-variant="secondary">
              Remove key
            </button>
          </form>
        </div>
        <div className="llm-key-replace-wrap" data-open={showReplace}>
          <div className="llm-key-replace-inner" inert={!showReplace}>
            <div className="llm-key-replace">
              <p className="product-help">
                Connect a different account or paste a new key — it replaces the current one. Use
                this if your key stopped working.
              </p>
              <ConnectOptions />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="llm-key-card">
      {errorFlash ? (
        <p className="auth-feedback auth-feedback-error" role="alert">
          {errorFlash}
        </p>
      ) : null}
      <p className="product-help">
        Reports run on your own AI account — we never bill your usage to a shared key.
      </p>
      <ConnectOptions />
    </div>
  );
}

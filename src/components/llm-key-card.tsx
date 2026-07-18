"use client";

import { useActionState } from "react";

import type { LlmKeySummary } from "@/lib/llm-keys/store";
import {
  deleteLlmKeyAction,
  saveOpenAiKeyAction,
  type LlmKeyFormResult,
} from "@/app/app/settings/actions";

const INITIAL: LlmKeyFormResult = { status: "idle" };

type Props = {
  summary: LlmKeySummary | null;
  savedFlash: boolean;
  errorFlash: string | null;
};

export function LlmKeyCard({ summary, savedFlash, errorFlash }: Props) {
  const [state, formAction, isPending] = useActionState(saveOpenAiKeyAction, INITIAL);

  if (summary) {
    return (
      <div className="llm-key-card">
        {savedFlash ? (
          <p className="auth-feedback auth-feedback-success" role="status">
            AI key connected.
          </p>
        ) : null}
        <p className="product-help">
          <strong>{summary.provider === "openrouter" ? "OpenRouter" : "OpenAI"}</strong> key
          ending in <code className="product-code">···· {summary.lastFour}</code>
          {summary.lastValidatedAt
            ? ` · verified ${new Date(summary.lastValidatedAt).toLocaleDateString()}`
            : null}
        </p>
        <form action={deleteLlmKeyAction}>
          <button type="submit" className="product-button" data-variant="secondary">
            Remove key
          </button>
        </form>
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
        Reports run on your own AI account — we never bill your usage to a shared key. Connect one
        of:
      </p>
      <a className="product-button" href="/api/llm-keys/openrouter/start">
        Connect OpenRouter (one click)
      </a>
      <form action={formAction} className="auth-form">
        <div className="product-field">
          <label className="product-label" htmlFor="openai-key">
            Or paste an OpenAI API key
          </label>
          <input
            id="openai-key"
            name="apiKey"
            type="password"
            autoComplete="off"
            className="product-input"
            placeholder="sk-..."
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
          {isPending ? "Checking…" : "Save OpenAI key"}
        </button>
      </form>
    </div>
  );
}

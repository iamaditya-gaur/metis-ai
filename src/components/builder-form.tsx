"use client";

import { useMemo, useState } from "react";

import { GlassPanel } from "@/components/glass-panel";
import type {
  AccountOption,
  BuilderPreviewRequest,
  BuilderPreviewResponse,
  BuilderSupportLevel,
} from "@/lib/metis/types";

type BuilderFormProps = {
  accounts: AccountOption[];
  isPending: boolean;
  previewResult: BuilderPreviewResponse | null;
  onPreview: (payload: BuilderPreviewRequest) => void;
};

export function BuilderForm({
  accounts,
  isPending,
  previewResult,
  onPreview,
}: BuilderFormProps) {
  const builderDefault = accounts.find((account) => account.role === "builder-default") ?? accounts[0];
  const [accountId, setAccountId] = useState(builderDefault?.id ?? "");
  const [brandUrl, setBrandUrl] = useState("https://metis-ai-nine.vercel.app");
  const [objective, setObjective] = useState("LEADS");
  const [supportLevel, setSupportLevel] = useState<BuilderSupportLevel>("full-campaign");
  const [userNotes, setUserNotes] = useState(
    "Keep the launch framing clean, conversion-focused, and safe for paused-only drafts.",
  );

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accountId, accounts],
  );
  const showSwitchWarning = Boolean(
    selectedAccount && selectedAccount.role !== "builder-default",
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onPreview({
      accountId,
      brandUrl,
      objective,
      supportLevel,
      userNotes,
    });
  };

  return (
    <GlassPanel
      eyebrow="Inputs"
      title="Preview builder output"
      description="Keep the draft-safe default account explicit, then generate strategy, copy, and draft payloads before any Meta write."
    >
      <form className="product-field-grid" onSubmit={handleSubmit}>
        <div className="product-field">
          <label className="product-label" htmlFor="builder-account">
            Builder account
          </label>
          <div className="product-select-wrap">
            <select
              id="builder-account"
              className="product-select"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
            <span className="product-select-indicator" aria-hidden="true" />
          </div>
          <p className="product-help">Builder should default to Adi personal. Switching away should trigger a warning before any write action is allowed.</p>
        </div>

        {showSwitchWarning ? (
          <div className="product-warning">
            Builder is no longer on the draft-safe default account. Review the target carefully before any write.
          </div>
        ) : (
          <div className="product-success">
            Draft creation remains paused-only. No live campaigns are updated and no status moves to ACTIVE.
          </div>
        )}

        {previewResult?.builderAccountWarning ? (
          <div className="product-warning">{previewResult.builderAccountWarning}</div>
        ) : null}

        <div className="product-field">
          <label className="product-label" htmlFor="brand-url">
            Brand URL
          </label>
          <input
            id="brand-url"
            className="product-input"
            type="url"
            value={brandUrl}
            onChange={(event) => setBrandUrl(event.target.value)}
          />
        </div>

        <div className="product-grid product-grid--two">
          <div className="product-field">
            <label className="product-label" htmlFor="objective">
              Objective
            </label>
            <div className="product-select-wrap">
              <select
                id="objective"
                className="product-select"
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
              >
                <option value="AWARENESS">AWARENESS</option>
                <option value="LEADS">LEADS</option>
                <option value="SALES">SALES</option>
              </select>
              <span className="product-select-indicator" aria-hidden="true" />
            </div>
          </div>

          <div className="product-field">
            <label className="product-label" htmlFor="support-level">
              Support level
            </label>
            <div className="product-select-wrap">
              <select
                id="support-level"
                className="product-select"
                value={supportLevel}
                onChange={(event) =>
                  setSupportLevel(event.target.value as BuilderSupportLevel)
                }
              >
                <option value="full-campaign">full-campaign</option>
                <option value="strategy-only">strategy-only</option>
                <option value="copy-only">copy-only</option>
              </select>
              <span className="product-select-indicator" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="product-field">
          <label className="product-label" htmlFor="builder-notes">
            Operator notes
          </label>
          <textarea
            id="builder-notes"
            className="product-textarea"
            value={userNotes}
            onChange={(event) => setUserNotes(event.target.value)}
          />
        </div>

        <div className="product-button-row">
          <button type="submit" className="product-button" disabled={isPending}>
            {isPending ? "Generating preview..." : "Preview builder output"}
          </button>
        </div>
      </form>
    </GlassPanel>
  );
}

import { GlassPanel } from "@/components/glass-panel";
import { StatusPill } from "@/components/status-pill";
import type { BuilderDraftCreateResponse, BuilderDraftMode } from "@/lib/metis/types";

const checks = [
  "Draft target account is visible and correct.",
  "Requested status remains PAUSED.",
  "Campaign naming prefix matches the locked convention.",
  "No live object IDs or ACTIVE writes appear in the payload.",
];

type DraftReviewChecklistProps = {
  previewReady: boolean;
  writeReady: boolean;
  isPending: boolean;
  draftMode: BuilderDraftMode;
  builderAccountWarning: string | null;
  createResult: BuilderDraftCreateResponse | null;
  createError: string;
  previewWarnings: string[];
  onCreate: () => void;
};

export function DraftReviewChecklist({
  previewReady,
  writeReady,
  isPending,
  draftMode,
  builderAccountWarning,
  createResult,
  createError,
  previewWarnings,
  onCreate,
}: DraftReviewChecklistProps) {
  return (
    <GlassPanel
      eyebrow="Write Gate"
      title="Review required before write"
      description="Use a checklist gate so the builder flow stays safe. Planning-only support levels should still surface a useful draft handoff without pretending the write path is ready."
      actions={
        createResult ? (
          <StatusPill label="Draft created" tone="success" />
        ) : draftMode === "validated" ? (
          <StatusPill label="Write-ready" tone="success" />
        ) : draftMode === "blocked" ? (
          <StatusPill label="Blocked" tone="warning" />
        ) : (
          <StatusPill label="Planning only" tone="neutral" />
        )
      }
    >
      <div className="product-list">
        {checks.map((check) => (
          <article key={check} className="product-list-item">
            <strong>{check}</strong>
          </article>
        ))}
      </div>

      {builderAccountWarning ? <div className="product-warning">{builderAccountWarning}</div> : null}
      {previewWarnings.map((warning) => (
        <div key={warning} className="product-warning">
          {warning}
        </div>
      ))}
      {createError ? <div className="product-warning">{createError}</div> : null}
      {createResult ? (
        <div className="product-success">
          Paused campaign draft created on {createResult.accountLabel}. Campaign ID:{" "}
          {createResult.createdCampaignId ?? "not returned"}.
        </div>
      ) : draftMode !== "validated" ? (
        <div className="product-help">
          This support level or current site state is not producing a write-ready draft payload. Use the draft spec tab as an operator handoff and only move to write when the preview becomes write-ready.
        </div>
      ) : null}

      <div className="product-button-row">
        <button
          type="button"
          className="product-button"
          disabled={!previewReady || !writeReady || isPending}
          onClick={onCreate}
        >
          {isPending ? "Creating paused drafts..." : "Create paused drafts"}
        </button>
        <button type="button" className="product-button" data-variant="secondary" disabled>
          Hold at preview
        </button>
      </div>
    </GlassPanel>
  );
}

"use client";

import { useState, useTransition } from "react";

import { BuilderForm } from "@/components/builder-form";
import { BuilderOutputTabs } from "@/components/builder-output-tabs";
import { DraftReviewChecklist } from "@/components/draft-review-checklist";
import type {
  AccountOption,
  BuilderDraftCreateResponse,
  BuilderPreviewRequest,
  BuilderPreviewResponse,
} from "@/lib/metis/types";

type BuilderWorkspaceProps = {
  accounts: AccountOption[];
};

export function BuilderWorkspace({ accounts }: BuilderWorkspaceProps) {
  const [previewResult, setPreviewResult] = useState<BuilderPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [createResult, setCreateResult] = useState<BuilderDraftCreateResponse | null>(null);
  const [createError, setCreateError] = useState("");
  const [previewPending, startPreview] = useTransition();
  const [createPending, startCreate] = useTransition();

  const handlePreview = (payload: BuilderPreviewRequest) => {
    startPreview(async () => {
      setPreviewError("");
      setCreateError("");
      setCreateResult(null);

      try {
        const response = await fetch("/api/metis/builder/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const body = (await response.json()) as BuilderPreviewResponse & { message?: string };

        if (!response.ok) {
          throw new Error(body.message ?? "Builder preview failed.");
        }

        setPreviewResult(body);
      } catch (runError) {
        setPreviewResult(null);
        setPreviewError(runError instanceof Error ? runError.message : "Builder preview failed.");
      }
    });
  };

  const handleCreate = () => {
    if (!previewResult?.validatedDrafts) {
      return;
    }

    startCreate(async () => {
      setCreateError("");

      try {
        const response = await fetch("/api/metis/builder/drafts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountId: previewResult.accountId,
            validatedDrafts: previewResult.validatedDrafts,
            reviewConfirmed: true,
          }),
        });
        const body = (await response.json()) as BuilderDraftCreateResponse & { message?: string };

        if (!response.ok) {
          throw new Error(body.message ?? "Draft creation failed.");
        }

        setCreateResult(body);
      } catch (runError) {
        setCreateResult(null);
        setCreateError(runError instanceof Error ? runError.message : "Draft creation failed.");
      }
    });
  };

  return (
    <>
      <div className="product-grid product-grid--two">
        <BuilderForm
          accounts={accounts}
          isPending={previewPending}
          previewResult={previewResult}
          onPreview={handlePreview}
        />
        <BuilderOutputTabs
          error={previewError}
          isPending={previewPending}
          result={previewResult}
        />
      </div>

      <DraftReviewChecklist
        builderAccountWarning={previewResult?.builderAccountWarning ?? null}
        createError={createError}
        createResult={createResult}
        draftMode={previewResult?.draftMode ?? "planning-only"}
        isPending={createPending}
        previewWarnings={previewResult?.previewWarnings ?? []}
        previewReady={Boolean(previewResult)}
        writeReady={Boolean(previewResult?.validatedDrafts)}
        onCreate={handleCreate}
      />
    </>
  );
}

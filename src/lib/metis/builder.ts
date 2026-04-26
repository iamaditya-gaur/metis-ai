import { randomUUID } from "node:crypto";

import {
  buildBrandBriefPromptInput,
  buildBuilderOutputPromptInput,
  generateBrandBrief,
  generateBuilderOutput,
} from "../../../scripts/pocs/lib/builder.mjs";
import {
  buildBrandResearchBundle,
  chooseHighSignalLinks,
  extractPageData,
  fetchPage,
} from "../../../scripts/pocs/lib/brand-research.mjs";
import { createPausedCampaignDraft, normalizeAdAccountId } from "../../../scripts/pocs/lib/meta-client.mjs";
import { writeStructuredRunLog } from "../../../scripts/pocs/lib/observability.mjs";
import { validateDraftLaunchSpec } from "../../../scripts/pocs/lib/draft-validation.mjs";

import { getAccountLabel } from "@/lib/metis/accounts";
import { getConfiguredAccountIds } from "@/lib/metis/env";
import type {
  BuilderDraftMode,
  BuilderDraftCreateRequest,
  BuilderDraftCreateResponse,
  BuilderPreviewRequest,
  BuilderPreviewResponse,
} from "@/lib/metis/types";

function getDraftMode(builderOutput: Record<string, unknown>, supportLevel: BuilderPreviewRequest["supportLevel"]): BuilderDraftMode {
  const draftLaunchSpec =
    builderOutput.draftLaunchSpec && typeof builderOutput.draftLaunchSpec === "object"
      ? (builderOutput.draftLaunchSpec as Record<string, unknown>)
      : null;
  const writeReadiness =
    draftLaunchSpec && typeof draftLaunchSpec.writeReadiness === "string"
      ? draftLaunchSpec.writeReadiness
      : "";

  if (supportLevel !== "full-campaign") {
    return "planning-only";
  }

  if (writeReadiness === "validated-ready") {
    return "validated";
  }

  if (writeReadiness === "blocked") {
    return "blocked";
  }

  return "planning-only";
}

function getPreviewWarnings({
  brandResearch,
  brandBrief,
  builderOutput,
  draftMode,
}: {
  brandResearch: Awaited<ReturnType<typeof collectBrandResearch>>;
  brandBrief: Record<string, unknown>;
  builderOutput: Record<string, unknown>;
  draftMode: BuilderDraftMode;
}) {
  const warnings = [...brandResearch.qualityNotes];
  const brandBriefMissingInputs = Array.isArray(brandBrief.missingInputs)
    ? brandBrief.missingInputs.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const draftLaunchSpec =
    builderOutput.draftLaunchSpec && typeof builderOutput.draftLaunchSpec === "object"
      ? (builderOutput.draftLaunchSpec as Record<string, unknown>)
      : null;
  const blockedReasons = Array.isArray(draftLaunchSpec?.blockedReasons)
    ? draftLaunchSpec.blockedReasons.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const missingAssets = Array.isArray(draftLaunchSpec?.missingAssets)
    ? draftLaunchSpec.missingAssets.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (draftMode !== "validated" && blockedReasons.length) {
    warnings.push(...blockedReasons);
  }

  if (brandBriefMissingInputs.length) {
    warnings.push(...brandBriefMissingInputs);
  }

  if (missingAssets.length) {
    warnings.push(`Missing assets: ${missingAssets.join(", ")}`);
  }

  return [...new Set(warnings)];
}

async function collectBrandResearch(brandUrl: string) {
  const queue = [brandUrl];
  const visitedUrls = new Set<string>();
  const pages: Array<ReturnType<typeof extractPageData>> = [];

  while (queue.length > 0 && pages.length < 5) {
    const currentUrl = queue.shift();

    if (!currentUrl || visitedUrls.has(currentUrl)) {
      continue;
    }

    visitedUrls.add(currentUrl);

    const response = await fetchPage(currentUrl);

    if (!response.ok || !response.contentType?.includes("text/html")) {
      continue;
    }

    const pageData = extractPageData(response.url, response.html);
    pages.push(pageData);

    const nextLinks = chooseHighSignalLinks(brandUrl, pageData, visitedUrls, 4);

    for (const nextLink of nextLinks) {
      if (!visitedUrls.has(nextLink) && !queue.includes(nextLink)) {
        queue.push(nextLink);
      }
    }
  }

  return buildBrandResearchBundle(pages, brandUrl);
}

export async function runBuilderPreview(
  input: BuilderPreviewRequest,
): Promise<BuilderPreviewResponse> {
  const startedAt = new Date().toISOString();
  const accountId = normalizeAdAccountId(input.accountId);
  const accountLabel = getAccountLabel(accountId);
  const brandResearch = await collectBrandResearch(input.brandUrl);

  const builderInputs = {
    brandUrl: input.brandUrl,
    objective: input.objective,
    supportLevel: input.supportLevel,
    userNotes: input.userNotes,
  };
  const brandBriefPromptInput = buildBrandBriefPromptInput({
    brandResearchEvidence: {
      bundle: brandResearch,
    },
    builderInputs,
  });
  const brandBriefResult = await generateBrandBrief(brandBriefPromptInput);
  const builderPromptInput = buildBuilderOutputPromptInput({
    brandBriefEvidence: {
      brandBrief: brandBriefResult.brandBrief,
    },
    brandResearchEvidence: {
      bundle: brandResearch,
    },
    builderInputs,
  });
  const builderOutputResult = await generateBuilderOutput(builderPromptInput);
  const draftMode = getDraftMode(builderOutputResult.builderOutput, input.supportLevel);
  const validatedDrafts =
    draftMode === "validated"
      ? validateDraftLaunchSpec(builderOutputResult.builderOutput)
      : null;
  const finishedAt = new Date().toISOString();
  const runId = `builder-${randomUUID()}`;
  const { draftAccountId } = getConfiguredAccountIds();
  const builderAccountWarning =
    draftAccountId && accountId !== draftAccountId
      ? "Builder is no longer pointed at the default draft-safe account. Review carefully before any write."
      : null;
  const previewWarnings = getPreviewWarnings({
    brandResearch,
    brandBrief: brandBriefResult.brandBrief,
    builderOutput: builderOutputResult.builderOutput,
    draftMode,
  });

  await writeStructuredRunLog({
    runId,
    flowType: "builder",
    status: "success",
    selectedAccountId: accountId,
    model: builderOutputResult.model,
    summary: builderOutputResult.builderOutput.campaignPlan?.summary ?? "Builder preview generated.",
    startedAt,
    finishedAt,
    agentSteps: [
      {
        step: "brand-research",
        status: "success",
        pagesCrawled: brandResearch.pagesCrawled,
      },
      {
        step: "brand-brief",
        status: "success",
        model: brandBriefResult.model,
      },
      {
        step: "builder-output",
        status: "success",
        model: builderOutputResult.model,
        supportLevel: input.supportLevel,
      },
      {
        step: "draft-validation",
        status: draftMode === "validated" ? "success" : draftMode === "blocked" ? "blocked" : "skipped",
        draftMode,
      },
    ],
    toolCalls: [
      {
        tool: "brand-research",
        brandUrl: input.brandUrl,
        pagesCrawled: brandResearch.pagesCrawled,
      },
      {
        tool: "openrouter-brand-brief",
        model: brandBriefResult.model,
      },
      {
        tool: "openrouter-builder-output",
        model: builderOutputResult.model,
        supportLevel: input.supportLevel,
      },
    ],
    artifacts: [
      {
        kind: "brand-research",
        startUrl: brandResearch.startUrl,
        pagesCrawled: brandResearch.pagesCrawled,
      },
      {
        kind: "builder-output",
        builderOutput: builderOutputResult.builderOutput,
        draftMode,
        previewWarnings,
      },
    ],
  });

  return {
    runId,
    model: builderOutputResult.model,
    accountId,
    accountLabel,
    supportLevel: input.supportLevel,
    draftMode,
    brandResearch: {
      startUrl: brandResearch.startUrl,
      pagesCrawled: brandResearch.pagesCrawled,
      qualityNotes: brandResearch.qualityNotes,
      enoughSignal: brandResearch.enoughSignal,
    },
    brandBrief: brandBriefResult.brandBrief,
    builderOutput: builderOutputResult.builderOutput,
    validatedDrafts,
    previewWarnings,
    builderAccountWarning,
  };
}

export async function createBuilderDrafts(
  input: BuilderDraftCreateRequest,
): Promise<BuilderDraftCreateResponse> {
  if (!input.reviewConfirmed) {
    throw new Error("Draft creation is blocked until the review checklist is confirmed.");
  }

  if (!input.validatedDrafts?.campaignPayload) {
    throw new Error("Draft creation is only available when a write-ready paused draft payload exists.");
  }

  const accountId = normalizeAdAccountId(input.accountId);
  const { draftAccountId } = getConfiguredAccountIds();
  const builderAccountWarning =
    draftAccountId && accountId !== draftAccountId
      ? "Builder is writing outside the default draft-safe account."
      : null;
  const result = await createPausedCampaignDraft({
    accountId,
    campaignDraft: input.validatedDrafts.campaignPayload,
  });

  return {
    accountId,
    accountLabel: getAccountLabel(accountId),
    builderAccountWarning,
    apiStatus: result.status,
    createdCampaignId: typeof result.payload?.id === "string" ? result.payload.id : null,
    responsePayload:
      result.payload && typeof result.payload === "object"
        ? (result.payload as Record<string, unknown>)
        : {},
  };
}

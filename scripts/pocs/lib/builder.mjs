import { readJsonFile } from "./reporting.mjs";
import { requestOpenRouterJson } from "./llm.mjs";
import { ACCOUNT_LABELS, resolveDraftAccountId } from "./accounts.mjs";

function ensureArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function ensureString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function ensureNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCopyVariant(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const variant = {
    angle: ensureString(value.angle),
    primaryText: ensureString(value.primaryText),
    headline: ensureString(value.headline),
    description: ensureString(value.description),
    cta: ensureString(value.cta),
  };

  return variant.angle || variant.primaryText || variant.headline || variant.description || variant.cta
    ? variant
    : null;
}

function normalizeDraftEntity(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const normalized = {};

  for (const [key, rawValue] of Object.entries(value)) {
    if (Array.isArray(rawValue)) {
      const items = rawValue
        .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
        .filter(Boolean);

      if (items.length) {
        normalized[key] = items;
      }

      continue;
    }

    if (typeof rawValue === "number") {
      normalized[key] = rawValue;
      continue;
    }

    const cleaned = ensureString(rawValue);

    if (cleaned) {
      normalized[key] = cleaned;
    }
  }

  return Object.keys(normalized).length ? normalized : null;
}

function normalizeMeasurementPlan(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        metric: ensureString(item?.metric),
        reason: ensureString(item?.reason),
      }))
      .filter((item) => item.metric && item.reason);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const entries = [];

  const primaryConversion = ensureString(value.primaryConversion);
  if (primaryConversion) {
    entries.push({
      metric: "primaryConversion",
      reason: primaryConversion,
    });
  }

  for (const metric of ensureArray(value.secondaryConversions)) {
    entries.push({
      metric: "secondaryConversion",
      reason: metric,
    });
  }

  const testingApproach = ensureString(value.testingApproach);
  if (testingApproach) {
    entries.push({
      metric: "testingApproach",
      reason: testingApproach,
    });
  }

  for (const criterion of ensureArray(value.successCriteria)) {
    entries.push({
      metric: "successCriteria",
      reason: criterion,
    });
  }

  for (const note of ensureArray(value.trackingNotes)) {
    entries.push({
      metric: "trackingNotes",
      reason: note,
    });
  }

  return entries;
}

export function getBuilderInputsFromEnv() {
  return {
    brandUrl:
      process.env.BRAND_RESEARCH_URL?.trim() ||
      process.env.POC_BRAND_URL?.trim() ||
      "https://metis-ai-nine.vercel.app",
    objective:
      process.env.BUILDER_OBJECTIVE?.trim() ||
      process.env.POC_OBJECTIVE?.trim() ||
      "LEADS",
    supportLevel:
      process.env.BUILDER_SUPPORT_LEVEL?.trim() ||
      process.env.POC_SUPPORT_LEVEL?.trim() ||
      "full-campaign",
    userNotes: process.env.BUILDER_USER_NOTES?.trim() || "",
  };
}

export async function loadBrandResearchEvidence() {
  return readJsonFile("docs/sub-agents/poc-brand-research-evidence.json");
}

export async function loadBrandBriefEvidence() {
  return readJsonFile("docs/sub-agents/poc-brand-brief-evidence.json");
}

export function buildBrandBriefPromptInput({ brandResearchEvidence, builderInputs }) {
  return {
    brandUrl: builderInputs.brandUrl,
    objective: builderInputs.objective,
    supportLevel: builderInputs.supportLevel,
    userNotes: builderInputs.userNotes || null,
    brandResearch: brandResearchEvidence.bundle,
    constraints: [
      "Return valid JSON only.",
      "Do not invent unsupported facts or claims.",
      "Use only the extracted brand research bundle and explicit inputs.",
      "Call out missing information that would affect campaign quality.",
    ],
  };
}

export function validateBrandBrief(value) {
  if (!value || typeof value !== "object") {
    throw new Error("BrandBrief output was not a JSON object.");
  }

  return {
    positioning: ensureString(value.positioning),
    audience: ensureArray(value.audience),
    offer: ensureString(value.offer),
    productsOrServices: ensureArray(value.productsOrServices),
    tone: ensureArray(value.tone),
    differentiators: ensureArray(value.differentiators),
    claims: ensureArray(value.claims),
    missingInputs: ensureArray(value.missingInputs),
    risks: ensureArray(value.risks),
  };
}

export async function generateBrandBrief(promptInput) {
  const result = await requestOpenRouterJson({
    systemPrompt:
      "You are the Brand Strategist Agent for Metis AI. Use OpenRouter as the LLM gateway. Return valid JSON only with keys positioning, audience, offer, productsOrServices, tone, differentiators, claims, missingInputs, risks. Be specific, evidence-grounded, and do not invent unsupported claims.",
    userPayload: promptInput,
  });

  return {
    model: result.model,
    brandBrief: validateBrandBrief(result.data),
  };
}

export function buildBuilderOutputPromptInput({ brandBriefEvidence, builderInputs }) {
  return {
    brandUrl: builderInputs.brandUrl,
    objective: builderInputs.objective,
    supportLevel: builderInputs.supportLevel,
    selectedAccountId: resolveDraftAccountId(),
    selectedAccountLabel: ACCOUNT_LABELS.draft,
    availableAssets: {
      metaPage: "unknown",
      instagramAccount: "unknown",
      pixel: "unknown",
    },
    brandBrief: brandBriefEvidence.brandBrief,
    outputRequirements: {
      campaignPlan: {
        requiredKeys: [
          "summary",
          "primaryGoal",
          "offerStrategy",
          "funnelStages",
          "measurementPlan",
        ],
        funnelStages: {
          minimumCount: 3,
          requiredStageLabels: ["TOF", "MOF", "BOF"],
          requiredKeysPerStage: [
            "stage",
            "angle",
            "audienceSegment",
            "messagePillars",
            "creativeDirections",
          ],
        },
      },
      copyPack: {
        minimumVariantsPerStage: 2,
        requiredKeysPerVariant: [
          "angle",
          "primaryText",
          "headline",
          "description",
          "cta",
        ],
      },
      draftLaunchSpec: {
        requestedStatus: "PAUSED",
        namingPrefix: "[AIW-DRAFT] Metis AI",
        requiredKeys: [
          "requestedStatus",
          "namingPrefix",
          "campaignDraft",
          "adSetDrafts",
          "creativeDrafts",
          "adDrafts",
          "missingAssets",
        ],
        safetyRules: [
          "paused drafts only",
          "no existing-object updates",
          "no ACTIVE status",
          "no live object ids",
        ],
      },
    },
    constraints: [
      "Return valid JSON only.",
      "Do not request ACTIVE status.",
      "Do not reference existing live object IDs.",
      "DraftLaunchSpec must stay narrow enough for deterministic validation.",
      "campaignPlan.summary must be specific and at least 2 sentences.",
      "Include exactly 3 funnel stages labelled TOF, MOF, and BOF.",
      "Provide at least 2 copy variants for each stage.",
      'Each copy variant must include angle, primaryText, headline, description, and cta.',
      'Set draftLaunchSpec.requestedStatus to "PAUSED".',
      'Set draftLaunchSpec.namingPrefix to "[AIW-DRAFT] Metis AI".',
      "If assets are unknown, put them in missingAssets instead of inventing them.",
    ],
  };
}

export function validateBuilderOutput(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Builder output was not a JSON object.");
  }

  const campaignPlan = value.campaignPlan && typeof value.campaignPlan === "object"
    ? {
        summary: ensureString(value.campaignPlan.summary),
        primaryGoal: ensureString(value.campaignPlan.primaryGoal),
        offerStrategy: ensureString(value.campaignPlan.offerStrategy),
        funnelStages: Array.isArray(value.campaignPlan.funnelStages)
          ? value.campaignPlan.funnelStages.map((stage) => ({
              stage: ensureString(stage?.stage),
              angle: ensureString(stage?.angle),
              audienceSegment: ensureString(stage?.audienceSegment),
              messagePillars: ensureArray(stage?.messagePillars),
              creativeDirections: ensureArray(stage?.creativeDirections),
            }))
          : [],
        measurementPlan: normalizeMeasurementPlan(value.campaignPlan.measurementPlan),
      }
    : null;

  const copyPack = value.copyPack && typeof value.copyPack === "object"
    ? {
        tof: Array.isArray(value.copyPack.tof)
          ? value.copyPack.tof.map(normalizeCopyVariant).filter(Boolean)
          : [],
        mof: Array.isArray(value.copyPack.mof)
          ? value.copyPack.mof.map(normalizeCopyVariant).filter(Boolean)
          : [],
        bof: Array.isArray(value.copyPack.bof)
          ? value.copyPack.bof.map(normalizeCopyVariant).filter(Boolean)
          : [],
      }
    : null;

  const draftLaunchSpec = value.draftLaunchSpec && typeof value.draftLaunchSpec === "object"
    ? {
        requestedStatus: ensureString(value.draftLaunchSpec.requestedStatus),
        namingPrefix: ensureString(value.draftLaunchSpec.namingPrefix),
        campaignDraft: normalizeDraftEntity(value.draftLaunchSpec.campaignDraft),
        adSetDrafts: Array.isArray(value.draftLaunchSpec.adSetDrafts)
          ? value.draftLaunchSpec.adSetDrafts.map(normalizeDraftEntity).filter(Boolean)
          : [],
        creativeDrafts: Array.isArray(value.draftLaunchSpec.creativeDrafts)
          ? value.draftLaunchSpec.creativeDrafts.map(normalizeDraftEntity).filter(Boolean)
          : [],
        adDrafts: Array.isArray(value.draftLaunchSpec.adDrafts)
          ? value.draftLaunchSpec.adDrafts.map(normalizeDraftEntity).filter(Boolean)
          : [],
        missingAssets: ensureArray(value.draftLaunchSpec.missingAssets),
      }
    : null;

  const normalized = {
    campaignPlan,
    copyPack,
    draftLaunchSpec,
  };

  const validationErrors = [];

  if (!normalized.campaignPlan?.summary) {
    validationErrors.push("campaignPlan.summary is empty.");
  }

  if (normalized.campaignPlan?.summary && normalized.campaignPlan.summary.length < 120) {
    validationErrors.push("campaignPlan.summary is too short to be usable.");
  }

  if (!normalized.campaignPlan?.primaryGoal) {
    validationErrors.push("campaignPlan.primaryGoal is empty.");
  }

  if (!normalized.campaignPlan?.offerStrategy) {
    validationErrors.push("campaignPlan.offerStrategy is empty.");
  }

  if ((normalized.campaignPlan?.funnelStages?.length ?? 0) < 3) {
    validationErrors.push("campaignPlan.funnelStages must include TOF, MOF, and BOF.");
  }

  const stages = new Set(
    (normalized.campaignPlan?.funnelStages ?? []).map((stage) => stage.stage.toUpperCase()),
  );

  for (const requiredStage of ["TOF", "MOF", "BOF"]) {
    if (!stages.has(requiredStage)) {
      validationErrors.push(`campaignPlan.funnelStages is missing ${requiredStage}.`);
    }
  }

  for (const stage of normalized.campaignPlan?.funnelStages ?? []) {
    if (!stage.angle) {
      validationErrors.push(`campaignPlan stage ${stage.stage || "unknown"} is missing angle.`);
    }

    if (!stage.audienceSegment) {
      validationErrors.push(
        `campaignPlan stage ${stage.stage || "unknown"} is missing audienceSegment.`,
      );
    }

    if (stage.messagePillars.length < 2) {
      validationErrors.push(
        `campaignPlan stage ${stage.stage || "unknown"} needs at least 2 messagePillars.`,
      );
    }

    if (stage.creativeDirections.length < 2) {
      validationErrors.push(
        `campaignPlan stage ${stage.stage || "unknown"} needs at least 2 creativeDirections.`,
      );
    }
  }

  if ((normalized.campaignPlan?.measurementPlan?.length ?? 0) < 2) {
    validationErrors.push("campaignPlan.measurementPlan needs at least 2 metric entries.");
  }

  const totalCopyVariants =
    (normalized.copyPack?.tof?.length ?? 0) +
    (normalized.copyPack?.mof?.length ?? 0) +
    (normalized.copyPack?.bof?.length ?? 0);

  if (totalCopyVariants === 0) {
    validationErrors.push("copyPack contains no TOF/MOF/BOF variants.");
  }

  for (const [stage, variants] of Object.entries(normalized.copyPack ?? {})) {
    if ((variants?.length ?? 0) < 2) {
      validationErrors.push(`copyPack.${stage} needs at least 2 variants.`);
    }

    for (const [index, variant] of (variants ?? []).entries()) {
      if (!variant.angle || !variant.primaryText || !variant.headline || !variant.cta) {
        validationErrors.push(`copyPack.${stage}[${index}] is missing required copy fields.`);
      }
    }
  }

  if (!normalized.draftLaunchSpec?.requestedStatus) {
    validationErrors.push("draftLaunchSpec.requestedStatus is empty.");
  }

  if (normalized.draftLaunchSpec?.requestedStatus !== "PAUSED") {
    validationErrors.push('draftLaunchSpec.requestedStatus must be "PAUSED".');
  }

  if (!normalized.draftLaunchSpec?.namingPrefix) {
    validationErrors.push("draftLaunchSpec.namingPrefix is empty.");
  }

  if (normalized.draftLaunchSpec?.namingPrefix !== "[AIW-DRAFT] Metis AI") {
    validationErrors.push('draftLaunchSpec.namingPrefix must be "[AIW-DRAFT] Metis AI".');
  }

  if (!normalized.draftLaunchSpec?.campaignDraft) {
    validationErrors.push("draftLaunchSpec.campaignDraft is empty.");
  }

  if (!normalized.draftLaunchSpec?.adSetDrafts?.length) {
    validationErrors.push("draftLaunchSpec.adSetDrafts is empty.");
  }

  if (!normalized.draftLaunchSpec?.creativeDrafts?.length) {
    validationErrors.push("draftLaunchSpec.creativeDrafts is empty.");
  }

  if (!normalized.draftLaunchSpec?.adDrafts?.length) {
    validationErrors.push("draftLaunchSpec.adDrafts is empty.");
  }

  const draftNames = [
    normalized.draftLaunchSpec?.campaignDraft?.name,
    ...((normalized.draftLaunchSpec?.adSetDrafts ?? []).map((item) => item.name)),
    ...((normalized.draftLaunchSpec?.creativeDrafts ?? []).map((item) => item.name)),
    ...((normalized.draftLaunchSpec?.adDrafts ?? []).map((item) => item.name)),
  ].filter(Boolean);

  if (draftNames.some((name) => !String(name).startsWith("[AIW-DRAFT] Metis AI"))) {
    validationErrors.push("All draft object names must use the locked naming prefix.");
  }

  const budgetAmount = ensureNumber(normalized.draftLaunchSpec?.campaignDraft?.dailyBudget);

  if (budgetAmount !== null && budgetAmount <= 0) {
    validationErrors.push("draftLaunchSpec.campaignDraft.dailyBudget must be positive when set.");
  }

  if (validationErrors.length) {
    throw new Error(
      `Builder output is too thin for POC acceptance: ${validationErrors.join(" ")}`,
    );
  }

  return normalized;
}

export async function generateBuilderOutput(promptInput) {
  const result = await requestOpenRouterJson({
    systemPrompt:
      'You are the Campaign Strategist and Copywriter Agent for Metis AI. Use OpenRouter as the LLM gateway. Return valid JSON only with keys campaignPlan, copyPack, draftLaunchSpec. Produce concrete, usable output for a lead-generation draft build, not placeholders. campaignPlan must include summary, primaryGoal, offerStrategy, funnelStages, and measurementPlan. funnelStages must include exactly TOF, MOF, and BOF. copyPack must include at least 2 variants each for tof, mof, and bof, and every variant must include angle, primaryText, headline, description, and cta. draftLaunchSpec.requestedStatus must be "PAUSED". draftLaunchSpec.namingPrefix must be "[AIW-DRAFT] Metis AI". All draft object names must start with that prefix. If brand inputs are missing, note them in missingAssets or message strategy, but still provide the best safe draft plan possible without inventing unavailable Meta assets or live object IDs.',
    userPayload: promptInput,
  });

  return {
    model: result.model,
    builderOutput: validateBuilderOutput(result.data),
  };
}

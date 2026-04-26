import { readJsonFile } from "./reporting.mjs";
import { requestOpenRouterJson } from "./llm.mjs";
import { ACCOUNT_LABELS, resolveDraftAccountId } from "./accounts.mjs";

export function normalizeSupportLevel(value) {
  const normalized = ensureString(value).toLowerCase();

  if (normalized === "strategy-only" || normalized === "copy-only") {
    return normalized;
  }

  return "full-campaign";
}

function normalizeObjective(value) {
  const normalized = ensureString(value).toUpperCase();

  if (["AWARENESS", "LEADS", "SALES"].includes(normalized)) {
    return normalized;
  }

  if (normalized === "TRAFFIC") {
    return "LEADS";
  }

  return normalized || "LEADS";
}

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

function ensureObject(value) {
  return value && typeof value === "object" ? value : {};
}

function getBrandAnchor(brandBrief, brandUrl) {
  const product = ensureArray(brandBrief?.productsOrServices)[0];
  const positioning = ensureString(brandBrief?.positioning);
  const offer = ensureString(brandBrief?.offer);

  if (product) {
    return product;
  }

  if (offer) {
    return offer;
  }

  if (positioning) {
    return positioning.split(/[.!?]/)[0]?.trim() || positioning;
  }

  try {
    return new URL(brandUrl).hostname.replace(/^www\./, "");
  } catch {
    return "the offer";
  }
}

function getAudienceAnchor(brandBrief) {
  return ensureArray(brandBrief?.audience)[0] || "qualified prospecting audiences";
}

function getObjectiveCopyDefaults(objective) {
  const normalizedObjective = normalizeObjective(objective);

  if (normalizedObjective === "SALES") {
    return {
      primaryGoal: "Drive high-intent product exploration and purchase-ready traffic.",
      cta: "Shop now",
      tofAngle: "Introduce the product and its most compelling commerce-specific differentiators.",
      mofAngle: "Build proof, reduce hesitation, and highlight product/value fit.",
      bofAngle: "Convert high-intent shoppers with clear purchase direction and urgency.",
    };
  }

  if (normalizedObjective === "AWARENESS") {
    return {
      primaryGoal: "Build awareness and quality recall with low-friction message entry points.",
      cta: "Learn more",
      tofAngle: "Lead with brand story, category problem, and memorable creative framing.",
      mofAngle: "Deepen interest with product education and clearer reasons to care.",
      bofAngle: "Move warm audiences into stronger consideration without hard conversion pressure.",
    };
  }

  return {
    primaryGoal: "Generate qualified lead intent from audiences likely to convert.",
    cta: "Sign up",
    tofAngle: "Lead with the clearest problem/solution hook for cold audiences.",
    mofAngle: "Use proof, offer clarity, and qualification cues to move interested traffic forward.",
    bofAngle: "Drive the strongest direct-response ask for high-intent prospects.",
  };
}

function buildFallbackVariant({
  stage,
  angle,
  brandAnchor,
  audienceAnchor,
  offerAnchor,
  cta,
  variantIndex,
}) {
  const stageLabel = stage === "TOF" ? "prospecting" : stage === "MOF" ? "consideration" : "high-intent";
  const nuance =
    variantIndex === 0
      ? "Keep the message direct and specific to the offer."
      : "Use a second angle that reframes the same value proposition with a different entry point.";

  return {
    angle,
    primaryText: `${brandAnchor} should be framed for ${audienceAnchor} in a ${stageLabel} context. ${offerAnchor} needs to stay explicit, and the message should focus on why this is worth acting on now. ${nuance}`,
    headline:
      stage === "TOF"
        ? `Discover ${brandAnchor}`
        : stage === "MOF"
          ? `Why ${brandAnchor} stands out`
          : `Take the next step with ${brandAnchor}`,
    description:
      stage === "BOF"
        ? `Push clearer intent and reduce hesitation for ${audienceAnchor}.`
        : `Keep the offer tied to the actual brand signal and objective.`,
    cta,
  };
}

function synthesizeCopyPack({
  copyPack,
  supportLevel,
  objective,
  brandBrief,
  brandUrl,
}) {
  const variantCount = normalizeSupportLevel(supportLevel) === "strategy-only" ? 1 : 2;
  const brandAnchor = getBrandAnchor(brandBrief, brandUrl);
  const audienceAnchor = getAudienceAnchor(brandBrief);
  const offerAnchor = ensureString(brandBrief?.offer) || brandAnchor;
  const defaults = getObjectiveCopyDefaults(objective);
  const current = {
    tof: Array.isArray(copyPack?.tof) ? copyPack.tof.map(normalizeCopyVariant).filter(Boolean) : [],
    mof: Array.isArray(copyPack?.mof) ? copyPack.mof.map(normalizeCopyVariant).filter(Boolean) : [],
    bof: Array.isArray(copyPack?.bof) ? copyPack.bof.map(normalizeCopyVariant).filter(Boolean) : [],
  };

  const fallbackAngles = {
    TOF: defaults.tofAngle,
    MOF: defaults.mofAngle,
    BOF: defaults.bofAngle,
  };

  for (const stage of ["TOF", "MOF", "BOF"]) {
    const key = stage.toLowerCase();
    const variants = current[key];

    while (variants.length < variantCount) {
      variants.push(
        buildFallbackVariant({
          stage,
          angle:
            variants.length === 0
              ? fallbackAngles[stage]
              : `${fallbackAngles[stage]} Use a secondary creative angle for testing.`,
          brandAnchor,
          audienceAnchor,
          offerAnchor,
          cta: defaults.cta,
          variantIndex: variants.length,
        }),
      );
    }
  }

  return current;
}

function synthesizeDraftLaunchSpec({
  draftLaunchSpec,
  supportLevel,
  objective,
  brandBrief,
  brandUrl,
  websiteSignals,
}) {
  const normalizedSupportLevel = normalizeSupportLevel(supportLevel);
  const normalizedObjective = normalizeObjective(objective);
  const brandAnchor = getBrandAnchor(brandBrief, brandUrl);
  const objectiveLabel =
    normalizedObjective === "SALES" ? "Sales" : normalizedObjective === "AWARENESS" ? "Awareness" : "Lead Gen";
  const baseName = `[AIW-DRAFT] Metis AI | ${objectiveLabel} | ${brandAnchor}`.slice(0, 120);
  const current = ensureObject(draftLaunchSpec);
  const blockedReasons = ensureArray(current.blockedReasons);
  const missingAssets = ensureArray(current.missingAssets);

  if (websiteSignals?.thinSignal) {
    blockedReasons.push("Brand signal is still thin, so this should stay a planning-first build until more context is provided.");
  }

  if (websiteSignals?.objectiveSupport !== "supported") {
    blockedReasons.push(`The current site signal does not strongly support the requested ${normalizedObjective} objective yet.`);
  }

  if (normalizedSupportLevel !== "full-campaign") {
    blockedReasons.push(`Support level ${normalizedSupportLevel} is planning-focused, so the draft spec should stay handoff-grade instead of write-ready.`);
  }

  if (!missingAssets.length) {
    missingAssets.push("metaPage", "instagramAccount", "pixel");
  }

  return {
    requestedStatus: "PAUSED",
    namingPrefix: "[AIW-DRAFT] Metis AI",
    writeReadiness:
      normalizedSupportLevel === "full-campaign" &&
      websiteSignals?.objectiveSupport === "supported" &&
      !websiteSignals?.thinSignal
        ? ensureString(current.writeReadiness) || "validated-ready"
        : ensureString(current.writeReadiness) || "planning-only",
    campaignDraft: normalizeDraftEntity(current.campaignDraft) ?? {
      name: baseName,
      objective: normalizedObjective,
      status: "PAUSED",
    },
    adSetDrafts: Array.isArray(current.adSetDrafts)
      ? current.adSetDrafts.map(normalizeDraftEntity).filter(Boolean)
      : [],
    creativeDrafts: Array.isArray(current.creativeDrafts)
      ? current.creativeDrafts.map(normalizeDraftEntity).filter(Boolean)
      : [],
    adDrafts: Array.isArray(current.adDrafts)
      ? current.adDrafts.map(normalizeDraftEntity).filter(Boolean)
      : [],
    blockedReasons: [...new Set(blockedReasons)],
    missingAssets: [...new Set(missingAssets)],
  };
}

function repairBuilderOutput(value, promptInput) {
  const draftLaunchSpec = synthesizeDraftLaunchSpec({
    draftLaunchSpec: value?.draftLaunchSpec,
    supportLevel: promptInput.supportLevel,
    objective: promptInput.objective,
    brandBrief: promptInput.brandBrief,
    brandUrl: promptInput.brandUrl,
    websiteSignals: promptInput.websiteSignals,
  });

  return {
    ...ensureObject(value),
    campaignPlan: ensureObject(value?.campaignPlan),
    copyPack: synthesizeCopyPack({
      copyPack: value?.copyPack,
      supportLevel: promptInput.supportLevel,
      objective: promptInput.objective,
      brandBrief: promptInput.brandBrief,
      brandUrl: promptInput.brandUrl,
    }),
    draftLaunchSpec,
  };
}

function deriveWebsiteSignals(bundle, objective) {
  const text = ensureString(bundle?.bundleText).toLowerCase();
  const pageSummaryText = JSON.stringify(bundle?.pageSummaries ?? []).toLowerCase();
  const combined = `${text}\n${pageSummaryText}`;
  const normalizedObjective = normalizeObjective(objective);

  const hasCommerceSignal = /(checkout|cart|buy now|shop now|catalog|store|product page|product detail|purchase)/i.test(
    combined,
  );
  const hasLeadSignal = /(waitlist|sign up|signup|book demo|demo request|request demo|apply|contact us|get early access|join the waitlist|lead)/i.test(
    combined,
  );
  const hasStorySignal = /(story|mission|brand|creative|education|ritual|how it works|why)/i.test(
    combined,
  );
  const thinSignal = bundle?.enoughSignal === false || ensureArray(bundle?.qualityNotes).length > 0;

  return {
    objective: normalizedObjective,
    hasCommerceSignal,
    hasLeadSignal,
    hasStorySignal,
    thinSignal,
    objectiveSupport:
      normalizedObjective === "SALES"
        ? hasCommerceSignal
          ? "supported"
          : "weak"
        : normalizedObjective === "LEADS"
          ? hasLeadSignal
            ? "supported"
            : "weak"
          : hasStorySignal
            ? "supported"
            : "weak",
  };
}

function getSupportLevelPolicy(supportLevel) {
  const normalized = normalizeSupportLevel(supportLevel);

  if (normalized === "strategy-only") {
    return {
      supportLevel: normalized,
      description:
        "Return a strategy-led package with concise copy starters and a planning-only draft spec. Do not require a full write-ready campaign build.",
      copyExpectation: "Provide at least 1 useful copy variant per TOF, MOF, and BOF stage.",
      draftExpectation:
        "Return a planning-only draft spec with paused campaign shell, naming, blockedReasons, and missingAssets. Ad set, creative, and ad arrays may stay empty.",
    };
  }

  if (normalized === "copy-only") {
    return {
      supportLevel: normalized,
      description:
        "Return a copy-led package with concise strategic framing and a planning-only draft spec linked to the copy output.",
      copyExpectation: "Provide at least 2 useful copy variants per TOF, MOF, and BOF stage.",
      draftExpectation:
        "Return a planning-only draft spec with paused campaign shell, naming, blockedReasons, and missingAssets. Ad set, creative, and ad arrays may stay empty.",
    };
  }

  return {
    supportLevel: normalized,
    description:
      "Return the full builder package with strategy, copy, and the narrowest safe paused-draft spec possible.",
    copyExpectation: "Provide at least 2 useful copy variants per TOF, MOF, and BOF stage.",
    draftExpectation:
      "Return a write-ready paused-only draft spec when the site evidence and assets support it. If not, return a blocked planning spec with explicit missingAssets and blockedReasons.",
  };
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

export function buildBuilderOutputPromptInput({
  brandBriefEvidence,
  brandResearchEvidence,
  builderInputs,
}) {
  const normalizedSupportLevel = normalizeSupportLevel(builderInputs.supportLevel);
  const normalizedObjective = normalizeObjective(builderInputs.objective);
  const supportLevelPolicy = getSupportLevelPolicy(normalizedSupportLevel);
  const websiteSignals = deriveWebsiteSignals(brandResearchEvidence?.bundle, normalizedObjective);

  return {
    brandUrl: builderInputs.brandUrl,
    objective: normalizedObjective,
    supportLevel: normalizedSupportLevel,
    supportLevelPolicy,
    selectedAccountId: resolveDraftAccountId(),
    selectedAccountLabel: ACCOUNT_LABELS.draft,
    availableAssets: {
      metaPage: "unknown",
      instagramAccount: "unknown",
      pixel: "unknown",
    },
    websiteSignals,
    brandResearchSummary: {
      pagesCrawled: brandResearchEvidence?.bundle?.pagesCrawled ?? 0,
      enoughSignal: brandResearchEvidence?.bundle?.enoughSignal ?? false,
      qualityNotes: ensureArray(brandResearchEvidence?.bundle?.qualityNotes),
    },
    brandBrief: brandBriefEvidence.brandBrief,
    outputRequirements: {
      campaignPlan: {
        requiredKeys: ["summary", "primaryGoal", "offerStrategy"],
        funnelStages: {
          minimumCount: normalizedSupportLevel === "full-campaign" ? 3 : 1,
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
        minimumVariantsPerStage: normalizedSupportLevel === "strategy-only" ? 1 : 2,
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
          "writeReadiness",
          "campaignDraft",
          "adSetDrafts",
          "creativeDrafts",
          "adDrafts",
          "blockedReasons",
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
      "Tie strategy and copy to the website evidence and objective, not generic ad boilerplate.",
      "If the site signal is thin, narrow the plan safely and say more context is needed.",
      "If the objective is not well-supported by the site evidence, acknowledge the mismatch and narrow the plan safely instead of pretending it is supported.",
      "campaignPlan.summary must be specific and at least 2 sentences.",
      "Always return campaignPlan, copyPack, and draftLaunchSpec for every support level.",
      "Include TOF, MOF, and BOF framing whenever possible, but for lighter support levels concise stage guidance is acceptable.",
      `${supportLevelPolicy.copyExpectation}`,
      `${supportLevelPolicy.draftExpectation}`,
      'Each copy variant must include angle, primaryText, headline, description, and cta.',
      'Set draftLaunchSpec.requestedStatus to "PAUSED".',
      'Set draftLaunchSpec.namingPrefix to "[AIW-DRAFT] Metis AI".',
      'Set draftLaunchSpec.writeReadiness to one of "validated-ready", "planning-only", or "blocked".',
      "If assets are unknown, put them in missingAssets instead of inventing them.",
    ],
  };
}

export function validateBuilderOutput(value, options = {}) {
  if (!value || typeof value !== "object") {
    throw new Error("Builder output was not a JSON object.");
  }

  const supportLevel = normalizeSupportLevel(options.supportLevel);

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
        writeReadiness: ensureString(value.draftLaunchSpec.writeReadiness),
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
        blockedReasons: ensureArray(value.draftLaunchSpec.blockedReasons),
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

  const stageCount = normalized.campaignPlan?.funnelStages?.length ?? 0;

  if (supportLevel === "full-campaign" && stageCount < 3) {
    validationErrors.push("campaignPlan.funnelStages must include TOF, MOF, and BOF.");
  }

  if (stageCount > 0) {
    const stages = new Set(
      (normalized.campaignPlan?.funnelStages ?? []).map((stage) => stage.stage.toUpperCase()),
    );

    if (supportLevel === "full-campaign") {
      for (const requiredStage of ["TOF", "MOF", "BOF"]) {
        if (!stages.has(requiredStage)) {
          validationErrors.push(`campaignPlan.funnelStages is missing ${requiredStage}.`);
        }
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
    }
  }

  if (
    supportLevel === "full-campaign" &&
    (normalized.campaignPlan?.measurementPlan?.length ?? 0) < 2
  ) {
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
    const minimumVariants = supportLevel === "strategy-only" ? 1 : 2;

    if ((variants?.length ?? 0) < minimumVariants) {
      validationErrors.push(`copyPack.${stage} needs at least ${minimumVariants} variants.`);
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

  if (!normalized.draftLaunchSpec?.writeReadiness) {
    validationErrors.push("draftLaunchSpec.writeReadiness is empty.");
  }

  if (
    normalized.draftLaunchSpec?.writeReadiness &&
    !["validated-ready", "planning-only", "blocked"].includes(
      normalized.draftLaunchSpec.writeReadiness,
    )
  ) {
    validationErrors.push(
      'draftLaunchSpec.writeReadiness must be "validated-ready", "planning-only", or "blocked".',
    );
  }

  if (!normalized.draftLaunchSpec?.campaignDraft) {
    validationErrors.push("draftLaunchSpec.campaignDraft is empty.");
  }

  if (supportLevel === "full-campaign") {
    if (
      normalized.draftLaunchSpec?.writeReadiness === "validated-ready" &&
      !normalized.draftLaunchSpec?.adSetDrafts?.length
    ) {
      validationErrors.push("draftLaunchSpec.adSetDrafts is empty.");
    }

    if (
      normalized.draftLaunchSpec?.writeReadiness === "validated-ready" &&
      !normalized.draftLaunchSpec?.creativeDrafts?.length
    ) {
      validationErrors.push("draftLaunchSpec.creativeDrafts is empty.");
    }

    if (
      normalized.draftLaunchSpec?.writeReadiness === "validated-ready" &&
      !normalized.draftLaunchSpec?.adDrafts?.length
    ) {
      validationErrors.push("draftLaunchSpec.adDrafts is empty.");
    }
  } else if (normalized.draftLaunchSpec?.writeReadiness === "validated-ready") {
    validationErrors.push(
      "Non full-campaign support levels must not claim validated-ready draft write status.",
    );
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

  if (
    normalized.draftLaunchSpec?.writeReadiness !== "validated-ready" &&
    normalized.draftLaunchSpec?.blockedReasons?.length === 0 &&
    normalized.draftLaunchSpec?.missingAssets?.length === 0
  ) {
    validationErrors.push(
      "Planning-only or blocked draft specs must explain why the write path is not ready.",
    );
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
      'You are the Campaign Strategist and Copywriter Agent for Metis AI. Use OpenRouter as the LLM gateway. Return valid JSON only with keys campaignPlan, copyPack, draftLaunchSpec. Produce concrete, operator-grade output that matches the requested objective and support level, stays specific to the website evidence, and narrows safely when the site signal or assets are insufficient. Always keep draft outputs paused-only and prefixed with "[AIW-DRAFT] Metis AI". For full-campaign support, provide a write-ready draft spec only when the evidence supports it; otherwise provide a planning-only or blocked draft spec with explicit blockedReasons and missingAssets. For strategy-only and copy-only support, still return useful strategy, copy, and a planning-level draft spec instead of leaving sections empty.',
    userPayload: promptInput,
  });

  const repairedOutput = repairBuilderOutput(result.data, promptInput);

  return {
    model: result.model,
    builderOutput: validateBuilderOutput(repairedOutput, {
      supportLevel: promptInput.supportLevel,
    }),
  };
}

function ensureString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCampaignObjective(value) {
  const objective = ensureString(value).toUpperCase();

  const mappings = {
    LEADS: "OUTCOME_LEADS",
    LEAD_GENERATION: "OUTCOME_LEADS",
    SALES: "OUTCOME_SALES",
    TRAFFIC: "OUTCOME_TRAFFIC",
    AWARENESS: "OUTCOME_AWARENESS",
    ENGAGEMENT: "OUTCOME_ENGAGEMENT",
    APP_PROMOTION: "OUTCOME_APP_PROMOTION",
  };

  return mappings[objective] ?? objective;
}

function rejectUnknownKeys(entityName, value, allowedKeys) {
  const unknownKeys = Object.keys(value ?? {}).filter((key) => !allowedKeys.includes(key));

  if (unknownKeys.length) {
    throw new Error(`${entityName} contains unknown fields: ${unknownKeys.join(", ")}.`);
  }
}

function ensurePausedStatus(entityName, value) {
  if (ensureString(value).toUpperCase() !== "PAUSED") {
    throw new Error(`${entityName} must stay PAUSED.`);
  }
}

function ensureNoObjectIds(entityName, value) {
  for (const [key, entryValue] of Object.entries(value ?? {})) {
    if (/^id$/i.test(key) || /_id$/i.test(key) || /Id$/.test(key)) {
      throw new Error(`${entityName} contains forbidden object id field: ${key}.`);
    }

    if (typeof entryValue === "string" && /^act_/i.test(entryValue.trim())) {
      throw new Error(`${entityName} contains a forbidden live object reference in ${key}.`);
    }
  }
}

export function validateDraftLaunchSpec(builderOutput) {
  const draftLaunchSpec = builderOutput?.draftLaunchSpec;

  if (!draftLaunchSpec || typeof draftLaunchSpec !== "object") {
    throw new Error("Builder output is missing draftLaunchSpec.");
  }

  if (draftLaunchSpec.requestedStatus !== "PAUSED") {
    throw new Error('draftLaunchSpec.requestedStatus must equal "PAUSED".');
  }

  if (draftLaunchSpec.namingPrefix !== "[AIW-DRAFT] Metis AI") {
    throw new Error('draftLaunchSpec.namingPrefix must equal "[AIW-DRAFT] Metis AI".');
  }

  rejectUnknownKeys("campaignDraft", draftLaunchSpec.campaignDraft, [
    "name",
    "objective",
    "status",
    "specialAdCategories",
    "isAdsetBudgetSharingEnabled",
    "buyingType",
    "optimizationGoal",
    "destination",
    "message",
  ]);
  ensurePausedStatus("campaignDraft.status", draftLaunchSpec.campaignDraft?.status);
  ensureNoObjectIds("campaignDraft", draftLaunchSpec.campaignDraft);

  const campaignPayload = {
    name: ensureString(draftLaunchSpec.campaignDraft?.name),
    objective: normalizeCampaignObjective(draftLaunchSpec.campaignDraft?.objective),
    status: "PAUSED",
    special_ad_categories: draftLaunchSpec.campaignDraft?.specialAdCategories ?? [],
    is_adset_budget_sharing_enabled:
      draftLaunchSpec.campaignDraft?.isAdsetBudgetSharingEnabled === true ? "true" : "false",
  };

  if (!campaignPayload.name.startsWith("[AIW-DRAFT] Metis AI")) {
    throw new Error("campaignDraft.name does not use the locked prefix.");
  }

  if (!campaignPayload.objective) {
    throw new Error("campaignDraft.objective is empty.");
  }

  const adSetPayloads = (draftLaunchSpec.adSetDrafts ?? []).map((adSetDraft, index) => {
    rejectUnknownKeys(`adSetDrafts[${index}]`, adSetDraft, [
      "name",
      "status",
      "targetingSummary",
      "conversionLocation",
      "billingEvent",
      "optimizationGoal",
      "placements",
      "missingAssets",
      "audienceNotes",
      "audienceNotes",
      "destination",
      "conversionEvent",
      "placementNotes",
    ]);
    ensurePausedStatus(`adSetDrafts[${index}].status`, adSetDraft?.status);
    ensureNoObjectIds(`adSetDrafts[${index}]`, adSetDraft);

    return {
      name: ensureString(adSetDraft?.name),
      status: "PAUSED",
      targetingSummary:
        ensureString(adSetDraft?.targetingSummary) || ensureString(adSetDraft?.audienceNotes),
      optimizationGoal:
        ensureString(adSetDraft?.optimizationGoal) || ensureString(adSetDraft?.conversionEvent),
      conversionLocation:
        ensureString(adSetDraft?.conversionLocation) || ensureString(adSetDraft?.destination),
      billingEvent: ensureString(adSetDraft?.billingEvent),
      placements: ensureString(adSetDraft?.placements) || ensureString(adSetDraft?.placementNotes),
      missingAssets: Array.isArray(adSetDraft?.missingAssets) ? adSetDraft.missingAssets : [],
    };
  });

  const creativePayloads = (draftLaunchSpec.creativeDrafts ?? []).map((creativeDraft, index) => {
    rejectUnknownKeys(`creativeDrafts[${index}]`, creativeDraft, [
      "name",
      "format",
      "primaryMessage",
      "visualDirection",
      "missingAssets",
      "status",
      "stage",
      "primaryText",
      "headline",
      "description",
      "cta",
    ]);
    if (creativeDraft?.status) {
      ensurePausedStatus(`creativeDrafts[${index}].status`, creativeDraft?.status);
    }
    ensureNoObjectIds(`creativeDrafts[${index}]`, creativeDraft);

    return {
      name: ensureString(creativeDraft?.name),
      format: ensureString(creativeDraft?.format),
      primaryText:
        ensureString(creativeDraft?.primaryText) || ensureString(creativeDraft?.primaryMessage),
      headline: ensureString(creativeDraft?.headline),
      description: ensureString(creativeDraft?.description),
      cta: ensureString(creativeDraft?.cta),
      visualDirection: ensureString(creativeDraft?.visualDirection),
      missingAssets: Array.isArray(creativeDraft?.missingAssets) ? creativeDraft.missingAssets : [],
    };
  });

  const adPayloads = (draftLaunchSpec.adDrafts ?? []).map((adDraft, index) => {
    rejectUnknownKeys(`adDrafts[${index}]`, adDraft, [
      "name",
      "status",
      "creativeRef",
      "adSetRef",
      "primaryText",
      "headline",
      "description",
      "cta",
      "linkedCreativeName",
    ]);
    ensurePausedStatus(`adDrafts[${index}].status`, adDraft?.status);
    ensureNoObjectIds(`adDrafts[${index}]`, adDraft);

    return {
      name: ensureString(adDraft?.name),
      status: "PAUSED",
      creativeRef:
        ensureString(adDraft?.creativeRef) || ensureString(adDraft?.linkedCreativeName),
      adSetRef: ensureString(adDraft?.adSetRef),
      primaryText: ensureString(adDraft?.primaryText),
      headline: ensureString(adDraft?.headline),
      description: ensureString(adDraft?.description),
      cta: ensureString(adDraft?.cta),
    };
  });

  if (!adSetPayloads.length || !creativePayloads.length || !adPayloads.length) {
    throw new Error("DraftLaunchSpec must include ad set, creative, and ad drafts.");
  }

  return {
    requestedStatus: "PAUSED",
    namingPrefix: draftLaunchSpec.namingPrefix,
    campaignPayload,
    adSetPayloads,
    creativePayloads,
    adPayloads,
    missingAssets: Array.isArray(draftLaunchSpec.missingAssets) ? draftLaunchSpec.missingAssets : [],
  };
}

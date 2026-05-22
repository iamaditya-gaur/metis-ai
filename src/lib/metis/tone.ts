import { requestOpenRouterJson } from "../../../scripts/pocs/lib/llm.mjs";

import type {
  ContentVocabulary,
  MetricToken,
  ReportingRunResponse,
  ToneProfile,
  VoiceMatchVerdict,
} from "@/lib/metis/types";

type ReportForToneRewrite = ReportingRunResponse["report"];
type SnapshotForToneRewrite = ReportingRunResponse["snapshot"];

function normalizeSample(text: string) {
  return text.trim().replace(/^"+|"+$/g, "").trim();
}

function splitToneExamples(toneExamples: string) {
  const quotedMatches = [...toneExamples.matchAll(/"([\s\S]*?)"/g)]
    .map((match) => normalizeSample(match[1] ?? ""))
    .filter(Boolean);

  if (quotedMatches.length >= 2) {
    return quotedMatches;
  }

  return toneExamples
    .split(/\n\s*\n+/)
    .map(normalizeSample)
    .filter(Boolean);
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function sentenceWordAverage(text: string) {
  const sentences = text
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return 0;
  }

  const wordCount = sentences.reduce((count, sentence) => count + countWords(sentence), 0);
  return wordCount / sentences.length;
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToInteger(value: number) {
  return Math.round(value);
}

function getWordRange(samples: string[]) {
  const counts = samples.map(countWords).filter((count) => count > 0);
  const target = roundToInteger(average(counts));

  return {
    target: target || 120,
    min: counts.length ? Math.max(40, Math.min(...counts)) : 80,
    max: counts.length ? Math.max(70, Math.max(...counts)) : 150,
  };
}

function inferOpeningStyle(samples: string[]) {
  const normalizedStarts = samples.map((sample) => sample.toLowerCase().slice(0, 120));

  if (normalizedStarts.some((sample) => /^hey\b|^hi\b/.test(sample))) {
    return "greeting-plus-update" as const;
  }

  if (normalizedStarts.some((sample) => sample.includes("quick update"))) {
    return "quick-update" as const;
  }

  if (normalizedStarts.some((sample) => sample.includes("performance summary"))) {
    return "report-heading" as const;
  }

  return "neutral" as const;
}

function inferStructureStyle(samples: string[]) {
  const paragraphCounts = samples.map((sample) =>
    sample
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean).length,
  );
  const averageParagraphs = average(paragraphCounts);
  const normalized = samples.join("\n").toLowerCase();

  if (/key performance metrics|performance insights/.test(normalized)) {
    return "metrics-then-insight" as const;
  }

  if (averageParagraphs > 1.35) {
    return "multi-paragraph" as const;
  }

  return "single-block" as const;
}

function inferMetricStyle(samples: string[]) {
  const joined = samples.join("\n");
  const colonCount = (joined.match(/:/g) ?? []).length;
  const metricSignalCount =
    (joined.match(/\b(roas|ctr|cpc|cpp|cpm|spend|purchases|aov|impressions|clicks)\b/gi) ?? [])
      .length;

  if (colonCount >= 6 || metricSignalCount >= 10) {
    return "dense" as const;
  }

  if (colonCount >= 2 || metricSignalCount >= 4) {
    return "mixed" as const;
  }

  return "conversational" as const;
}

function inferRecommendationStyle(normalizedExamples: string) {
  if (/\b(test|testing|launch|launched|roll out|new campaign)\b/.test(normalizedExamples)) {
    return "test-and-iterate" as const;
  }

  if (/\b(monitor|keep an eye|tweak|watch|give it enough room)\b/.test(normalizedExamples)) {
    return "monitor-and-tweak" as const;
  }

  if (/\b(will update|will change|need to)\b/.test(normalizedExamples)) {
    return "direct-action" as const;
  }

  return "neutral" as const;
}

const METRIC_PATTERNS: Array<{ pattern: RegExp; metric: MetricToken }> = [
  { pattern: /\b(spend|spent|spending|budget|budgets)\b/i, metric: "spend" },
  { pattern: /\bimpressions?\b/i, metric: "impressions" },
  { pattern: /\breach(es|ed)?\b/i, metric: "reach" },
  { pattern: /\bclicks?\b/i, metric: "clicks" },
  { pattern: /\b(ctr|click[\s-]through(?:\s+rate)?)\b/i, metric: "ctr" },
  { pattern: /\bcpm\b/i, metric: "cpm" },
  { pattern: /\b(cpc|cost\s+per\s+click)\b/i, metric: "cpc" },
  { pattern: /\bfrequency\b/i, metric: "frequency" },
  {
    pattern:
      /\b(results?|conversions?|purchases?|leads?|sign[\s-]?ups?|signups?|roas)\b/i,
    metric: "results",
  },
  {
    pattern:
      /\b(cost\s+per\s+(result|purchase|lead|action|signup|sign[\s-]?up|conversion)|cpp|cpa|cost\/result)\b/i,
    metric: "costPerResult",
  },
];

const CHANGE_VERB_PATTERN =
  /\b(bump(ed|ing)?|raised|raising|lower(ed|ing)?|paus(ed|ing)|unpaus(ed|ing)|launch(ed|ing)?|relaunch(ed|ing)?|switch(ed|ing)?|swapp(ed|ing)|kill(ed|ing)?|mov(ed|ing)|reallocat(ed|ing)|test(ed|ing)|increas(ed|ing)|decreas(ed|ing)|cut|added|adding|turn(ed|ing)?\s+(on|off)|start(ed|ing)|stopp(ed|ing)|enabl(ed|ing)|disabl(ed|ing)|set\s+up|kick(ed|ing)?\s+off|push(ed|ing)|roll(ed|ing)?\s+out|creat(ed|ing)|delet(ed|ing)|remov(ed|ing)|tweak(ed|ing)|adjust(ed|ing)|shift(ed|ing)|scal(ed|ing)|reduc(ed|ing)|expand(ed|ing)|narrow(ed|ing))\b/i;

const CAMPAIGN_REFERENCE_PATTERN =
  /\b(campaigns?|ad[\s-]?sets?|adsets?|creatives?|variants?|audiences?)\b/i;

function extractContentVocabulary(samples: string[]): ContentVocabulary {
  if (!samples.length) {
    return {
      mentionedMetrics: [],
      mentionsCampaigns: false,
      mentionsChanges: false,
      averageMetricCount: 0,
    };
  }

  const perSampleHits = samples.map((sample) => {
    const hits = new Set<MetricToken>();
    for (const { pattern, metric } of METRIC_PATTERNS) {
      if (pattern.test(sample)) {
        hits.add(metric);
      }
    }
    return hits;
  });

  const threshold = Math.max(1, Math.ceil(samples.length / 3));
  const occurrenceCounts = new Map<MetricToken, number>();

  for (const hits of perSampleHits) {
    for (const metric of hits) {
      occurrenceCounts.set(metric, (occurrenceCounts.get(metric) ?? 0) + 1);
    }
  }

  const mentionedMetrics: MetricToken[] = [];
  for (const { metric } of METRIC_PATTERNS) {
    const count = occurrenceCounts.get(metric) ?? 0;
    if (count >= threshold && !mentionedMetrics.includes(metric)) {
      mentionedMetrics.push(metric);
    }
  }

  const totalDistinctMentions = perSampleHits.reduce((sum, hits) => sum + hits.size, 0);
  const averageMetricCount = Math.round((totalDistinctMentions / samples.length) * 10) / 10;

  const joined = samples.join("\n");
  const mentionsCampaigns = CAMPAIGN_REFERENCE_PATTERN.test(joined);
  const mentionsChanges = CHANGE_VERB_PATTERN.test(joined);

  return {
    mentionedMetrics,
    mentionsCampaigns,
    mentionsChanges,
    averageMetricCount,
  };
}

function collectCommonPhrases(normalizedExamples: string) {
  const candidates = [
    "from my side",
    "main takeaway",
    "keep an eye",
    "i'm testing",
    "i'm also testing",
    "i'll continue to monitor",
    "if that makes sense",
    "showing potential",
    "picking up well",
    "worth watching",
  ];

  return candidates.filter((phrase) => normalizedExamples.includes(phrase)).slice(0, 5);
}

function collectDecimalPlaces(samples: string[], pattern: RegExp) {
  return samples.flatMap((sample) =>
    [...sample.matchAll(pattern)].flatMap((match) => {
      const decimals = match[1];
      return decimals ? [decimals.length] : [];
    }),
  );
}

function inferNumericStyle(samples: string[]) {
  const currencyDecimals = collectDecimalPlaces(samples, /\$\s*\d[\d,]*\.(\d+)/g);
  const percentDecimals = collectDecimalPlaces(samples, /\d[\d,]*\.(\d+)\s*%/g);
  const plainDecimals = collectDecimalPlaces(
    samples,
    /(?:\b|^)(?!\$)(?!\d{4}\b)\d[\d,]*\.(\d+)(?!\s*%)/g,
  );

  return {
    currencyDecimalPlaces: clamp(
      roundToInteger(currencyDecimals.length ? average(currencyDecimals) : 2),
      0,
      4,
    ),
    percentDecimalPlaces: clamp(
      roundToInteger(percentDecimals.length ? average(percentDecimals) : 1),
      0,
      4,
    ),
    plainNumberDecimalPlaces: clamp(
      roundToInteger(plainDecimals.length ? average(plainDecimals) : 1),
      0,
      4,
    ),
    useThousandsSeparators: /,\d{3}\b/.test(samples.join(" ")),
  };
}

function coerceBrevity(value: unknown): ToneProfile["brevity"] {
  return value === "tight" || value === "balanced" || value === "detailed"
    ? value
    : "balanced";
}

function coercePerspective(value: unknown): ToneProfile["perspective"] {
  return value === "first-person" || value === "team" || value === "neutral"
    ? value
    : "neutral";
}

function coerceOpeningStyle(value: unknown): ToneProfile["openingStyle"] {
  return value === "quick-update" ||
    value === "greeting-plus-update" ||
    value === "report-heading" ||
    value === "neutral"
    ? value
    : "neutral";
}

function coerceStructureStyle(value: unknown): ToneProfile["structureStyle"] {
  return value === "single-block" ||
    value === "multi-paragraph" ||
    value === "metrics-then-insight"
    ? value
    : "multi-paragraph";
}

function coerceMetricStyle(value: unknown): ToneProfile["metricStyle"] {
  return value === "conversational" || value === "mixed" || value === "dense"
    ? value
    : "mixed";
}

function coerceRecommendationStyle(value: unknown): ToneProfile["recommendationStyle"] {
  return value === "monitor-and-tweak" ||
    value === "test-and-iterate" ||
    value === "direct-action" ||
    value === "neutral"
    ? value
    : "neutral";
}

function coerceConfidence(value: unknown): ToneProfile["confidence"] {
  return value === "restrained" || value === "direct" ? value : "restrained";
}

function coerceInteger(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(roundToInteger(value), min, max)
    : fallback;
}

function validateToneProfile(value: unknown, fallback: ToneProfile): ToneProfile {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const maybeProfile = value as Record<string, unknown>;
  const numericStyle =
    maybeProfile.numericStyle && typeof maybeProfile.numericStyle === "object"
      ? (maybeProfile.numericStyle as Record<string, unknown>)
      : {};
  const wordRange =
    maybeProfile.wordRange && typeof maybeProfile.wordRange === "object"
      ? (maybeProfile.wordRange as Record<string, unknown>)
      : {};

  return {
    sampleCount: coerceInteger(maybeProfile.sampleCount, fallback.sampleCount, 0, 20),
    brevity: coerceBrevity(maybeProfile.brevity),
    perspective: coercePerspective(maybeProfile.perspective),
    openingStyle: coerceOpeningStyle(maybeProfile.openingStyle),
    structureStyle: coerceStructureStyle(maybeProfile.structureStyle),
    metricStyle: coerceMetricStyle(maybeProfile.metricStyle),
    recommendationStyle: coerceRecommendationStyle(maybeProfile.recommendationStyle),
    confidence: coerceConfidence(maybeProfile.confidence),
    targetWordCount: coerceInteger(maybeProfile.targetWordCount, fallback.targetWordCount, 40, 280),
    wordRange: {
      min: coerceInteger(wordRange.min, fallback.wordRange.min, 30, 260),
      max: coerceInteger(wordRange.max, fallback.wordRange.max, 40, 320),
    },
    numericStyle: {
      currencyDecimalPlaces: coerceInteger(
        numericStyle.currencyDecimalPlaces,
        fallback.numericStyle.currencyDecimalPlaces,
        0,
        4,
      ),
      percentDecimalPlaces: coerceInteger(
        numericStyle.percentDecimalPlaces,
        fallback.numericStyle.percentDecimalPlaces,
        0,
        4,
      ),
      plainNumberDecimalPlaces: coerceInteger(
        numericStyle.plainNumberDecimalPlaces,
        fallback.numericStyle.plainNumberDecimalPlaces,
        0,
        4,
      ),
      useThousandsSeparators:
        typeof numericStyle.useThousandsSeparators === "boolean"
          ? numericStyle.useThousandsSeparators
          : fallback.numericStyle.useThousandsSeparators,
    },
    commonPhrases: Array.isArray(maybeProfile.commonPhrases)
      ? maybeProfile.commonPhrases
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 5)
      : fallback.commonPhrases,
    contentVocabulary: fallback.contentVocabulary,
  };
}

function formatNumber(value: number | null | undefined, decimals: number, useThousandsSeparators: boolean) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: useThousandsSeparators,
  }).format(value);
}

function trimFormattedDecimals(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/g, "$1").replace(/\.0+$/g, "");
}

function formatStyleValue(
  value: number | null | undefined,
  decimals: number,
  useThousandsSeparators: boolean,
  mode: "plain" | "currency" | "percent",
) {
  const formatted = formatNumber(value, decimals, useThousandsSeparators);

  if (!formatted) {
    return null;
  }

  const compact = trimFormattedDecimals(formatted);

  if (mode === "currency") {
    return `$${compact}`;
  }

  if (mode === "percent") {
    return `${compact}%`;
  }

  return compact;
}

function getCommunicatorModelCandidates() {
  const explicit = process.env.OPENROUTER_CLIENT_MESSAGE_MODELS?.trim();

  if (explicit) {
    return explicit
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  const reportingDefault = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-5.4-mini";

  return [
    "anthropic/claude-sonnet-4.7",
    "anthropic/claude-sonnet-4.6",
    reportingDefault,
  ];
}

function getComposeTemperature() {
  const configured = Number(process.env.OPENROUTER_CLIENT_MESSAGE_TEMPERATURE ?? "");
  return Number.isFinite(configured) ? configured : 0.7;
}

function getToneProfileTemperature() {
  const configured = Number(process.env.OPENROUTER_TONE_PROFILE_TEMPERATURE ?? "");
  return Number.isFinite(configured) ? configured : 0.35;
}

function buildFormattedSnapshot(snapshot: SnapshotForToneRewrite, toneProfile: ToneProfile) {
  const { numericStyle } = toneProfile;

  return {
    dateRangeLabel: snapshot.dateRange.label,
    rowCount: snapshot.rowCount,
    totals: {
      spend: formatStyleValue(
        snapshot.totals.spend,
        numericStyle.currencyDecimalPlaces,
        numericStyle.useThousandsSeparators,
        "currency",
      ),
      impressions: formatStyleValue(
        snapshot.totals.impressions,
        0,
        numericStyle.useThousandsSeparators,
        "plain",
      ),
      reach: formatStyleValue(
        snapshot.totals.reach,
        0,
        numericStyle.useThousandsSeparators,
        "plain",
      ),
      clicks: formatStyleValue(
        snapshot.totals.clicks,
        0,
        numericStyle.useThousandsSeparators,
        "plain",
      ),
      ctr: formatStyleValue(
        snapshot.totals.ctr,
        numericStyle.percentDecimalPlaces,
        numericStyle.useThousandsSeparators,
        "percent",
      ),
      cpc: formatStyleValue(
        snapshot.totals.cpc,
        numericStyle.currencyDecimalPlaces,
        numericStyle.useThousandsSeparators,
        "currency",
      ),
      frequency: formatStyleValue(
        snapshot.totals.frequency,
        numericStyle.plainNumberDecimalPlaces,
        numericStyle.useThousandsSeparators,
        "plain",
      ),
    },
    topCampaigns: snapshot.topCampaigns.map((campaign) => ({
      campaignName: campaign.campaignName,
      objective: campaign.objective,
      spend: formatStyleValue(
        campaign.spend,
        numericStyle.currencyDecimalPlaces,
        numericStyle.useThousandsSeparators,
        "currency",
      ),
      impressions: formatStyleValue(
        campaign.impressions,
        0,
        numericStyle.useThousandsSeparators,
        "plain",
      ),
      clicks: formatStyleValue(
        campaign.clicks,
        0,
        numericStyle.useThousandsSeparators,
        "plain",
      ),
      ctr: formatStyleValue(
        campaign.ctr,
        numericStyle.percentDecimalPlaces,
        numericStyle.useThousandsSeparators,
        "percent",
      ),
      cpc: formatStyleValue(
        campaign.cpc,
        numericStyle.currencyDecimalPlaces,
        numericStyle.useThousandsSeparators,
        "currency",
      ),
    })),
  };
}

type NumberStyleSignature = {
  family: "currency" | "percent" | "plain";
  hasKSuffix: boolean;
  hasMSuffix: boolean;
  hasThousandsSeparator: boolean;
  decimalPlaces: number;
};

function classifyNumberToken(token: string): NumberStyleSignature | null {
  if (!/\d/.test(token)) {
    return null;
  }

  const hasPercent = /%\s*$/.test(token);
  const hasCurrency = token.trim().startsWith("$");
  const hasKSuffix = /\d[.,\d]*\s*k\b/i.test(token);
  const hasMSuffix = /\d[.,\d]*\s*m\b/i.test(token);
  const decimalMatch = token.match(/\.(\d+)/);
  const decimalPlaces = decimalMatch ? decimalMatch[1].length : 0;
  const hasThousandsSeparator = /\d,\d{3}\b/.test(token);

  const family: NumberStyleSignature["family"] = hasPercent
    ? "percent"
    : hasCurrency
      ? "currency"
      : "plain";

  return { family, hasKSuffix, hasMSuffix, hasThousandsSeparator, decimalPlaces };
}

function extractExampleNumberSignatures(samples: string[]): NumberStyleSignature[] {
  if (!samples.length) {
    return [];
  }

  const joined = samples.join("\n\n");
  const tokens = joined.match(/\$?\s*\d[\d,]*(?:\.\d+)?\s*[km]?\s*%?/gi) ?? [];

  return tokens
    .map((token) => token.trim())
    .map(classifyNumberToken)
    .filter((signature): signature is NumberStyleSignature => signature !== null);
}

function numberStyleAppearsInExamples(
  rawMatch: string,
  exampleSignatures: NumberStyleSignature[],
) {
  if (!exampleSignatures.length) {
    return false;
  }

  const candidate = classifyNumberToken(rawMatch);

  if (!candidate) {
    return false;
  }

  return exampleSignatures.some(
    (signature) =>
      signature.family === candidate.family &&
      signature.hasKSuffix === candidate.hasKSuffix &&
      signature.hasMSuffix === candidate.hasMSuffix &&
      signature.hasThousandsSeparator === candidate.hasThousandsSeparator &&
      signature.decimalPlaces === candidate.decimalPlaces,
  );
}

function normalizeMessageNumericFormatting(
  message: string,
  toneProfile: ToneProfile,
  samples: string[] = [],
) {
  const { currencyDecimalPlaces, percentDecimalPlaces, plainNumberDecimalPlaces } =
    toneProfile.numericStyle;
  const exampleSignatures = extractExampleNumberSignatures(samples);

  return message
    .replace(/\$[0-9][0-9,]*\.[0-9]+/g, (rawMatch) => {
      if (numberStyleAppearsInExamples(rawMatch, exampleSignatures)) {
        return rawMatch;
      }
      const value = rawMatch.replace(/[^0-9.]/g, "");
      const numeric = Number(value);
      return Number.isFinite(numeric)
        ? formatStyleValue(
            numeric,
            currencyDecimalPlaces,
            toneProfile.numericStyle.useThousandsSeparators,
            "currency",
          ) ?? rawMatch
        : rawMatch;
    })
    .replace(/[0-9][0-9,]*\.[0-9]+\s*%/g, (rawMatch) => {
      if (numberStyleAppearsInExamples(rawMatch, exampleSignatures)) {
        return rawMatch;
      }
      const value = rawMatch.replace(/[^0-9.]/g, "");
      const numeric = Number(value);
      return Number.isFinite(numeric)
        ? formatStyleValue(
            numeric,
            percentDecimalPlaces,
            toneProfile.numericStyle.useThousandsSeparators,
            "percent",
          ) ?? rawMatch
        : rawMatch;
    })
    .replace(/(?<!\$)\b[0-9][0-9,]*\.[0-9]+\b(?!\s*%)/g, (rawMatch) => {
      if (numberStyleAppearsInExamples(rawMatch, exampleSignatures)) {
        return rawMatch;
      }
      const value = rawMatch.replace(/,/g, "");
      const numeric = Number(value);
      return Number.isFinite(numeric)
        ? formatStyleValue(
            numeric,
            plainNumberDecimalPlaces,
            toneProfile.numericStyle.useThousandsSeparators,
            "plain",
          ) ?? rawMatch
        : rawMatch;
    });
}

type MetricRow = { token: MetricToken; label: string; value: string };

function buildMetricRows(
  snapshot: SnapshotForToneRewrite,
  toneProfile: ToneProfile,
): MetricRow[] {
  const formatted = buildFormattedSnapshot(snapshot, toneProfile);
  const { numericStyle } = toneProfile;
  const rows: MetricRow[] = [];

  const push = (token: MetricToken, label: string, value: string | null | undefined) => {
    if (value === null || value === undefined || value === "") {
      return;
    }
    rows.push({ token, label, value });
  };

  push("spend", "Spend", formatted.totals.spend);
  push("impressions", "Impressions", formatted.totals.impressions);
  push("reach", "Reach", formatted.totals.reach);
  push("clicks", "Clicks", formatted.totals.clicks);
  push("ctr", "CTR", formatted.totals.ctr);
  push("cpc", "CPC", formatted.totals.cpc);
  push("frequency", "Frequency", formatted.totals.frequency);

  const cpm = formatStyleValue(
    snapshot.totals.cpm,
    numericStyle.currencyDecimalPlaces,
    numericStyle.useThousandsSeparators,
    "currency",
  );
  push("cpm", "CPM", cpm);

  const primary = snapshot.totals.primaryResult;
  if (primary) {
    const resultsValue = formatStyleValue(
      primary.value,
      0,
      numericStyle.useThousandsSeparators,
      "plain",
    );
    const costPerResultValue = formatStyleValue(
      primary.costPerResult,
      numericStyle.currencyDecimalPlaces,
      numericStyle.useThousandsSeparators,
      "currency",
    );
    push("results", primary.label || "Results", resultsValue);
    push(
      "costPerResult",
      `Cost per ${(primary.label || "result").toLowerCase()}`,
      costPerResultValue,
    );
  }

  return rows;
}

function partitionMetricRows(rows: MetricRow[], vocabulary: ContentVocabulary) {
  const mentioned = new Set<MetricToken>(vocabulary.mentionedMetrics);
  const primary: MetricRow[] = [];
  const optional: MetricRow[] = [];

  for (const row of rows) {
    if (mentioned.has(row.token)) {
      primary.push(row);
    } else {
      optional.push(row);
    }
  }

  return { primary, optional };
}

function renderMetricRows(rows: MetricRow[]) {
  if (!rows.length) {
    return "- (none available)";
  }
  return rows.map((row) => `- ${row.label}: ${row.value}`).join("\n");
}

export type ActivityRecord = {
  eventType: string | null;
  translatedEventType: string | null;
  eventTime: string | null;
  objectId: string | null;
  objectName: string | null;
  objectType: string | null;
  valueOld: string | null;
  valueNew: string | null;
  actorId: string | null;
  actorName: string | null;
  extraData: unknown;
};

function humanizeEventType(eventType: string | null): string | null {
  if (!eventType) {
    return null;
  }
  return eventType.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function formatActivityValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (typeof value === "number") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function formatActivityLine(activity: ActivityRecord): string | null {
  const eventLabel =
    activity.translatedEventType?.trim() || humanizeEventType(activity.eventType);

  if (!eventLabel) {
    return null;
  }

  const date = activity.eventTime ? activity.eventTime.slice(0, 10) : null;
  const objectName = activity.objectName?.trim();
  const objectType = activity.objectType?.trim();
  const objectPart = objectName
    ? ` on "${objectName}"${objectType ? ` [${objectType}]` : ""}`
    : "";

  const oldValue = formatActivityValue(activity.valueOld);
  const newValue = formatActivityValue(activity.valueNew);
  const valueChange = oldValue && newValue ? ` (${oldValue} → ${newValue})` : "";

  const datePart = date ? `${date}: ` : "";
  return `- ${datePart}${eventLabel}${objectPart}${valueChange}`.trim();
}

export function summarizeActivitiesForPrompt(
  activities: ActivityRecord[],
  maxItems = 10,
): string {
  if (!activities.length) {
    return "";
  }

  const sorted = [...activities].sort((a, b) => {
    const aTime = a.eventTime ?? "";
    const bTime = b.eventTime ?? "";
    return bTime.localeCompare(aTime);
  });

  const lines: string[] = [];
  for (const activity of sorted) {
    const line = formatActivityLine(activity);
    if (line) {
      lines.push(line);
    }
    if (lines.length >= maxItems) {
      break;
    }
  }

  if (activities.length > lines.length) {
    lines.push(
      `- (+ ${activities.length - lines.length} additional edit${activities.length - lines.length === 1 ? "" : "s"} omitted for brevity)`,
    );
  }

  return lines.join("\n");
}

export function deriveToneProfile(toneExamples: string): ToneProfile {
  const samples = splitToneExamples(toneExamples);
  const joinedExamples = samples.join("\n\n");
  const normalized = joinedExamples.toLowerCase();
  const averageWords = sentenceWordAverage(joinedExamples);
  const wordRange = getWordRange(samples);

  return {
    sampleCount: samples.length,
    brevity: averageWords > 20 ? "detailed" : averageWords > 12 ? "balanced" : "tight",
    perspective: /\b(i|my|from my side|i'm|i'll)\b/.test(normalized)
      ? "first-person"
      : /\b(we|our|team)\b/.test(normalized)
        ? "team"
        : "neutral",
    openingStyle: inferOpeningStyle(samples),
    structureStyle: inferStructureStyle(samples),
    metricStyle: inferMetricStyle(samples),
    recommendationStyle: inferRecommendationStyle(normalized),
    confidence: /\b(maybe|might|keep an eye|want to watch|monitor|showing potential)\b/.test(
      normalized,
    )
      ? "restrained"
      : "direct",
    targetWordCount: wordRange.target,
    wordRange: {
      min: wordRange.min,
      max: wordRange.max,
    },
    numericStyle: inferNumericStyle(samples),
    commonPhrases: collectCommonPhrases(normalized),
    contentVocabulary: extractContentVocabulary(samples),
  };
}

export async function buildToneProfile(toneExamples: string): Promise<ToneProfile> {
  const heuristicProfile = deriveToneProfile(toneExamples);
  const samples = splitToneExamples(toneExamples);

  if (!samples.length) {
    return heuristicProfile;
  }

  try {
    const result = await requestOpenRouterJson({
      systemPrompt:
        "You analyze client-facing reporting messages for Metis AI. Return valid JSON only with keys sampleCount, brevity, perspective, openingStyle, structureStyle, metricStyle, recommendationStyle, confidence, targetWordCount, wordRange, numericStyle, commonPhrases. Focus on writing style only. numericStyle must include currencyDecimalPlaces, percentDecimalPlaces, plainNumberDecimalPlaces, and useThousandsSeparators.",
      userPayload: {
        task: "Extract the communication style and numeric formatting conventions from these client-reporting examples.",
        allowedEnums: {
          brevity: ["tight", "balanced", "detailed"],
          perspective: ["first-person", "team", "neutral"],
          openingStyle: [
            "quick-update",
            "greeting-plus-update",
            "report-heading",
            "neutral",
          ],
          structureStyle: ["single-block", "multi-paragraph", "metrics-then-insight"],
          metricStyle: ["conversational", "mixed", "dense"],
          recommendationStyle: [
            "monitor-and-tweak",
            "test-and-iterate",
            "direct-action",
            "neutral",
          ],
          confidence: ["restrained", "direct"],
        },
        examples: samples.slice(0, 6),
        heuristicProfile,
      },
      models: getCommunicatorModelCandidates(),
      temperature: getToneProfileTemperature(),
    });

    return validateToneProfile(result.data, heuristicProfile);
  } catch {
    return heuristicProfile;
  }
}

const COMPOSE_SYSTEM_PROMPT =
  "You are writing a client-facing performance update as the same author who wrote the EXAMPLES below. Channel their voice: their sentence rhythm, vocabulary, idioms, signature phrases, paragraph shape, greetings, sign-offs, and quirks. The EXAMPLES are the gospel for HOW to write. The NARRATIVE_FACTS, METRICS_PRIMARY, METRICS_OPTIONAL, CAMPAIGNS, and CHANGES blocks are the gospel for WHAT to say — every metric and claim must come from these, never invented. METRICS_PRIMARY lists the metrics this author typically discusses; prefer those when you mention numbers. METRICS_OPTIONAL is available only if the narrative genuinely requires it — do not list those metrics for completeness; do not exceed the author's typical metric density by more than one. CAMPAIGNS may be referenced by name only if the EXAMPLES show this author naming campaigns. CHANGES (when present) describes campaign edits made during the period; weave only the relevant ones, in the way the EXAMPLES handle edits — never force a separate 'changes' section unless the EXAMPLES have one. When mentioning numbers, prefer the exact formatted strings supplied unless a clear pattern from the EXAMPLES dictates a different style for the same value. Your job is to write a fresh message that a long-time reader would assume the author wrote themselves. Return valid JSON only: {\"clientMessage\": \"...\"}.";

function buildNarrativeFactsBlock(
  snapshot: SnapshotForToneRewrite,
  report: ReportForToneRewrite,
) {
  const list = (items: string[]) =>
    items.length ? items.map((item) => `- ${item}`).join("\n") : "- (none)";

  return `<NARRATIVE_FACTS>
Date range: ${snapshot.dateRange.label}
Row count: ${snapshot.rowCount}
Executive summary: ${report.executiveSummary}
What changed:
${list(report.whatChanged)}
Risks:
${list(report.risks)}
Next actions:
${list(report.nextActions)}
</NARRATIVE_FACTS>`;
}

function buildMetricsBlocks(
  snapshot: SnapshotForToneRewrite,
  toneProfile: ToneProfile,
) {
  const rows = buildMetricRows(snapshot, toneProfile);
  const { primary, optional } = partitionMetricRows(rows, toneProfile.contentVocabulary);
  const vocabulary = toneProfile.contentVocabulary;

  const densityHint = vocabulary.averageMetricCount > 0
    ? `The author typically references about ${vocabulary.averageMetricCount} distinct metric(s) per message. Match that density — do not exceed it by more than one.`
    : "The examples do not heavily reference metrics by name. Keep metric mentions minimal unless the narrative requires them.";

  const primaryBlock = `<METRICS_PRIMARY>
${primary.length ? "These are the metrics this author typically discusses. Prefer these when mentioning numbers." : "(no metric vocabulary detected from the examples — see METRICS_OPTIONAL for what is available)"}
${renderMetricRows(primary)}

${densityHint}
</METRICS_PRIMARY>`;

  const optionalBlock = `<METRICS_OPTIONAL>
Other metrics available for reference. Use only if the narrative genuinely requires them — do not list these for completeness.
${renderMetricRows(optional)}
</METRICS_OPTIONAL>`;

  return `${primaryBlock}\n\n${optionalBlock}`;
}

function buildCampaignsBlock(
  snapshot: SnapshotForToneRewrite,
  toneProfile: ToneProfile,
) {
  if (!toneProfile.contentVocabulary.mentionsCampaigns) {
    return "";
  }

  const formatted = buildFormattedSnapshot(snapshot, toneProfile);
  if (!formatted.topCampaigns.length) {
    return "";
  }

  const lines = formatted.topCampaigns
    .slice(0, 5)
    .map((campaign) => {
      const parts: string[] = [];
      if (campaign.spend) parts.push(`spend ${campaign.spend}`);
      if (campaign.clicks) parts.push(`${campaign.clicks} clicks`);
      if (campaign.ctr) parts.push(`CTR ${campaign.ctr}`);
      if (campaign.cpc) parts.push(`CPC ${campaign.cpc}`);
      const detail = parts.length ? parts.join(", ") : "no headline metrics available";
      const name = campaign.campaignName ?? "Unnamed campaign";
      const objective = campaign.objective ? ` [${campaign.objective}]` : "";
      return `- "${name}"${objective} — ${detail}`;
    })
    .join("\n");

  return `<CAMPAIGNS>
Top campaigns by spend. This author typically references campaigns by name — use one or two if the narrative calls for it, never list them all.
${lines}
</CAMPAIGNS>`;
}

function buildExamplesBlock(samples: string[]) {
  if (!samples.length) {
    return "";
  }

  const blocks = samples
    .map(
      (sample, index) =>
        `<example index="${index + 1}">\n${sample}\n</example>`,
    )
    .join("\n\n");

  return `<EXAMPLES>
The following are real client messages this author has sent before. Treat them as exemplars of the author's voice — match their sentence rhythm, vocabulary, idioms, signature phrases, paragraph shape, greetings, and sign-offs.

${blocks}
</EXAMPLES>`;
}

export async function composeClientMessage({
  report,
  snapshot,
  toneExamples,
  toneProfile,
  critiqueFeedback,
  changesSummary,
}: {
  report: ReportForToneRewrite;
  snapshot: SnapshotForToneRewrite;
  toneExamples: string;
  toneProfile: ToneProfile;
  critiqueFeedback?: string[];
  changesSummary?: string | null;
}) {
  const samples = splitToneExamples(toneExamples).slice(0, 8);
  const examplesBlock = buildExamplesBlock(samples);
  const narrativeFactsBlock = buildNarrativeFactsBlock(snapshot, report);
  const metricsBlocks = buildMetricsBlocks(snapshot, toneProfile);
  const campaignsBlock = buildCampaignsBlock(snapshot, toneProfile);
  const lengthHint = `Target around ${toneProfile.targetWordCount} words, typically between ${toneProfile.wordRange.min} and ${toneProfile.wordRange.max}, to match the examples.`;

  const critiqueBlock =
    critiqueFeedback && critiqueFeedback.length
      ? `<CRITIQUE>
A previous draft scored low on voice match. Fix these specific mismatches while keeping every fact intact and never inventing numbers:
${critiqueFeedback.map((item) => `- ${item}`).join("\n")}
</CRITIQUE>

`
      : "";

  const trimmedChanges = changesSummary?.trim() ?? "";
  const changesBlock = trimmedChanges
    ? `<CHANGES>
Campaign edits made by this author during the reporting window. Weave only the relevant ones into the message in the way the EXAMPLES handle changes — do not force a separate "changes" section unless the EXAMPLES have one.
${trimmedChanges}
</CHANGES>

`
    : "";

  const sections = [
    critiqueBlock,
    examplesBlock,
    "",
    changesBlock,
    metricsBlocks,
    "",
    campaignsBlock,
    campaignsBlock ? "" : null,
    narrativeFactsBlock,
    "",
    `<LENGTH>\n${lengthHint}\n</LENGTH>`,
    "",
    `<TASK>\nWrite the client update now. Channel the EXAMPLES voice. Use only the facts provided. Never invent numbers. Keep it Slack-safe and ready to send as-is. Output JSON: {"clientMessage": "..."}.\n</TASK>`,
  ].filter((value): value is string => typeof value === "string" && value !== "");

  const userMessage = sections.join("\n\n");

  const result = await requestOpenRouterJson({
    systemPrompt: COMPOSE_SYSTEM_PROMPT,
    userMessage,
    models: getCommunicatorModelCandidates(),
    temperature: getComposeTemperature(),
  });

  if (
    !result.data ||
    typeof result.data !== "object" ||
    typeof (result.data as { clientMessage?: unknown }).clientMessage !== "string"
  ) {
    throw new Error("Compose response was missing clientMessage.");
  }

  const raw = (result.data as { clientMessage: string }).clientMessage.trim();
  return {
    message: normalizeMessageNumericFormatting(raw, toneProfile, samples),
    model: result.model as string,
    samples,
  };
}

function getVoiceJudgeModelCandidates() {
  const explicit = process.env.OPENROUTER_TONE_JUDGE_MODEL?.trim();

  if (explicit) {
    return explicit
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-5.4-mini"];
}

function getVoiceRegenerateThreshold() {
  const configured = Number(process.env.METIS_TONE_REGENERATE_THRESHOLD ?? "");
  return Number.isFinite(configured) ? clamp(configured, 0, 10) : 7;
}

const VOICE_JUDGE_SYSTEM_PROMPT =
  "You are a voice-match judge for client reporting messages. Compare a CANDIDATE message against EXAMPLES written by the same author. Score how convincingly the candidate sounds like the same author wrote it, on a 0-10 scale where 10 = a long-time reader would assume the author wrote it themselves and 0 = clearly different voice. Judge voice only: sentence rhythm, vocabulary, idioms, signature phrases, paragraph shape, greetings, sign-offs, level of formality, pacing, and number-formatting style. Ignore factual content — that is verified elsewhere. Return valid JSON only: {\"score\": number, \"mismatches\": string[]} where mismatches is a list of concrete, fixable style issues (e.g. \"opens with a generic greeting; examples open with 'Quick update from my side'\"). Keep mismatches to at most 5 items, each one short and actionable.";

export async function gradeVoiceMatch({
  clientMessage,
  samples,
}: {
  clientMessage: string;
  samples: string[];
}): Promise<VoiceMatchVerdict> {
  if (!samples.length || !clientMessage.trim()) {
    return { score: 10, mismatches: [], shouldRegenerate: false };
  }

  const exampleBlocks = samples
    .map(
      (sample, index) =>
        `<example index="${index + 1}">\n${sample}\n</example>`,
    )
    .join("\n\n");

  const userMessage = `<EXAMPLES>
${exampleBlocks}
</EXAMPLES>

<CANDIDATE>
${clientMessage}
</CANDIDATE>

<TASK>
Score the candidate against the examples on voice only. Output JSON: {"score": 0-10, "mismatches": [string, ...]}.
</TASK>`;

  const result = await requestOpenRouterJson({
    systemPrompt: VOICE_JUDGE_SYSTEM_PROMPT,
    userMessage,
    models: getVoiceJudgeModelCandidates(),
    temperature: 0,
  });

  const data = result.data as { score?: unknown; mismatches?: unknown } | null;
  const rawScore =
    typeof data?.score === "number" && Number.isFinite(data.score) ? data.score : 0;
  const score = clamp(roundToInteger(rawScore), 0, 10);
  const mismatches = Array.isArray(data?.mismatches)
    ? data.mismatches
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const threshold = getVoiceRegenerateThreshold();

  return {
    score,
    mismatches,
    shouldRegenerate: score < threshold,
  };
}

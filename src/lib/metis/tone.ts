import { requestOpenRouterJson } from "../../../scripts/pocs/lib/llm.mjs";

import {
  selectPrimaryMetrics,
  type MetaObjective,
  type SnapshotTotals as SnapshotTotalsForSelection,
} from "@/lib/metis/metric-selection";
import type {
  ContentVocabulary,
  FactMatchVerdict,
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
  // Match "clicks" but NOT "link clicks" (handled by linkClicks below). The
  // negative lookbehind on \blink\s+ keeps "link clicks" out of this bucket.
  { pattern: /\b(?<!link\s)clicks?\b/i, metric: "clicks" },
  { pattern: /\b(ctr|click[\s-]through(?:\s+rate)?)\b/i, metric: "ctr" },
  { pattern: /\bcpm\b/i, metric: "cpm" },
  { pattern: /\b(cpc|cost\s+per\s+click)\b/i, metric: "cpc" },
  { pattern: /\bfrequency\b/i, metric: "frequency" },
  // ROAS is its own metric, not lumped into "results". Operators report it
  // separately because it's a ratio, not a count.
  { pattern: /\b(roas|return\s+on\s+ad\s+spend)\b/i, metric: "roas" },
  // AOV — average order value. Common in e-commerce reporting alongside ROAS.
  { pattern: /\b(aov|average\s+order\s+value|order\s+value)\b/i, metric: "aov" },
  // Purchase value / revenue / conversion value — the $ figure behind ROAS.
  {
    pattern:
      /\b(purchase\s+value|conversion\s+value|revenue|sales\s+value|total\s+sales)\b/i,
    metric: "purchaseValue",
  },
  // Link clicks — distinct from total clicks. Traffic objective lead metric.
  { pattern: /\blink\s+clicks?\b/i, metric: "linkClicks" },
  // Landing page views — post-click funnel step.
  { pattern: /\b(lpv|landing\s+page\s+views?)\b/i, metric: "lpv" },
  {
    pattern:
      /\b(results?|conversions?|purchases?|leads?|sign[\s-]?ups?|signups?|installs?)\b/i,
    metric: "results",
  },
  {
    pattern:
      /\b(cost\s+per\s+(result|purchase|lead|action|signup|sign[\s-]?up|conversion|install|acquisition)|cpp|cpa|cpl|cpi|cost\/result)\b/i,
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

  // Sales-objective extras. Only populated when the snapshot carries them
  // (caller computes from purchase action_values). Each row is conditional
  // so non-sales snapshots don't suddenly grow nulls.
  const roasValue = formatStyleValue(
    snapshot.totals.roas ?? null,
    Math.max(numericStyle.currencyDecimalPlaces, 2),
    numericStyle.useThousandsSeparators,
    "plain",
  );
  push("roas", "ROAS", roasValue);

  const aovValue = formatStyleValue(
    snapshot.totals.aov ?? null,
    numericStyle.currencyDecimalPlaces,
    numericStyle.useThousandsSeparators,
    "currency",
  );
  push("aov", "AOV", aovValue);

  const purchaseValue = formatStyleValue(
    snapshot.totals.purchaseValue ?? null,
    numericStyle.currencyDecimalPlaces,
    numericStyle.useThousandsSeparators,
    "currency",
  );
  push("purchaseValue", "Purchase value", purchaseValue);

  const linkClicksValue = formatStyleValue(
    snapshot.totals.linkClicks ?? null,
    0,
    numericStyle.useThousandsSeparators,
    "plain",
  );
  push("linkClicks", "Link clicks", linkClicksValue);

  const lpvValue = formatStyleValue(
    snapshot.totals.lpv ?? null,
    0,
    numericStyle.useThousandsSeparators,
    "plain",
  );
  push("lpv", "Landing page views", lpvValue);

  return rows;
}

/**
 * Partitions metric rows into PRIMARY (what the LLM should lead with) and
 * OPTIONAL (kept available but the LLM should only reach for them if the
 * narrative requires it).
 *
 * Selection logic lives in src/lib/metis/metric-selection.ts. It merges:
 *   - the user's tone-example vocabulary (operator knows best)
 *   - codified media-buyer defaults per Meta campaign objective
 *   - movement signals (e.g. frequency > 3 = saturation, surface it)
 *
 * The order returned by selectPrimaryMetrics matters — the renderer keeps
 * that order in the prompt so the lead metric for the user's voice always
 * shows up first.
 */
function partitionMetricRows(
  rows: MetricRow[],
  vocabulary: ContentVocabulary,
  dominantObjective: MetaObjective,
  totals: SnapshotTotalsForSelection,
) {
  const selected = selectPrimaryMetrics({
    vocabulary,
    dominantObjective,
    totals,
  });
  const selectedSet = new Set<MetricToken>(selected as MetricToken[]);

  const rowByToken = new Map<MetricToken, MetricRow>();
  for (const row of rows) {
    rowByToken.set(row.token, row);
  }

  // PRIMARY rows are emitted in selection order, not insertion order from
  // buildMetricRows. The lead metric the operator's voice expects shows up
  // first this way.
  const primary: MetricRow[] = [];
  for (const token of selected as MetricToken[]) {
    const row = rowByToken.get(token);
    if (row) {
      primary.push(row);
    }
  }

  const optional: MetricRow[] = [];
  for (const row of rows) {
    if (!selectedSet.has(row.token)) {
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

/**
 * Canonical direction labels used in both the compose prompt and the
 * deterministic fact-check (see src/lib/metis/fact-check.ts). Keeping these
 * in one place ensures the LLM's allowed verbs and the post-check's
 * expected verbs stay in lockstep.
 */
export type ActivityDirection =
  | "INCREASED"
  | "DECREASED"
  | "PAUSED"
  | "RESUMED"
  | "CREATED"
  | "DELETED"
  | "EDITED";

export type ActivityField =
  | "DAILY_BUDGET"
  | "LIFETIME_BUDGET"
  | "BID_AMOUNT"
  | "STATUS"
  | "CREATIVE"
  | "TARGETING"
  | "NAME"
  | "OTHER";

/**
 * Three-tier actor model:
 * - MANUAL: human user took an action via Meta UI/API. Message can use
 *   first-person verbiage ("I bumped...").
 * - RULE: a rule the user authored fired automatically. Message must use
 *   impersonal verbiage ("budget on X was raised after a rule fired").
 * - SYSTEM: platform/integration automated (Shopify audience refresh,
 *   ASA auto-audience, Meta Advantage+ creative auto-variations, etc).
 *   These are filtered out of CHANGES entirely — they're noise from the
 *   reporting perspective.
 *
 * The classification is heuristic and deterministic (no LLM). It runs in
 * deriveCanonicalActivity. Run logs include a `systemActivitiesFiltered`
 * count and the dropped names so the operator can audit it.
 */
export type ActivityActorClass = "MANUAL" | "RULE" | "SYSTEM";

export type CanonicalActivity = {
  date: string | null;
  objectName: string | null;
  objectType: string | null;
  field: ActivityField;
  direction: ActivityDirection;
  magnitudePercent: number | null;
  valueOld: string | null;
  valueNew: string | null;
  actorClass: ActivityActorClass;
  actorName: string | null;
};

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

function parseNumericLike(value: string | null): number | null {
  if (!value) {
    return null;
  }
  // Strip currency symbols, commas, units; preserve sign and decimal.
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (!cleaned) {
    return null;
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Names of objects that are managed by external systems / integrations
 * and refresh on their own schedule. Edits on these are always noise.
 * Matched case-insensitively against the activity's object name.
 */
const SYSTEM_OBJECT_NAME_PATTERNS: RegExp[] = [
  // Meta Advantage+ Shopping Audience and other auto-built audiences
  /^asa_auto/i,
  /^asa_/i,
  /^_default_/i,
  /^lookalike\s+\(auto/i,
  // Shopify integration auto-syncs customer / visitor audiences daily
  /^shopify audiences\s*-/i,
  // Klaviyo / Mailchimp / Zapier custom audience auto-resyncs
  /^klaviyo\s+(audience|sync)/i,
  /^mailchimp\s+sync/i,
  // Common pattern for automated catalog audiences
  /\(auto-?refresh/i,
  /auto[\s_-]*custom[\s_-]*audience/i,
];

/**
 * Actor names Meta sets when the change comes from the platform itself
 * rather than a human user. Compared case-insensitively as substrings.
 */
const SYSTEM_ACTOR_NAME_PATTERNS: RegExp[] = [
  /\bsystem\b/i,
  /\bmeta\b/i,
  /\bfacebook\b/i,
  /\bshopify\b/i,
  /\bpixel\b/i,
  /\bcatalog sync\b/i,
  /\baggregated event measurement\b/i,
  /\baem\b/i,
];

/**
 * Event types that are inherently automated — even when an actor_name
 * appears, the change is platform-driven, not a real user reporting
 * decision. Matched as substring against eventType + translatedEventType.
 */
const SYSTEM_EVENT_TYPE_PATTERNS: RegExp[] = [
  /pixel[_\s]*event/i,
  /optimization[_\s]*event/i,
  /catalog[_\s]*sync/i,
  /audience[_\s]*resync/i,
  /\baem[_\s]/i,
  /creative[_\s]*auto[_\s]*variation/i,
  /advantage[_\s].*auto/i,
  /custom[_\s]*conversion[_\s]*adjust/i,
  /app[_\s]*event[_\s]*source/i,
  /delivery[_\s]*system[_\s]*optimization/i,
];

/**
 * Event types that indicate a rule the user authored fired (vs. a manual
 * click in the UI). Matched as substring.
 */
const RULE_EVENT_TYPE_PATTERNS: RegExp[] = [
  /automated[_\s]*rule/i,
  /rule[_\s]*fired/i,
  /\brule[_\s]+/i,
];

function isSystemObjectName(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }
  return SYSTEM_OBJECT_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

function isSystemActorName(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }
  return SYSTEM_ACTOR_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

function matchesAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

/**
 * Classifies an activity's actor source. Decision tree:
 *
 * 1. Event type matches a rule-fire pattern → RULE
 *    (user authored the rule; the action is intentional but not manual)
 * 2. Object name matches a known system-managed pattern → SYSTEM
 *    (Shopify Audiences, asa_*, etc — always noise)
 * 3. Actor name matches a system-actor pattern OR is empty/null → SYSTEM
 *    (Meta logs platform-driven events with no human actor)
 * 4. Event type matches a known automated event pattern → SYSTEM
 * 5. Otherwise → MANUAL (a human user actor with a real edit)
 */
export function classifyActivityActor(
  activity: ActivityRecord,
): ActivityActorClass {
  const eventTypeHaystack = `${activity.eventType ?? ""} ${activity.translatedEventType ?? ""}`;

  if (matchesAnyPattern(eventTypeHaystack, RULE_EVENT_TYPE_PATTERNS)) {
    return "RULE";
  }

  if (isSystemObjectName(activity.objectName)) {
    return "SYSTEM";
  }

  if (isSystemActorName(activity.actorName) || !activity.actorName?.trim()) {
    return "SYSTEM";
  }

  if (matchesAnyPattern(eventTypeHaystack, SYSTEM_EVENT_TYPE_PATTERNS)) {
    return "SYSTEM";
  }

  return "MANUAL";
}

function classifyStatusDirection(
  oldVal: string | null,
  newVal: string | null,
): ActivityDirection | null {
  const o = (oldVal ?? "").trim().toUpperCase();
  const n = (newVal ?? "").trim().toUpperCase();
  if (!o && !n) {
    return null;
  }
  if (n === "PAUSED" || n === "ARCHIVED") {
    return "PAUSED";
  }
  if (n === "DELETED") {
    return "DELETED";
  }
  if ((o === "PAUSED" || o === "ARCHIVED") && n === "ACTIVE") {
    return "RESUMED";
  }
  if (!o && n === "ACTIVE") {
    return "CREATED";
  }
  return "EDITED";
}

export function deriveCanonicalActivity(
  activity: ActivityRecord,
): CanonicalActivity | null {
  const eventTypeRaw = (activity.eventType ?? "").toLowerCase();
  const translated = (activity.translatedEventType ?? "").toLowerCase();
  const haystack = `${eventTypeRaw} ${translated}`;
  const oldValue = formatActivityValue(activity.valueOld);
  const newValue = formatActivityValue(activity.valueNew);
  const date = activity.eventTime ? activity.eventTime.slice(0, 10) : null;
  const objectName = activity.objectName?.trim() ?? null;
  const objectType = activity.objectType?.trim() ?? null;

  let field: ActivityField = "OTHER";
  let direction: ActivityDirection = "EDITED";
  let magnitudePercent: number | null = null;

  // Field classification — order matters (more specific first).
  if (haystack.includes("daily") && haystack.includes("budget")) {
    field = "DAILY_BUDGET";
  } else if (haystack.includes("lifetime") && haystack.includes("budget")) {
    field = "LIFETIME_BUDGET";
  } else if (haystack.includes("budget")) {
    field = "DAILY_BUDGET";
  } else if (haystack.includes("bid")) {
    field = "BID_AMOUNT";
  } else if (
    haystack.includes("status") ||
    haystack.includes("pause") ||
    haystack.includes("resume") ||
    haystack.includes("activate") ||
    haystack.includes("deactivate")
  ) {
    field = "STATUS";
  } else if (haystack.includes("creative") || haystack.includes("ad ")) {
    field = "CREATIVE";
  } else if (haystack.includes("target") || haystack.includes("audience")) {
    field = "TARGETING";
  } else if (haystack.includes("name") || haystack.includes("rename")) {
    field = "NAME";
  }

  // Direction classification.
  if (field === "STATUS") {
    direction = classifyStatusDirection(oldValue, newValue) ?? "EDITED";
  } else if (haystack.includes("delete") || haystack.includes("remove")) {
    direction = "DELETED";
  } else if (
    haystack.includes("create") ||
    haystack.includes("add") ||
    (!oldValue && newValue)
  ) {
    direction = "CREATED";
  } else if (haystack.includes("pause")) {
    direction = "PAUSED";
    field = "STATUS";
  } else if (haystack.includes("resume") || haystack.includes("activate")) {
    direction = "RESUMED";
    field = "STATUS";
  } else if (field === "DAILY_BUDGET" || field === "LIFETIME_BUDGET" || field === "BID_AMOUNT") {
    const oldNum = parseNumericLike(oldValue);
    const newNum = parseNumericLike(newValue);
    if (oldNum !== null && newNum !== null && oldNum !== 0) {
      const delta = newNum - oldNum;
      magnitudePercent = (delta / Math.abs(oldNum)) * 100;
      if (newNum > oldNum) {
        direction = "INCREASED";
      } else if (newNum < oldNum) {
        direction = "DECREASED";
      } else {
        direction = "EDITED";
      }
    } else if (newValue && !oldValue) {
      direction = "CREATED";
    }
  }

  // If we couldn't infer anything useful at all, drop the row to avoid
  // injecting empty noise the LLM will try to fill in.
  if (!objectName && !oldValue && !newValue && direction === "EDITED" && field === "OTHER") {
    return null;
  }

  const actorClass = classifyActivityActor(activity);
  const actorName = activity.actorName?.trim() ?? null;

  return {
    date,
    objectName,
    objectType,
    field,
    direction,
    magnitudePercent,
    valueOld: oldValue,
    valueNew: newValue,
    actorClass,
    actorName,
  };
}

function formatMagnitude(magnitudePercent: number | null): string {
  if (magnitudePercent === null || !Number.isFinite(magnitudePercent)) {
    return "";
  }
  const sign = magnitudePercent > 0 ? "+" : "";
  const rounded = Math.abs(magnitudePercent) >= 10
    ? Math.round(magnitudePercent)
    : Math.round(magnitudePercent * 10) / 10;
  return ` ${sign}${rounded}%`;
}

function formatCanonicalLine(activity: CanonicalActivity): string {
  const datePart = activity.date ?? "unknown-date";
  const namePart = activity.objectName
    ? `"${activity.objectName}"${activity.objectType ? ` (${activity.objectType})` : ""}`
    : "(unnamed object)";
  const magnitudePart = formatMagnitude(activity.magnitudePercent);
  const valuePart =
    activity.valueOld && activity.valueNew
      ? ` | ${activity.valueOld} → ${activity.valueNew}`
      : activity.valueNew
        ? ` | (new) ${activity.valueNew}`
        : activity.valueOld
          ? ` | ${activity.valueOld} → (removed)`
          : "";
  // ACTOR column tells the LLM whether first-person or impersonal verbiage
  // is appropriate. SYSTEM rows never reach here (filtered upstream).
  const actorPart = ` | ACTOR:${activity.actorClass}`;
  return `- ${datePart} | ${namePart} | ${activity.field} | ${activity.direction}${magnitudePart}${actorPart}${valuePart}`;
}

/**
 * Priority for truncation: higher number = more important to retain.
 * The intent is that manual budget/status changes ALWAYS survive even
 * when an account has dozens of automated audience refreshes piled up.
 */
function activityPriorityScore(activity: CanonicalActivity): number {
  const tierBase =
    activity.actorClass === "MANUAL" ? 1000 : activity.actorClass === "RULE" ? 500 : 0;

  const fieldWeight: Record<ActivityField, number> = {
    DAILY_BUDGET: 100,
    LIFETIME_BUDGET: 100,
    BID_AMOUNT: 90,
    STATUS: 80,
    CREATIVE: 60,
    NAME: 40,
    TARGETING: 30,
    OTHER: 10,
  };

  return tierBase + (fieldWeight[activity.field] ?? 0);
}

/**
 * Collapses near-duplicate rows. Two canonical activities collapse if
 * they share (objectName, field, direction) and their dates are within
 * 48h of each other. The kept row gets a "(edited Nx)" suffix on the
 * object name to preserve the signal that this happened repeatedly.
 *
 * Why: Meta routinely fires multiple TARGETING edits per audience per
 * day. Even when those slip through as MANUAL (rare), the LLM does not
 * need 6 near-identical rows — one row with a count is more useful.
 */
function dedupeCanonicalActivities(
  activities: CanonicalActivity[],
): CanonicalActivity[] {
  const buckets = new Map<string, CanonicalActivity[]>();
  for (const activity of activities) {
    const key = `${activity.objectName ?? "_"}::${activity.field}::${activity.direction}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(activity);
    } else {
      buckets.set(key, [activity]);
    }
  }

  const result: CanonicalActivity[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      result.push(bucket[0]);
      continue;
    }
    // Sort by date desc, keep the newest as the representative.
    bucket.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const head = bucket[0];
    const count = bucket.length;
    result.push({
      ...head,
      objectName: head.objectName
        ? `${head.objectName} (edited ${count}x in window)`
        : head.objectName,
    });
  }

  return result;
}

/**
 * Returns the structured-string CHANGES block plus the canonical activity
 * list. The canonical list is reused by the deterministic fact-check so the
 * LLM-facing text and the post-check verifier share one source of truth.
 *
 * Pipeline:
 *   1. Map every raw activity through deriveCanonicalActivity (which also
 *      classifies actor as MANUAL / RULE / SYSTEM).
 *   2. Drop SYSTEM rows unless METIS_INCLUDE_SYSTEM_ACTIVITIES env override
 *      is set. Track the dropped names for observability.
 *   3. Deduplicate near-identical rows (same object + field + direction).
 *   4. Sort by priority (MANUAL > RULE; budget/status > targeting), then
 *      date desc within tier.
 *   5. Truncate to maxItems (default 20).
 */
export function buildCanonicalActivities(
  activities: ActivityRecord[],
  maxItems = 20,
): {
  summary: string;
  canonical: CanonicalActivity[];
  systemActivitiesFiltered: number;
  systemActivityNames: string[];
} {
  if (!activities.length) {
    return {
      summary: "",
      canonical: [],
      systemActivitiesFiltered: 0,
      systemActivityNames: [],
    };
  }

  const allDerived: CanonicalActivity[] = [];
  for (const raw of activities) {
    const derived = deriveCanonicalActivity(raw);
    if (derived) {
      allDerived.push(derived);
    }
  }

  const includeSystem = (process.env.METIS_INCLUDE_SYSTEM_ACTIVITIES ?? "").trim() === "1";
  const systemActivities = allDerived.filter((a) => a.actorClass === "SYSTEM");
  const reportable = includeSystem
    ? allDerived
    : allDerived.filter((a) => a.actorClass !== "SYSTEM");

  const deduped = dedupeCanonicalActivities(reportable);

  deduped.sort((a, b) => {
    const priorityDelta = activityPriorityScore(b) - activityPriorityScore(a);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return (b.date ?? "").localeCompare(a.date ?? "");
  });

  const canonical = deduped.slice(0, maxItems);
  const lines = canonical.map(formatCanonicalLine);

  const omitted = deduped.length - canonical.length;
  if (omitted > 0) {
    lines.push(
      `- (+ ${omitted} additional edit${omitted === 1 ? "" : "s"} omitted for brevity)`,
    );
  }

  return {
    summary: lines.join("\n"),
    canonical,
    systemActivitiesFiltered: systemActivities.length,
    systemActivityNames: systemActivities
      .map((a) => a.objectName ?? "(unnamed)")
      .slice(0, 20),
  };
}

export function summarizeActivitiesForPrompt(
  activities: ActivityRecord[],
  maxItems = 10,
): string {
  return buildCanonicalActivities(activities, maxItems).summary;
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

export type OpenRouterUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  attempts: Array<{
    model: string;
    status: "success" | "http_error" | "empty_message" | "invalid_json";
    httpStatus: number | null;
    latencyMs: number;
    errorMessage: string | null;
  }>;
  attemptedModels: string[];
};

export type OpenRouterPrompts = {
  systemPrompt: string;
  userMessage: string;
  responseRaw: string;
};

type RequestOpenRouterJsonResult = {
  model: string;
  data: unknown;
  usage: OpenRouterUsage;
  prompts: OpenRouterPrompts;
};

export async function buildToneProfile(
  toneExamples: string,
): Promise<{
  profile: ToneProfile;
  model: string | null;
  usage: OpenRouterUsage | null;
  prompts: OpenRouterPrompts | null;
}> {
  const heuristicProfile = deriveToneProfile(toneExamples);
  const samples = splitToneExamples(toneExamples);

  if (!samples.length) {
    return { profile: heuristicProfile, model: null, usage: null, prompts: null };
  }

  try {
    const result = (await requestOpenRouterJson({
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
    })) as RequestOpenRouterJsonResult;

    return {
      profile: validateToneProfile(result.data, heuristicProfile),
      model: result.model,
      usage: result.usage,
      prompts: result.prompts,
    };
  } catch {
    return { profile: heuristicProfile, model: null, usage: null, prompts: null };
  }
}

const COMPOSE_SYSTEM_PROMPT =
  "You are writing a client-facing performance update as the same author who wrote the EXAMPLES below. Channel their voice: their sentence rhythm, vocabulary, idioms, signature phrases, paragraph shape, greetings, sign-offs, and quirks. The EXAMPLES are the gospel for HOW to write. The NARRATIVE_FACTS, METRICS_PRIMARY, METRICS_OPTIONAL, CAMPAIGNS, and CHANGES blocks are the gospel for WHAT to say — every metric and claim must come from these, never invented. METRICS_PRIMARY lists the metrics this author typically discusses; prefer those when you mention numbers. METRICS_OPTIONAL is available only if the narrative genuinely requires it — do not list those metrics for completeness; do not exceed the author's typical metric density by more than one. CAMPAIGNS may be referenced by name only if the EXAMPLES show this author naming campaigns. CHANGES (when present) describes campaign edits made during the period; weave only the relevant ones, in the way the EXAMPLES handle edits — never force a separate 'changes' section unless the EXAMPLES have one. CRITICAL — DIRECTION: each CHANGES row carries an explicit DIRECTION label (INCREASED, DECREASED, PAUSED, RESUMED, CREATED, DELETED, EDITED). The verb you choose MUST match that DIRECTION — never invert direction, never round 'DECREASED' up to 'tweaked', never paint a 'PAUSED' as a 'launched'. If INCREASED: raised/bumped/increased/scaled-up/boosted. If DECREASED: lowered/cut/reduced/trimmed/scaled-down. If PAUSED: paused/stopped/turned-off. If RESUMED: resumed/restarted/turned-on. If you cannot honestly describe an action without misrepresenting its direction, omit that action entirely. CRITICAL — ACTOR: each CHANGES row also carries an ACTOR label (ACTOR:MANUAL or ACTOR:RULE). For ACTOR:MANUAL rows you may use first-person verbiage ('I raised', 'I paused', etc.) because the user clicked this in Ads Manager. For ACTOR:RULE rows you MUST use impersonal/passive verbiage ('budget on X was raised', 'X was paused under the standing rule') — never claim 'I' did it, because a saved automated rule fired the change. Any CHANGES row you see HAS BEEN CLEANED — automated audience refreshes from Shopify, Klaviyo, Mailchimp, ASA / Advantage+ auto-audiences, pixel events, and other platform-managed background changes have already been filtered out and must NEVER be mentioned. If the CHANGES list is empty or all you have is fluff, do not invent campaign edits — write the update without change-talk. When mentioning numbers, prefer the exact formatted strings supplied unless a clear pattern from the EXAMPLES dictates a different style for the same value. Your job is to write a fresh message that a long-time reader would assume the author wrote themselves. Return valid JSON only: {\"clientMessage\": \"...\"}.";

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
  const dominantObjective: MetaObjective =
    (snapshot.dominantObjective as MetaObjective | undefined) ?? "UNKNOWN";
  const { primary, optional } = partitionMetricRows(
    rows,
    toneProfile.contentVocabulary,
    dominantObjective,
    snapshot.totals,
  );
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
}): Promise<{
  message: string;
  model: string;
  samples: string[];
  usage: OpenRouterUsage;
  prompts: OpenRouterPrompts;
}> {
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
Campaign edits during the reporting window. Each row is structured as:
  - DATE | "Campaign/Adset name" (type) | FIELD | DIRECTION [magnitude] | ACTOR:MANUAL|RULE | old → new

Automated audience refreshes (Shopify Audiences, Klaviyo, Mailchimp, ASA / Advantage+ auto-audiences, catalog auto-syncs, pixel events) have ALREADY been stripped from this list. Do NOT mention any audience refresh or system-driven event — only what appears below is real.

The DIRECTION label is non-negotiable. INCREASED = value went up. DECREASED = value went down. PAUSED, RESUMED, CREATED, DELETED, EDITED are literal. The verb in your sentence must match DIRECTION exactly.

The ACTOR label determines verbiage:
  - ACTOR:MANUAL — the user clicked this in Ads Manager. You may use first-person ("I raised", "I paused").
  - ACTOR:RULE — a saved rule fired this automatically. Use impersonal/passive ("budget on X was raised under the standing rule", "X was paused by the rule") — never claim "I" did it.

Weave only the relevant ones into the message in the way the EXAMPLES handle changes — do not force a separate "changes" section unless the EXAMPLES have one. If a row's DIRECTION is EDITED with no magnitude (we couldn't infer the change), omit it. If you cannot phrase an action accurately, omit it.

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

  const result = (await requestOpenRouterJson({
    systemPrompt: COMPOSE_SYSTEM_PROMPT,
    userMessage,
    models: getCommunicatorModelCandidates(),
    temperature: getComposeTemperature(),
  })) as RequestOpenRouterJsonResult;

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
    model: result.model,
    samples,
    usage: result.usage,
    prompts: result.prompts,
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
  // Default 8 (up from 7) — borderline voice mismatches like "spoke about
  // CPP instead of ROAS" were scoring 6-7 and not triggering regen. 8 means
  // anything below "would convincingly read as this author" regens once.
  return Number.isFinite(configured) ? clamp(configured, 0, 10) : 8;
}

const VOICE_JUDGE_SYSTEM_PROMPT =
  "You are a voice-match judge for client reporting messages. Compare a CANDIDATE message against EXAMPLES written by the same author. Score how convincingly the candidate sounds like the same author wrote it, on a 0-10 scale where 10 = a long-time reader would assume the author wrote it themselves and 0 = clearly different voice. Judge voice only: sentence rhythm, vocabulary, idioms, signature phrases, paragraph shape, greetings, sign-offs, level of formality, pacing, and number-formatting style. Ignore factual content — that is verified elsewhere. Return valid JSON only: {\"score\": number, \"mismatches\": string[]} where mismatches is a list of concrete, fixable style issues (e.g. \"opens with a generic greeting; examples open with 'Quick update from my side'\"). Keep mismatches to at most 5 items, each one short and actionable.";

export async function gradeVoiceMatch({
  clientMessage,
  samples,
}: {
  clientMessage: string;
  samples: string[];
}): Promise<
  VoiceMatchVerdict & {
    model: string | null;
    usage: OpenRouterUsage | null;
    prompts: OpenRouterPrompts | null;
  }
> {
  if (!samples.length || !clientMessage.trim()) {
    return {
      score: 10,
      mismatches: [],
      shouldRegenerate: false,
      model: null,
      usage: null,
      prompts: null,
    };
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

  const result = (await requestOpenRouterJson({
    systemPrompt: VOICE_JUDGE_SYSTEM_PROMPT,
    userMessage,
    models: getVoiceJudgeModelCandidates(),
    temperature: 0,
  })) as RequestOpenRouterJsonResult;

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
    model: result.model,
    usage: result.usage,
    prompts: result.prompts,
  };
}

function getFactJudgeModelCandidates() {
  const explicit = process.env.OPENROUTER_FACT_JUDGE_MODEL?.trim();
  if (explicit) {
    return explicit
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  // Default to the same cheap model the voice judge uses — they're both
  // tight, scoped reads of the candidate text.
  return getVoiceJudgeModelCandidates();
}

function getFactRegenerateThreshold() {
  const configured = Number(process.env.METIS_FACT_REGENERATE_THRESHOLD ?? "");
  return Number.isFinite(configured) ? clamp(configured, 0, 10) : 7;
}

/**
 * Fact-judge prompt is catalog-aware: it lists the media-buying failure
 * categories explicitly so a small cheap model has a checklist to scan
 * against, not vague intent. Each category in the prompt maps to a real
 * client-blast-radius risk (polarity flips, magnitude inflation, false
 * causal claims, etc.). Voice is OUT of scope here — that's gradeVoiceMatch.
 */
const FACT_JUDGE_SYSTEM_PROMPT =
  "You audit client-facing Meta-ads reporting messages for FACTUAL ACCURACY against a structured SOURCE_FACTS block. Score 0-10. Score 10 = every claim in the CANDIDATE message is exactly supported by SOURCE_FACTS. Score 0 = multiple invented, flipped, or unsupported claims. Ignore voice, tone, length, and style — those are judged elsewhere. CATEGORIES to check (flag any failure you find, listed in priority order): (1) DIRECTION-FLIP: any action verb that contradicts the DIRECTION label on a matching CHANGES row (e.g. message says 'bumped' but DIRECTION is DECREASED). (2) MAGNITUDE: percent/multiplier claims that don't match the magnitude in CHANGES or metric deltas (e.g. 'doubled' when actual was +10%). (3) ATTRIBUTION: action attributed to a campaign that doesn't appear in CHANGES, or wrong campaign named for a real action. (4) METRIC-DIRECTION: 'spend up' when totals show down, 'CTR rose' when flat or fell, etc. (5) METRIC-VALUE: dollar figures, percents, or counts that don't match NARRATIVE_FACTS / METRICS / CAMPAIGNS exactly. (6) FALSE-CAUSAL: claims of cause ('X drove Y') without supporting data in SOURCE_FACTS. (7) PHANTOM-COMMITMENT: forward promises ('next week I will…') that aren't in SOURCE_FACTS. (8) RECOMMENDATION-SAFETY: recommends scaling something that SOURCE_FACTS shows is failing, or pausing a top performer. Return valid JSON only: {\"score\": number, \"mismatches\": string[]} where each mismatch starts with the category label (e.g. \"DIRECTION-FLIP on 'Spring Sale': message says 'bumped budget' but CHANGES shows DECREASED -37.5%\"). Keep mismatches to at most 6 items, ordered by severity.";

export async function gradeFactMatch({
  clientMessage,
  sourceFacts,
}: {
  clientMessage: string;
  sourceFacts: string;
}): Promise<
  FactMatchVerdict & {
    model: string | null;
    usage: OpenRouterUsage | null;
    prompts: OpenRouterPrompts | null;
  }
> {
  if (!clientMessage.trim() || !sourceFacts.trim()) {
    return {
      score: 10,
      mismatches: [],
      shouldRegenerate: false,
      model: null,
      usage: null,
      prompts: null,
    };
  }

  const userMessage = `<SOURCE_FACTS>
${sourceFacts}
</SOURCE_FACTS>

<CANDIDATE>
${clientMessage}
</CANDIDATE>

<TASK>
Audit the CANDIDATE against SOURCE_FACTS. Walk the 8 categories in the system prompt. Output JSON: {"score": 0-10, "mismatches": [string, ...]}.
</TASK>`;

  const result = (await requestOpenRouterJson({
    systemPrompt: FACT_JUDGE_SYSTEM_PROMPT,
    userMessage,
    models: getFactJudgeModelCandidates(),
    temperature: 0,
  })) as RequestOpenRouterJsonResult;

  const data = result.data as { score?: unknown; mismatches?: unknown } | null;
  const rawScore =
    typeof data?.score === "number" && Number.isFinite(data.score) ? data.score : 0;
  const score = clamp(roundToInteger(rawScore), 0, 10);
  const mismatches = Array.isArray(data?.mismatches)
    ? data.mismatches
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  const threshold = getFactRegenerateThreshold();

  return {
    score,
    mismatches,
    shouldRegenerate: score < threshold,
    model: result.model,
    usage: result.usage,
    prompts: result.prompts,
  };
}

import { requestOpenRouterJson } from "../../../scripts/pocs/lib/llm.mjs";

import type { ReportingRunResponse, ToneProfile } from "@/lib/metis/types";

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

function getCommunicatorTemperature() {
  const configured = Number(process.env.OPENROUTER_CLIENT_MESSAGE_TEMPERATURE ?? "");
  return Number.isFinite(configured) ? configured : 0.35;
}

function getLengthGuidance(toneProfile: ToneProfile) {
  return `Target ${toneProfile.targetWordCount} words, typically between ${toneProfile.wordRange.min} and ${toneProfile.wordRange.max} words to match the examples.`;
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

function normalizeMessageNumericFormatting(message: string, toneProfile: ToneProfile) {
  const { currencyDecimalPlaces, percentDecimalPlaces, plainNumberDecimalPlaces } =
    toneProfile.numericStyle;

  return message
    .replace(/\$([0-9][0-9,]*\.[0-9]+)/g, (_match, value) => {
      const numeric = Number(String(value).replace(/,/g, ""));
      return Number.isFinite(numeric)
        ? formatStyleValue(
            numeric,
            currencyDecimalPlaces,
            toneProfile.numericStyle.useThousandsSeparators,
            "currency",
          ) ?? `$${value}`
        : `$${value}`;
    })
    .replace(/([0-9][0-9,]*\.[0-9]+)\s*%/g, (_match, value) => {
      const numeric = Number(String(value).replace(/,/g, ""));
      return Number.isFinite(numeric)
        ? formatStyleValue(
            numeric,
            percentDecimalPlaces,
            toneProfile.numericStyle.useThousandsSeparators,
            "percent",
          ) ?? `${value}%`
        : `${value}%`;
    })
    .replace(/(?<!\$)(\b[0-9][0-9,]*\.[0-9]+\b)(?!\s*%)/g, (_match, value) => {
      const numeric = Number(String(value).replace(/,/g, ""));
      return Number.isFinite(numeric)
        ? formatStyleValue(
            numeric,
            plainNumberDecimalPlaces,
            toneProfile.numericStyle.useThousandsSeparators,
            "plain",
          ) ?? value
        : value;
    });
}

function buildFactLock(snapshot: SnapshotForToneRewrite, report: ReportForToneRewrite, toneProfile: ToneProfile) {
  return {
    formattedSnapshot: buildFormattedSnapshot(snapshot, toneProfile),
    executiveSummary: report.executiveSummary,
    whatChanged: report.whatChanged,
    risks: report.risks,
    nextActions: report.nextActions,
    originalSlackMessage: normalizeMessageNumericFormatting(report.slackMessage, toneProfile),
  };
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
      temperature: getCommunicatorTemperature(),
    });

    return validateToneProfile(result.data, heuristicProfile);
  } catch {
    return heuristicProfile;
  }
}

export async function rewriteClientMessageTone({
  report,
  snapshot,
  toneExamples,
  toneProfile,
}: {
  report: ReportForToneRewrite;
  snapshot: SnapshotForToneRewrite;
  toneExamples: string;
  toneProfile: ToneProfile;
}) {
  const samples = splitToneExamples(toneExamples);
  const result = await requestOpenRouterJson({
    systemPrompt:
      "You are the Client Communicator step for Metis AI. Return valid JSON only with key clientMessage. Write a client-facing reporting update that closely matches the supplied examples in length, numeric formatting, pacing, paragraph shape, and phrasing style while preserving the exact facts from the factual input. Never invent metrics, never add extra decimal precision, and never emit reformatted numbers when a formatted metric string is already supplied.",
    userPayload: {
      task: "Write the final client-style reporting update.",
      outputRules: [
        getLengthGuidance(toneProfile),
        "Use the formatted metric strings from factLock whenever you mention numbers.",
        "Do not introduce any number that is not supported by factLock.",
        "Stay close to the examples on message length, paragraph count, and numeric presentation.",
        "Keep the message Slack-safe and ready to send as-is.",
      ],
      styleBrief: toneProfile,
      examples: samples.slice(0, 4),
      factLock: buildFactLock(snapshot, report, toneProfile),
    },
    models: getCommunicatorModelCandidates(),
    temperature: getCommunicatorTemperature(),
  });

  if (
    !result.data ||
    typeof result.data !== "object" ||
    typeof result.data.clientMessage !== "string"
  ) {
    throw new Error("Tone rewrite response was missing clientMessage.");
  }

  return normalizeMessageNumericFormatting(result.data.clientMessage.trim(), toneProfile);
}

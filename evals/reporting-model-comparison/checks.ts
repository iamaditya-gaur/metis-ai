import { checkActivityDirections } from "../../src/lib/metis/fact-check";
import type { CanonicalActivity } from "../../src/lib/metis/tone";

const NUMBER_PATTERN = /\$?\d[\d,]*(?:\.\d+)?(?:\s?[kKmM](?![A-Za-z]))?%?/g;

function flattenNumbers(value: unknown, output: number[] = []) {
  if (typeof value === "number" && Number.isFinite(value)) {
    output.push(value);
  } else if (typeof value === "string") {
    for (const token of value.match(NUMBER_PATTERN) ?? []) {
      const parsed = parseNumberToken(token);
      if (parsed !== null) output.push(parsed);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) flattenNumbers(item, output);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) flattenNumbers(item, output);
  }
  return output;
}

function parseNumberToken(token: string) {
  const compact = token.replace(/[$,%\s]/g, "").replace(/,/g, "");
  const suffix = compact.slice(-1).toLowerCase();
  const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : 1;
  const numeric = Number(multiplier === 1 ? compact : compact.slice(0, -1));
  return Number.isFinite(numeric) ? numeric * multiplier : null;
}

function isSupportedNumber(candidate: number, sourceValues: number[]) {
  if ([7, 24, 30, 2026].includes(candidate)) return true;
  return sourceValues.some((source) => {
    const absoluteDifference = Math.abs(source - candidate);
    const relativeDifference = absoluteDifference / Math.max(1, Math.abs(source));
    return (
      absoluteDifference <= 0.11 ||
      relativeDifference <= 0.02 ||
      Math.round(source) === Math.round(candidate)
    );
  });
}

export type CheckResult = {
  name: string;
  pass: boolean;
  detail: string;
};

export function checkGeneratedMessage({
  message,
  sourceData,
  canonicalActivities,
  dateRange,
  expectedRecipient,
}: {
  message: string;
  sourceData: unknown;
  canonicalActivities: CanonicalActivity[];
  dateRange?: { from: string; to: string };
  expectedRecipient?: string;
}): CheckResult[] {
  const normalized = message.trim();
  const sourceValues = flattenNumbers(sourceData);
  const unsupportedNumbers = (normalized.match(NUMBER_PATTERN) ?? [])
    .map((token) => ({ token, value: parseNumberToken(token) }))
    .filter(
      (entry): entry is { token: string; value: number } =>
        entry.value !== null && !isSupportedNumber(entry.value, sourceValues),
    );
  const lower = normalized.toLowerCase();
  const expectedRecipientNormalized = expectedRecipient?.trim().toLowerCase() || null;
  const greetingRecipient = normalized
    .match(/^(?:hey|hi)\s+(@[^,\n]{1,80})\s*,?/i)?.[1]
    ?.trim()
    .toLowerCase() ?? null;
  const recipientMatches = expectedRecipientNormalized
    ? greetingRecipient === expectedRecipientNormalized
    : true;
  const directionCheck = checkActivityDirections(message, canonicalActivities);
  const windowPattern = (() => {
    if (!dateRange) return null;
    const from = new Date(`${dateRange.from}T00:00:00Z`);
    const to = new Date(`${dateRange.to}T00:00:00Z`);
    if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) return null;
    const month = (date: Date) =>
      `(?:${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}|${date.toLocaleString("en-US", { month: "long", timeZone: "UTC" })})`;
    const start = `${month(from)}\\s+0?${from.getUTCDate()}`;
    const end =
      from.getUTCMonth() === to.getUTCMonth()
        ? `(?:${month(to)}\\s+)?0?${to.getUTCDate()}`
        : `${month(to)}\\s+0?${to.getUTCDate()}`;
    return new RegExp(`${start}\\s*(?:-|–|—|to)\\s*${end}`, "i");
  })();
  const windowPass = dateRange
    ? (message.includes(dateRange.from) && message.includes(dateRange.to)) ||
      Boolean(windowPattern?.test(message))
    : /aug(?:ust)?\s+24/i.test(message) ||
      /2026-08-24/.test(message) ||
      /last week|weekly/i.test(message);

  return [
    {
      name: "non-empty",
      pass: Boolean(normalized),
      detail: normalized ? "Message exists." : "Message is empty.",
    },
    {
      name: "reporting-window",
      pass: windowPass,
      detail: "Message should anchor the frozen reporting window.",
    },
    {
      name: "recipient",
      pass: recipientMatches,
      detail: recipientMatches
        ? "The opening uses the expected recipient."
        : greetingRecipient
          ? `The opening used ${greetingRecipient} instead of the expected recipient.`
          : "The opening did not include the expected recipient.",
    },
    {
      name: "numeric-grounding",
      pass: unsupportedNumbers.length === 0,
      detail: unsupportedNumbers.length
        ? `Unsupported numeric claims: ${unsupportedNumbers.map((item) => item.token).join(", ")}.`
        : "Numeric claims match or reasonably round supplied values.",
    },
    {
      name: "activity-direction",
      pass: directionCheck.ok,
      detail: directionCheck.ok
        ? "No campaign-action direction reversal found."
        : directionCheck.violations.map((item) => item.description).join(" "),
    },
  ];
}

export function allChecksPass(checks: CheckResult[]) {
  return checks.every((check) => check.pass);
}

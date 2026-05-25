/**
 * Deterministic fact-check that runs AFTER the compose step and BEFORE
 * the message is delivered. Its job is narrow but load-bearing: catch the
 * one failure mode that voice-only judging can't — the LLM reporting an
 * action in the wrong direction (e.g. "bumped budget on X" when the user
 * actually cut the budget on X).
 *
 * The check is intentionally regex-level and deterministic. It runs in
 * parallel with the LLM fact-judge; together they form belt and braces.
 * The deterministic side is the harder safety floor: when it flags a
 * contradiction after a regeneration attempt, the run falls back to the
 * operator-view message rather than ship a misleading claim.
 */

import type { ActivityDirection, CanonicalActivity } from "@/lib/metis/tone";

export type FactCheckViolation = {
  type: "direction-flip" | "phantom-action";
  objectName: string;
  field: string;
  expectedDirection: ActivityDirection;
  foundVerb: string;
  sentence: string;
  description: string;
};

export type FactCheckResult = {
  ok: boolean;
  violations: FactCheckViolation[];
};

type VerbClass = "UP" | "DOWN" | "PAUSE" | "RESUME" | "CREATE" | "DELETE";

const VERB_CLASSES: Record<VerbClass, string[]> = {
  UP: [
    "raised",
    "bumped",
    "increased",
    "scaled up",
    "scaled-up",
    "doubled",
    "tripled",
    "hiked",
    "pushed up",
    "boosted",
    "upped",
    "grew",
    "ramped",
    "ramped up",
    "added budget",
    "more budget",
  ],
  DOWN: [
    "lowered",
    "cut",
    "reduced",
    "decreased",
    "scaled down",
    "scaled-down",
    "trimmed",
    "dropped",
    "halved",
    "slashed",
    "pulled back",
    "dialled back",
    "dialed back",
    "throttled",
    "tightened",
  ],
  PAUSE: [
    "paused",
    "stopped",
    "killed",
    "turned off",
    "switched off",
    "halted",
    "shut down",
    "shut off",
    "deactivated",
  ],
  RESUME: [
    "resumed",
    "restarted",
    "turned on",
    "switched on",
    "relaunched",
    "reactivated",
    "kicked back on",
  ],
  CREATE: [
    "launched",
    "added",
    "created",
    "introduced",
    "rolled out",
    "spun up",
    "stood up",
    "set up",
    "tested",
  ],
  DELETE: [
    "deleted",
    "removed",
    "wiped",
    "took down",
  ],
};

const DIRECTION_TO_VERB_CLASS: Record<ActivityDirection, VerbClass | null> = {
  INCREASED: "UP",
  DECREASED: "DOWN",
  PAUSED: "PAUSE",
  RESUMED: "RESUME",
  CREATED: "CREATE",
  DELETED: "DELETE",
  EDITED: null,
};

/** Escapes a string for safe use inside a RegExp character class / pattern. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits a paragraph into rough sentences. Handles periods, question marks,
 * exclamation points, and newlines. Conservative — over-splitting is safer
 * than under-splitting for this check (we just lose a tiny bit of context).
 */
function splitSentences(message: string): string[] {
  return message
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Determines whether a sentence mentions the canonical activity's entity.
 * Matches the full quoted name, or a multi-word prefix (3+ words) of it to
 * tolerate the LLM trimming long campaign names.
 */
function sentenceMentionsEntity(sentence: string, objectName: string): boolean {
  const lowerSentence = sentence.toLowerCase();
  const lowerName = objectName.toLowerCase();

  if (lowerSentence.includes(lowerName)) {
    return true;
  }

  const words = lowerName.split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    const prefix = words.slice(0, 3).join(" ");
    if (lowerSentence.includes(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Scans a sentence for any verb from any class. Returns the first matching
 * class + matched phrase. Whole-phrase scan (not word-by-word) so we catch
 * multi-word verbs like "scaled up" or "turned off".
 */
function detectVerbClass(
  sentence: string,
): { verbClass: VerbClass; phrase: string } | null {
  const lower = sentence.toLowerCase();
  for (const [className, verbs] of Object.entries(VERB_CLASSES) as Array<
    [VerbClass, string[]]
  >) {
    for (const verb of verbs) {
      const pattern = new RegExp(`\\b${escapeRegex(verb)}\\b`, "i");
      if (pattern.test(lower)) {
        return { verbClass: className, phrase: verb };
      }
    }
  }
  return null;
}

/**
 * Runs the deterministic check.
 *
 * - For each activity with a non-EDITED direction, find sentences in the
 *   message that mention the activity's object name.
 * - In any such sentence, detect the verb class.
 * - If the detected verb class contradicts the activity's expected direction,
 *   record a "direction-flip" violation.
 *
 * Activities with EDITED direction are skipped (the LLM has no clear right
 * answer to violate). "phantom-action" detection is left for the LLM judge;
 * regex can't reliably distinguish a campaign name reference from an action
 * verb that happens to also be present.
 */
export function checkActivityDirections(
  message: string,
  activities: CanonicalActivity[],
): FactCheckResult {
  if (!message.trim() || !activities.length) {
    return { ok: true, violations: [] };
  }

  const sentences = splitSentences(message);
  const violations: FactCheckViolation[] = [];

  for (const activity of activities) {
    const expectedVerbClass = DIRECTION_TO_VERB_CLASS[activity.direction];
    if (!expectedVerbClass || !activity.objectName) {
      continue;
    }

    for (const sentence of sentences) {
      if (!sentenceMentionsEntity(sentence, activity.objectName)) {
        continue;
      }
      const detected = detectVerbClass(sentence);
      if (!detected) {
        continue;
      }
      if (detected.verbClass === expectedVerbClass) {
        continue;
      }

      // Same-axis flip is the high-confidence failure mode (UP vs DOWN,
      // PAUSE vs RESUME). Cross-axis matches (e.g. CREATE vs UP) are noisier
      // and we leave those for the LLM judge to flag — too easy to false-
      // positive on benign phrasing like "added more budget to X" where
      // "added" registers as CREATE but the underlying action was a budget
      // INCREASE.
      const isHardFlip =
        (expectedVerbClass === "UP" && detected.verbClass === "DOWN") ||
        (expectedVerbClass === "DOWN" && detected.verbClass === "UP") ||
        (expectedVerbClass === "PAUSE" && detected.verbClass === "RESUME") ||
        (expectedVerbClass === "RESUME" && detected.verbClass === "PAUSE") ||
        (expectedVerbClass === "CREATE" && detected.verbClass === "DELETE") ||
        (expectedVerbClass === "DELETE" && detected.verbClass === "CREATE");

      if (!isHardFlip) {
        continue;
      }

      violations.push({
        type: "direction-flip",
        objectName: activity.objectName,
        field: activity.field,
        expectedDirection: activity.direction,
        foundVerb: detected.phrase,
        sentence,
        description: `The message says "${detected.phrase}" near "${activity.objectName}", but the actual change was ${activity.direction} (${activity.field}). The verb must match the DIRECTION exactly.`,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Turns a violation list into critique strings suitable for feeding back
 * into composeClientMessage's critiqueFeedback param. Each line is short,
 * imperative, and direction-specific so the model has exactly one fix to
 * make per item.
 */
export function violationsToCritique(violations: FactCheckViolation[]): string[] {
  return violations.map((violation) => {
    if (violation.type === "direction-flip") {
      const correctVerbs = correctVerbsForDirection(violation.expectedDirection);
      return `On "${violation.objectName}" (${violation.field}): the actual change was ${violation.expectedDirection}. You wrote "${violation.foundVerb}" — use ${correctVerbs} instead, or omit this action.`;
    }
    return violation.description;
  });
}

function correctVerbsForDirection(direction: ActivityDirection): string {
  switch (direction) {
    case "INCREASED":
      return "raised / bumped / increased / scaled up";
    case "DECREASED":
      return "lowered / cut / reduced / trimmed";
    case "PAUSED":
      return "paused / stopped / turned off";
    case "RESUMED":
      return "resumed / restarted / turned back on";
    case "CREATED":
      return "launched / added / created";
    case "DELETED":
      return "removed / deleted";
    default:
      return "an accurate verb that matches the direction";
  }
}

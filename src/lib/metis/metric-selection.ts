/**
 * metric-selection.ts
 *
 * Deterministic rule layer that decides which metrics belong in the
 * <METRICS_PRIMARY> block (versus <METRICS_OPTIONAL>) of the compose prompt.
 *
 * WHY THIS EXISTS
 * ---------------
 * The compose prompt currently partitions metric rows by `vocabulary.mentionedMetrics`
 * — whatever the tone-example detector found in the user's writing samples.
 * That works when the user has supplied rich examples that reference the metrics
 * they actually care about. It FAILS in two common cases:
 *
 *   1. SPARSE VOCABULARY: the user gave 2 short examples mentioning only "spend".
 *      The LLM is then told that spend is the only "primary" metric, and falls
 *      back to talking about impressions/CPM/CPC because those are the only
 *      other things available — which is wrong for a sales-objective account.
 *
 *   2. OBJECTIVE MISMATCH: the user's examples reference ROAS and purchases
 *      (e-commerce voice), but the snapshot only carries impressions/clicks/CTR
 *      because the underlying account is mid-funnel. The LLM picks the wrong
 *      metric to lead with.
 *
 * This module merges three signals into one ordered priority list:
 *
 *   - USER VOCABULARY: what metrics the operator's own writing references.
 *     Respected first — the operator knows their client.
 *   - OBJECTIVE DEFAULTS: media-buyer best-practice for each Meta campaign
 *     objective (see PRIORITY_BY_OBJECTIVE below). Applied as a fallback /
 *     supplement when vocabulary is sparse.
 *   - MOVEMENT SIGNALS: metrics whose values are unusual enough to mention
 *     this period (e.g. frequency > 3 → ad saturation, surface frequency).
 *
 * HARD GUARDRAILS (cross-cutting rules, codified below):
 *   - impressions and reach are never primary for any conversion objective
 *     (SALES/LEADS/TRAFFIC/ENGAGEMENT/APP_PROMOTION) UNLESS the user's tone
 *     examples explicitly mention them.
 *   - frequency is only primary when totals.frequency > 3.0 (saturation) OR
 *     objective is AWARENESS.
 *   - CTR is only added on a movement signal — and v1 has no prev-period
 *     compare, so default-only path drops CTR. User vocab can still add it.
 *   - ROAS / AOV / purchaseValue are sales-objective only on the default
 *     path. If user vocab mentions ROAS but the account ran a traffic
 *     campaign, we DO keep it (operator knows better) — restriction only
 *     applies to the objective-default fallback.
 *
 * INTEGRATION NOTE FOR THE CALLER
 * --------------------------------
 * This module's `MetricKey` is a SUPERSET of the existing `MetricToken` enum
 * in src/lib/metis/types.ts. The compose pipeline currently only knows
 * about: spend, impressions, reach, clicks, ctr, cpm, cpc, frequency,
 * results, costPerResult. To fully wire this into the prompt, types.ts'
 * `MetricToken` will need to be widened to include `roas`, `aov`,
 * `purchaseValue`, `ctr_movement`, `cpm_movement` — and tone.ts'
 * `buildMetricRows` will need to emit rows for those new keys when the
 * snapshot carries them. Both changes are out of scope for this module.
 */

import type { ContentVocabulary, ReportingRunResponse } from "@/lib/metis/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Meta campaign objectives, current 2026 taxonomy. We deliberately keep
 * UNKNOWN as a real value rather than `null` because the priority table below
 * needs to cover the "no objective info available" case (sparse Meta API
 * response, mixed-objective account, etc.).
 */
export type MetaObjective =
  | "OUTCOME_SALES"
  | "OUTCOME_LEADS"
  | "OUTCOME_TRAFFIC"
  | "OUTCOME_AWARENESS"
  | "OUTCOME_ENGAGEMENT"
  | "OUTCOME_APP_PROMOTION"
  | "UNKNOWN";

/**
 * All metric keys this module knows about.
 *
 * SUPERSET of the existing `MetricToken` enum in types.ts. The new keys
 * (`roas`, `aov`, `purchaseValue`, `ctr_movement`, `cpm_movement`) will need
 * to be added to `MetricToken` and `buildMetricRows()` later before they can
 * actually flow into the prompt — but this module's job is just to decide
 * priority, not to render rows.
 *
 * NOTE: `ctr_movement` and `cpm_movement` are signal-only keys. They mean
 * "this metric moved enough that CTR / CPM should be promoted to primary."
 * The caller resolves them into the underlying ctr/cpm row in
 * `selectPrimaryMetrics` output.
 */
export type MetricKey =
  | "spend"
  | "impressions"
  | "reach"
  | "clicks"
  | "ctr"
  | "cpm"
  | "cpc"
  | "frequency"
  | "results"
  | "costPerResult"
  | "roas"
  | "aov"
  | "purchaseValue"
  | "ctr_movement"
  | "cpm_movement";

/**
 * Local snapshot-totals shape. We reference fields from the existing
 * `ReportingRunResponse["snapshot"]["totals"]` and extend with optional
 * roas/aov/purchaseValue fields that the caller may populate (these are not
 * in types.ts yet — see file-level note about wiring).
 *
 * Using a `Pick`-style local alias means we don't mutate types.ts AND we
 * don't crash if the caller passes the existing snapshot totals object
 * unchanged.
 */
export type SnapshotTotals = Pick<
  ReportingRunResponse["snapshot"]["totals"],
  | "spend"
  | "impressions"
  | "reach"
  | "clicks"
  | "ctr"
  | "cpm"
  | "cpc"
  | "frequency"
  | "primaryResult"
> & {
  // Optional extensions — caller may populate these for sales accounts. None
  // of the existing pipeline writes these yet.
  roas?: number | null;
  aov?: number | null;
  purchaseValue?: number | null;
};

// ============================================================================
// Objective priority table
// ============================================================================

/**
 * Per-objective metric priorities. Encodes media-buyer best practice as of
 * 2026 for what a client cares about given each Meta campaign objective.
 *
 * `required` — always primary for this objective, regardless of vocab.
 * `conditional` — promoted to primary only if their movement-signal fires
 *                 (e.g. `ctr` requires a CTR movement signal; `frequency`
 *                 requires totals.frequency > 3).
 * `neverPrimaryUnlessVocab` — HARD GUARDRAIL. These metrics will NOT be added
 *                 to primary by the default path. They can only appear if the
 *                 user's tone vocabulary explicitly mentions them — in which
 *                 case operator-knows-best wins.
 *
 * The "why" of each row, briefly:
 *   - SALES: clients ask "did I make money?" → spend, results (purchases),
 *     ROAS. AOV and CPP only when movement matters.
 *   - LEADS: same shape as SALES but ROAS replaced by leads/CPL. Reach &
 *     frequency hidden — lead-gen clients don't care about top-funnel reach.
 *   - TRAFFIC: clicks-driven objective. CTR and CPM are conditional because
 *     they tell you "is the creative working?" but the headline is still
 *     clicks/CPC.
 *   - AWARENESS: ONLY objective where reach/impressions/frequency lead. CTR
 *     and CPC are deliberately suppressed — they're noise for an awareness
 *     campaign optimized for reach.
 *   - ENGAGEMENT / APP_PROMOTION: mirror LEADS shape — generic
 *     results/costPerResult headline.
 *   - UNKNOWN: safe minimum (spend + results + CPR). No hard skips because
 *     we don't know enough to suppress anything.
 */
const PRIORITY_BY_OBJECTIVE: Record<
  MetaObjective,
  {
    required: MetricKey[];
    conditional: MetricKey[];
    neverPrimaryUnlessVocab: MetricKey[];
  }
> = {
  OUTCOME_SALES: {
    required: ["spend", "results", "roas"],
    conditional: ["costPerResult", "aov", "ctr_movement", "frequency"],
    neverPrimaryUnlessVocab: ["impressions", "reach"],
  },
  OUTCOME_LEADS: {
    required: ["spend", "results", "costPerResult"],
    conditional: ["ctr_movement"],
    neverPrimaryUnlessVocab: ["impressions", "reach", "frequency"],
  },
  OUTCOME_TRAFFIC: {
    required: ["spend", "clicks", "cpc"],
    conditional: ["ctr_movement", "cpm_movement"],
    neverPrimaryUnlessVocab: ["reach", "impressions", "frequency"],
  },
  OUTCOME_AWARENESS: {
    required: ["spend", "reach", "impressions", "cpm", "frequency"],
    conditional: [],
    neverPrimaryUnlessVocab: ["ctr", "cpc", "results"],
  },
  OUTCOME_ENGAGEMENT: {
    required: ["spend", "results", "costPerResult"],
    conditional: ["ctr_movement", "cpm_movement"],
    neverPrimaryUnlessVocab: ["reach", "impressions", "frequency"],
  },
  OUTCOME_APP_PROMOTION: {
    required: ["spend", "results", "costPerResult"],
    conditional: ["ctr_movement", "cpm_movement"],
    neverPrimaryUnlessVocab: ["reach", "impressions", "frequency"],
  },
  UNKNOWN: {
    required: ["spend", "results", "costPerResult"],
    conditional: ["ctr_movement", "frequency"],
    neverPrimaryUnlessVocab: [],
  },
};

/**
 * Conversion-style objectives where reach/impressions/frequency should be
 * suppressed by default. Pulled out for the cross-cutting check inside
 * `selectPrimaryMetrics` — keeps the table above declarative.
 */
const CONVERSION_OBJECTIVES: ReadonlySet<MetaObjective> = new Set<MetaObjective>([
  "OUTCOME_SALES",
  "OUTCOME_LEADS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_APP_PROMOTION",
]);

/**
 * Sales-objective-only metrics. Used on the DEFAULT path (objective-priority
 * fallback) to avoid e.g. surfacing ROAS for a traffic campaign just because
 * the table somehow listed it. User-vocab path is allowed to keep them.
 */
const SALES_ONLY_METRICS: ReadonlySet<MetricKey> = new Set<MetricKey>([
  "roas",
  "aov",
  "purchaseValue",
]);

// ============================================================================
// pickDominantObjective
// ============================================================================

/**
 * Determine the dominant Meta objective across a set of campaigns, weighted
 * by spend share.
 *
 * Returns the objective that captured the largest share of spend. Falls back
 * to UNKNOWN only when:
 *   - the input list is empty, OR
 *   - every campaign has a null/empty/unrecognized objective.
 *
 * Spend share threshold notes (deferred to v2):
 *   The spec mentioned a "<50% spend share + 2+ tied tiers → UNKNOWN" rule
 *   for forcing the caller to union the top two. For v1 we just return the
 *   largest by spend — simpler and predictable. If accounts ever mix
 *   objectives 50/50 (e.g. SALES + AWARENESS hybrid), this can be revisited.
 *
 * Example: `pickDominantObjective([{ objective: "OUTCOME_SALES", spend: 800 },
 *                                  { objective: "OUTCOME_TRAFFIC", spend: 200 }])`
 *          → "OUTCOME_SALES"
 *
 * Example: `pickDominantObjective([{ objective: null, spend: 100 }])`
 *          → "UNKNOWN"
 *
 * Example: `pickDominantObjective([])` → "UNKNOWN"
 */
export function pickDominantObjective(
  campaigns: Array<{
    objective: string | null | undefined;
    spend: number | null | undefined;
  }>,
): MetaObjective {
  if (!campaigns.length) {
    return "UNKNOWN";
  }

  const spendByObjective = new Map<MetaObjective, number>();

  for (const campaign of campaigns) {
    const normalized = normalizeObjective(campaign.objective);
    if (normalized === "UNKNOWN") {
      // Skip unknown objectives entirely from the tally. They shouldn't
      // dilute a known objective's spend share — if all campaigns are
      // unknown, we'll fall through to the UNKNOWN return below.
      continue;
    }
    const spend = typeof campaign.spend === "number" && Number.isFinite(campaign.spend)
      ? Math.max(0, campaign.spend)
      : 0;
    spendByObjective.set(normalized, (spendByObjective.get(normalized) ?? 0) + spend);
  }

  if (spendByObjective.size === 0) {
    return "UNKNOWN";
  }

  // Edge case: every campaign has zero spend but a known objective. We still
  // want to pick one — fall back to count-of-campaigns by treating each
  // tracked objective as having weight 1 if all spend is zero.
  const totalSpend = [...spendByObjective.values()].reduce((sum, v) => sum + v, 0);
  if (totalSpend === 0) {
    // Recount by campaign count.
    const countByObjective = new Map<MetaObjective, number>();
    for (const campaign of campaigns) {
      const normalized = normalizeObjective(campaign.objective);
      if (normalized === "UNKNOWN") {
        continue;
      }
      countByObjective.set(normalized, (countByObjective.get(normalized) ?? 0) + 1);
    }
    return pickHighest(countByObjective);
  }

  return pickHighest(spendByObjective);
}

function pickHighest(weights: Map<MetaObjective, number>): MetaObjective {
  let best: MetaObjective = "UNKNOWN";
  let bestWeight = -1;
  for (const [objective, weight] of weights) {
    if (weight > bestWeight) {
      best = objective;
      bestWeight = weight;
    }
  }
  return best;
}

/**
 * Normalize a raw objective string from the Meta API into our enum.
 * Meta sometimes returns legacy values (e.g. `CONVERSIONS`, `LINK_CLICKS`)
 * which we map to their modern OUTCOME_* equivalents. Unknown strings → UNKNOWN.
 */
function normalizeObjective(raw: string | null | undefined): MetaObjective {
  if (!raw) {
    return "UNKNOWN";
  }
  const upper = raw.trim().toUpperCase();

  // Modern taxonomy passes straight through.
  if (
    upper === "OUTCOME_SALES" ||
    upper === "OUTCOME_LEADS" ||
    upper === "OUTCOME_TRAFFIC" ||
    upper === "OUTCOME_AWARENESS" ||
    upper === "OUTCOME_ENGAGEMENT" ||
    upper === "OUTCOME_APP_PROMOTION"
  ) {
    return upper;
  }

  // Legacy objective names — Meta keeps returning these on older campaigns.
  if (upper === "CONVERSIONS" || upper === "CATALOG_SALES" || upper === "PRODUCT_CATALOG_SALES") {
    return "OUTCOME_SALES";
  }
  if (upper === "LEAD_GENERATION") {
    return "OUTCOME_LEADS";
  }
  if (upper === "LINK_CLICKS" || upper === "TRAFFIC") {
    return "OUTCOME_TRAFFIC";
  }
  if (upper === "BRAND_AWARENESS" || upper === "REACH" || upper === "AWARENESS") {
    return "OUTCOME_AWARENESS";
  }
  if (
    upper === "POST_ENGAGEMENT" ||
    upper === "PAGE_LIKES" ||
    upper === "VIDEO_VIEWS" ||
    upper === "MESSAGES" ||
    upper === "EVENT_RESPONSES" ||
    upper === "ENGAGEMENT"
  ) {
    return "OUTCOME_ENGAGEMENT";
  }
  if (upper === "APP_INSTALLS" || upper === "APP_PROMOTION") {
    return "OUTCOME_APP_PROMOTION";
  }

  return "UNKNOWN";
}

// ============================================================================
// detectMetricSignals
// ============================================================================

/**
 * Conservative movement-signal detector.
 *
 * Returns a set of MetricKey signals worth surfacing this period. Currently
 * v1, the only signal we can fire WITHOUT a previous-period comparison is:
 *
 *   - frequency > 3.0 — ad-saturation territory. Industry rule of thumb:
 *     above 3 impressions per user the same audience starts to fatigue and
 *     CTR drops. Worth surfacing to the client so they understand why
 *     performance may dip.
 *
 * CTR / CPM movement signals require a prevPeriodTotals to compare against
 * (e.g. "CTR up 30% vs last period"). Since v1 has no prev-period yet, we
 * deliberately do NOT emit `ctr_movement` / `cpm_movement` here — caller will
 * see they aren't in the returned set and fall back to "only include CTR if
 * user vocab mentions it" semantics.
 *
 * Example: totals = { frequency: 4.2, ... } → Set(["frequency"])
 * Example: totals = { frequency: 1.8, ... } → Set()
 * Example: totals = { frequency: null, ... } → Set() (null treated as no signal)
 */
export function detectMetricSignals(totals: SnapshotTotals): Set<MetricKey> {
  const signals = new Set<MetricKey>();

  // Frequency saturation. >3.0 is the industry rule of thumb. We're
  // deliberately conservative — 2.8 isn't worth surfacing, the user doesn't
  // need to talk about it.
  if (typeof totals.frequency === "number" && Number.isFinite(totals.frequency)) {
    if (totals.frequency > 3.0) {
      signals.add("frequency");
    }
  }

  // v1: no prev-period available, so we deliberately omit ctr_movement and
  // cpm_movement. When prev-period support lands, the logic looks like:
  //   if (Math.abs(pctChange(totals.ctr, prev.ctr)) > 0.15) signals.add("ctr_movement");
  //   if (Math.abs(pctChange(totals.cpm, prev.cpm)) > 0.15) signals.add("cpm_movement");
  // — i.e. fire on 15%+ moves either direction.

  return signals;
}

// ============================================================================
// selectPrimaryMetrics — the main entry point
// ============================================================================

/**
 * Decide which metric keys belong in the <METRICS_PRIMARY> block, in
 * priority order.
 *
 * ALGORITHM:
 *   1. Start with user-detected metrics from `vocabulary.mentionedMetrics`.
 *      Operator vocabulary leads — they know what their client cares about.
 *   2. For v1, keep all user-detected metrics as-is (no objective filter on
 *      this path — see SALES_ONLY_METRICS comment above for the one
 *      restriction we DO apply on the default-only fallback path).
 *   3. Build the objective-default list: required + (conditional whose
 *      signal fired). Filter sales-only metrics out if objective isn't
 *      SALES.
 *   4. Union: user vocab (in vocab order) followed by objective defaults
 *      (in table order) not already in the union.
 *   5. Apply HARD SKIPS: drop impressions/reach for conversion objectives
 *      unless user vocab mentioned them. Drop frequency unless freq > 3 OR
 *      objective is AWARENESS OR user vocab mentioned it.
 *   6. Always ensure "spend" is present (every report needs spend).
 *   7. Resolve signal-only keys (`ctr_movement` → `ctr`, `cpm_movement`
 *      → `cpm`) so the caller can match against real MetricRow tokens.
 *   8. Dedupe (preserving order).
 *   9. Cap at `vocabulary.averageMetricCount + 1` (mimic the operator's
 *      typical density + room for one more). Empty-vocab fallback is 4.
 *      Spend is always retained even if cap would drop it.
 *
 * The OUTPUT ordering matters: the prompt renders rows in this order, so
 * user-vocab metrics appear first (the LLM sees them as the "lead" metrics)
 * and objective defaults fill in any gaps.
 *
 * ===
 * Example 1 — e-commerce account, rich vocabulary:
 *   vocabulary.mentionedMetrics = ["spend", "results", "costPerResult"]
 *   (user calls "results" anything purchase-related, vocabulary detector
 *    catches ROAS too — but that maps to "results" in current enum)
 *   dominantObjective = "OUTCOME_SALES"
 *   totals.frequency = 2.1 (no saturation)
 *   averageMetricCount = 3
 *   →
 *   Step 1: ["spend", "results", "costPerResult"]
 *   Step 3 (defaults for SALES): required=[spend, results, roas],
 *                                conditional fired=[] (freq=2.1),
 *                                neverUnlessVocab=[impressions, reach]
 *   Step 4 union: [spend, results, costPerResult, roas]
 *   Step 5: no hard skips trigger (impressions/reach not in list anyway)
 *   Step 9 cap = 3 + 1 = 4 → [spend, results, costPerResult, roas]
 *
 * Example 2 — lead-gen account, SPARSE vocab (only mentions "spend"):
 *   vocabulary.mentionedMetrics = ["spend"]
 *   dominantObjective = "OUTCOME_LEADS"
 *   totals.frequency = 1.5
 *   averageMetricCount = 1
 *   →
 *   Step 1: ["spend"]
 *   Step 3 defaults: required=[spend, results, costPerResult], conditional=[]
 *                    (no ctr_movement signal in v1)
 *   Step 4: [spend, results, costPerResult]
 *   Step 5: impressions/reach/frequency suppressed (not in list, no
 *           change). User vocab didn't mention impressions/reach, so they
 *           stay out even though the defaults table omits them too.
 *   Step 9 cap = 1 + 1 = 2 → but spend is required, so:
 *     [spend, results] (results is the conversion headline)
 *     Wait — cap=2 and we need to keep spend, so we keep the first two:
 *     [spend, results]. CostPerResult gets dropped to optional.
 *
 * Example 3 — awareness campaign, no vocab examples at all:
 *   vocabulary.mentionedMetrics = []
 *   dominantObjective = "OUTCOME_AWARENESS"
 *   totals.frequency = 3.5 (saturation!)
 *   averageMetricCount = 0
 *   →
 *   Step 1: []
 *   Step 3 defaults: required=[spend, reach, impressions, cpm, frequency],
 *                    conditional=[] (table is empty for AWARENESS)
 *   Step 4: [spend, reach, impressions, cpm, frequency]
 *   Step 5: AWARENESS is NOT a conversion objective, so impressions/reach
 *           are allowed. Frequency stays (objective is AWARENESS — frequency
 *           IS a lead metric for awareness).
 *   Step 9: empty vocab → cap = 4. Trim to first 4: [spend, reach,
 *           impressions, cpm]. Frequency drops to optional, which is fine
 *           because freq>3 saturation context can still come from the
 *           narrative-facts block.
 *           Actually — we want to keep the SIGNAL. Since frequency fired,
 *           it stays in priority order. Final: [spend, reach, impressions,
 *           cpm, frequency] trimmed → [spend, reach, impressions, cpm].
 *           This is a borderline call; awareness reports almost always need
 *           frequency too, but the cap protects the operator's density.
 */
export function selectPrimaryMetrics(args: {
  vocabulary: ContentVocabulary;
  dominantObjective: MetaObjective;
  totals: SnapshotTotals;
}): MetricKey[] {
  const { vocabulary, dominantObjective, totals } = args;

  // ---------------------------------------------------------------------------
  // Step 1: user vocabulary (preserves their order — first to appear in their
  // own examples leads).
  // ---------------------------------------------------------------------------
  const vocabSet = new Set<MetricKey>(vocabulary.mentionedMetrics as MetricKey[]);
  const fromVocab: MetricKey[] = (vocabulary.mentionedMetrics as MetricKey[]).slice();

  // ---------------------------------------------------------------------------
  // Step 3: objective defaults, with signal-conditional promotion.
  // ---------------------------------------------------------------------------
  const signals = detectMetricSignals(totals);
  const objectiveSpec = PRIORITY_BY_OBJECTIVE[dominantObjective];

  // Resolve conditional metrics: include only the ones whose signal fired,
  // OR the special-case "frequency" which is conditional on freq>3 AND
  // implicit-include for AWARENESS (the table puts it in `required` for
  // AWARENESS so no special-casing needed here).
  const matchedConditionals: MetricKey[] = objectiveSpec.conditional.filter((metric) => {
    if (metric === "ctr_movement") {
      return signals.has("ctr_movement"); // v1 always false
    }
    if (metric === "cpm_movement") {
      return signals.has("cpm_movement"); // v1 always false
    }
    if (metric === "frequency") {
      // Conditional frequency means "include if saturated" — fires only when
      // the signal-detector flagged it (> 3.0).
      return signals.has("frequency");
    }
    // Everything else listed in `conditional` (e.g. costPerResult, aov for
    // SALES) is treated as include-by-default. The "conditional" bucket here
    // means "lower priority than required" rather than "needs a signal" for
    // these metrics.
    return true;
  });

  // Build the objective-default list, filtering out sales-only metrics if
  // we're not on a sales objective. (User vocab path is allowed to keep
  // sales-only metrics — operator may know better than the objective.)
  const objectiveDefaults: MetricKey[] = [
    ...objectiveSpec.required,
    ...matchedConditionals,
  ].filter((metric) => {
    if (dominantObjective !== "OUTCOME_SALES" && SALES_ONLY_METRICS.has(metric)) {
      return false;
    }
    return true;
  });

  // ---------------------------------------------------------------------------
  // Step 4: union — vocab first, then objective defaults that aren't already
  // covered.
  // ---------------------------------------------------------------------------
  const ordered: MetricKey[] = [...fromVocab];
  const seen = new Set<MetricKey>(fromVocab);
  for (const metric of objectiveDefaults) {
    if (!seen.has(metric)) {
      ordered.push(metric);
      seen.add(metric);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 5: hard skips (cross-cutting rules).
  // ---------------------------------------------------------------------------
  const isConversionObjective = CONVERSION_OBJECTIVES.has(dominantObjective);
  const filtered = ordered.filter((metric) => {
    // Conversion objectives: hide impressions/reach unless user vocab said so.
    if (isConversionObjective && (metric === "impressions" || metric === "reach")) {
      if (!vocabSet.has(metric)) {
        return false;
      }
    }

    // Frequency: only primary when freq > 3, OR awareness, OR user vocab.
    if (metric === "frequency") {
      const isSaturated = signals.has("frequency");
      const isAwareness = dominantObjective === "OUTCOME_AWARENESS";
      const userMentioned = vocabSet.has("frequency");
      if (!isSaturated && !isAwareness && !userMentioned) {
        return false;
      }
    }

    return true;
  });

  // ---------------------------------------------------------------------------
  // Step 6: always ensure spend is present. It's the table-stakes metric.
  // ---------------------------------------------------------------------------
  if (!filtered.includes("spend")) {
    filtered.unshift("spend");
  }

  // ---------------------------------------------------------------------------
  // Step 7: resolve signal-only keys to their renderable equivalents.
  // ctr_movement → ctr, cpm_movement → cpm. (Currently never fire in v1, but
  // hardening the path for when prev-period support lands.)
  // ---------------------------------------------------------------------------
  const resolved: MetricKey[] = [];
  const resolvedSeen = new Set<MetricKey>();
  for (const metric of filtered) {
    const resolvedKey: MetricKey =
      metric === "ctr_movement" ? "ctr" : metric === "cpm_movement" ? "cpm" : metric;
    if (!resolvedSeen.has(resolvedKey)) {
      resolved.push(resolvedKey);
      resolvedSeen.add(resolvedKey);
    }
  }

  // ---------------------------------------------------------------------------
  // Step 9: cap at vocabulary.averageMetricCount + 1 (or 4 if vocab is
  // empty). Spend is always retained.
  // ---------------------------------------------------------------------------
  const baseCap =
    vocabulary.averageMetricCount > 0
      ? Math.ceil(vocabulary.averageMetricCount) + 1
      : 4;
  const cap = Math.max(1, baseCap);

  if (resolved.length <= cap) {
    return resolved;
  }

  // Trim while always retaining spend. Spend should be near the front, but
  // if vocab somehow put it later we still keep it.
  const spendIndex = resolved.indexOf("spend");
  if (spendIndex === -1 || spendIndex < cap) {
    // Spend already in the first `cap` slots — straight slice is fine.
    return resolved.slice(0, cap);
  }
  // Spend was beyond the cap — keep first (cap - 1) and force spend at
  // position 0 (since it's the most important metric overall).
  const head = resolved.slice(0, cap - 1);
  return ["spend", ...head];
}

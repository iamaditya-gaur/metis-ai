export type WorkflowMode = "reporting" | "builder";
export type BuilderSupportLevel = "full-campaign" | "strategy-only" | "copy-only";
export type BuilderDraftMode = "validated" | "planning-only" | "blocked";

export type StatusTone = "success" | "warning" | "neutral" | "info";

export type AccountBadge = {
  role: string;
  label: string;
  tone: "sea" | "ember" | "signal";
};

export const defaultAccountBadges: AccountBadge[] = [
  {
    role: "Reporting Default",
    label: "CB",
    tone: "sea",
  },
  {
    role: "Builder Default",
    label: "Adi personal",
    tone: "ember",
  },
];

export type AccountOption = {
  id: string;
  label: string;
  role: "reporting-default" | "builder-default" | "general";
  name: string | null;
  accountStatus: number | null;
  currency: string | null;
  timezoneName: string | null;
  amountSpent: number | null;
};

export type SetupReadiness = {
  metaTokenReady: boolean;
  reportingAccountReady: boolean;
  draftAccountReady: boolean;
  slackReady: boolean;
  openRouterReady: boolean;
  observabilityReady: boolean;
  logPath: string;
};

export type RunListItem = {
  runId: string;
  flowType: WorkflowMode;
  status: string;
  statusTone: StatusTone;
  selectedAccountId: string | null;
  accountLabel: string;
  summary: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type RunDetailRecord = RunListItem & {
  model: string | null;
  agentSteps: unknown[];
  toolCalls: unknown[];
  artifacts: unknown[];
};

export type MetricToken =
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
  | "linkClicks"
  | "lpv";

export type ContentVocabulary = {
  mentionedMetrics: MetricToken[];
  mentionsCampaigns: boolean;
  mentionsChanges: boolean;
  averageMetricCount: number;
};

export type ToneProfile = {
  sampleCount: number;
  brevity: "tight" | "balanced" | "detailed";
  perspective: "first-person" | "team" | "neutral";
  openingStyle:
    | "quick-update"
    | "greeting-plus-update"
    | "report-heading"
    | "neutral";
  structureStyle: "single-block" | "multi-paragraph" | "metrics-then-insight";
  metricStyle: "conversational" | "mixed" | "dense";
  recommendationStyle:
    | "monitor-and-tweak"
    | "test-and-iterate"
    | "direct-action"
    | "neutral";
  confidence: "restrained" | "direct";
  targetWordCount: number;
  wordRange: {
    min: number;
    max: number;
  };
  numericStyle: {
    currencyDecimalPlaces: number;
    percentDecimalPlaces: number;
    plainNumberDecimalPlaces: number;
    useThousandsSeparators: boolean;
  };
  commonPhrases: string[];
  contentVocabulary: ContentVocabulary;
};

export type MetaActivitySummary = {
  count: number;
  summary: string;
  permissionDenied: boolean;
  status: "success" | "skipped" | "permission-denied" | "error";
  note?: string | null;
};

export type ReportingRunRequest = {
  accountId: string;
  dateStart: string;
  dateEnd: string;
  toneExamples: string;
  accessToken?: string;
  /**
   * Supabase auth.users.id. Threaded through to `metis_runs.user_id` so an
   * authed user can see their own runs in /app/history. Null for the public
   * /reporting demo path.
   */
  userId?: string | null;
};

export type ReportingRunResponse = {
  runId: string;
  model: string;
  snapshot: {
    dateRange: {
      from: string;
      to: string;
      preset: null;
      label: string;
    };
    rowCount: number;
    totals: {
      spend: number | null;
      impressions: number;
      reach: number;
      clicks: number;
      ctr: number | null;
      cpm: number | null;
      cpc: number | null;
      frequency: number | null;
      primaryResult: {
        actionType: string;
        label: string;
        value: number | null;
        costPerResult: number | null;
      } | null;
      // Sales-objective extras. Populated when Meta returns action_values
      // for the `purchase` action_type (or `omni_purchase` for cross-device).
      // null when no purchase data is available (e.g. lead-gen, awareness
      // campaigns). Computed at the snapshot level, not per-campaign.
      roas?: number | null;
      aov?: number | null;
      purchaseValue?: number | null;
      // Subset of `clicks` that are link clicks (distinct from all-clicks
      // which includes engagement-only clicks). Helpful for traffic
      // objective reports. Pulled from `actions.link_click`.
      linkClicks?: number | null;
      // Landing page views — the post-click step. Pulled from
      // `actions.landing_page_view`. Often the metric clients ask about
      // for traffic / conversion funnel reports.
      lpv?: number | null;
    };
    // Aggregate objective inferred across the top campaigns by spend share.
    // Used by the deterministic metric-selection module to decide which
    // metrics belong in the LLM's PRIMARY block. Optional so older
    // snapshots stay valid.
    dominantObjective?:
      | "OUTCOME_SALES"
      | "OUTCOME_LEADS"
      | "OUTCOME_TRAFFIC"
      | "OUTCOME_AWARENESS"
      | "OUTCOME_ENGAGEMENT"
      | "OUTCOME_APP_PROMOTION"
      | "UNKNOWN";
    topActions: Array<{
      actionType: string;
      label: string;
      value: number | null;
    }>;
    topCampaigns: Array<{
      campaignId: string | null;
      campaignName: string | null;
      objective: string | null;
      spend: number | null;
      impressions: number | null;
      clicks: number | null;
      ctr: number | null;
      cpc: number | null;
    }>;
    dataQuality: string[];
  };
  report: {
    executiveSummary: string;
    whatChanged: string[];
    risks: string[];
    nextActions: string[];
    slackMessage: string;
  };
  finalSlackMessage: string;
  toneProfile: ToneProfile | null;
  toneRewriteBlocked: string | null;
  voiceScore: number | null;
  voiceMismatches: string[];
  voiceRegenerated: boolean;
  factScore: number | null;
  factMismatches: string[];
  factViolations: Array<{
    type: string;
    objectName: string;
    field: string;
    expectedDirection: string;
    foundVerb: string;
    sentence: string;
    description: string;
  }>;
  factCheckBlocked: boolean;
  slackDelivery:
    | {
        status: number;
        responseText: string;
      }
    | null;
  slackDeliveryBlocked?: string | null;
  metaActivities: MetaActivitySummary | null;
};

export type VoiceMatchVerdict = {
  score: number;
  mismatches: string[];
  shouldRegenerate: boolean;
};

export type FactMatchVerdict = {
  score: number;
  mismatches: string[];
  shouldRegenerate: boolean;
};

export type BuilderPreviewRequest = {
  accountId: string;
  brandUrl: string;
  objective: string;
  supportLevel: BuilderSupportLevel;
  userNotes: string;
};

export type BuilderPreviewResponse = {
  runId: string;
  model: string;
  accountId: string;
  accountLabel: string;
  supportLevel: BuilderSupportLevel;
  draftMode: BuilderDraftMode;
  brandResearch: {
    startUrl: string;
    pagesCrawled: number;
    qualityNotes: string[];
    enoughSignal?: boolean;
  };
  brandBrief: Record<string, unknown>;
  builderOutput: Record<string, unknown>;
  validatedDrafts: Record<string, unknown> | null;
  previewWarnings: string[];
  builderAccountWarning: string | null;
};

export type BuilderDraftCreateRequest = {
  accountId: string;
  validatedDrafts: {
    campaignPayload: Record<string, string>;
  };
  reviewConfirmed: boolean;
};

export type BuilderDraftCreateResponse = {
  accountId: string;
  accountLabel: string;
  builderAccountWarning: string | null;
  apiStatus: number;
  createdCampaignId: string | null;
  responsePayload: Record<string, unknown>;
};

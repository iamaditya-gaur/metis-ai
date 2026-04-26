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
};

export type ReportingRunRequest = {
  accountId: string;
  dateStart: string;
  dateEnd: string;
  toneExamples: string;
  accessToken?: string;
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
    };
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
  slackDelivery:
    | {
        status: number;
        responseText: string;
      }
    | null;
  slackDeliveryBlocked?: string | null;
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

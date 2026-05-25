import { randomUUID } from "node:crypto";

import { postSlackMessage } from "../../../scripts/pocs/lib/slack.mjs";
import {
  buildInsightsSnapshot,
  buildReportPromptInput,
  generateOpenRouterReportSummary,
} from "../../../scripts/pocs/lib/reporting.mjs";
import {
  getAccountActivities,
  getAccountInsights,
  normalizeAdAccountId,
} from "../../../scripts/pocs/lib/meta-client.mjs";
import { writeStructuredRunLog } from "../../../scripts/pocs/lib/observability.mjs";

import { persistRunToSupabase } from "@/lib/metis/observability/supabase";
import {
  buildToneProfile,
  composeClientMessage,
  gradeVoiceMatch,
  summarizeActivitiesForPrompt,
  type ActivityRecord,
  type OpenRouterPrompts,
  type OpenRouterUsage,
} from "@/lib/metis/tone";
import type {
  MetaActivitySummary,
  ReportingRunRequest,
  ReportingRunResponse,
} from "@/lib/metis/types";

const getAccountActivitiesUnsafe = getAccountActivities as (args: {
  accountId: string;
  dateRange: { from: string; to: string; preset: null; label: string };
  accessToken: string | null;
}) => Promise<{
  activities: ActivityRecord[];
  permissionDenied: boolean;
  error: { code: number | null; subcode: number | null; message: string } | null;
}>;

type LlmCallRecord = {
  step:
    | "report-summary"
    | "tone-profile"
    | "tone-compose"
    | "tone-compose-regenerate"
    | "voice-judge";
  model: string | null;
  status: "success" | "skipped" | "error";
  errorMessage: string | null;
  usage: OpenRouterUsage | null;
  prompts: OpenRouterPrompts | null;
};

const postSlackMessageUnsafe = postSlackMessage as (args: {
  text: string;
  blocks?: unknown;
}) => Promise<{
  status: number;
  responseText: string;
}>;

function buildDateRange(dateStart: string, dateEnd: string) {
  return {
    from: dateStart,
    to: dateEnd,
    preset: null,
    label: `${dateStart} to ${dateEnd}`,
  };
}

function buildReportingSlackBlocks({
  finalSlackMessage,
  snapshot,
}: {
  finalSlackMessage: string;
  snapshot: ReportingRunResponse["snapshot"];
}) {
  const metricFacts = [
    snapshot.totals.spend !== null ? `Spend: $${snapshot.totals.spend}` : null,
    snapshot.totals.ctr !== null ? `CTR: ${snapshot.totals.ctr}%` : null,
    snapshot.totals.cpc !== null ? `CPC: $${snapshot.totals.cpc}` : null,
    snapshot.totals.frequency !== null ? `Frequency: ${snapshot.totals.frequency}` : null,
  ].filter(Boolean);

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Metis AI Reporting Update",
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Window: ${snapshot.dateRange.label} | Rows: ${snapshot.rowCount}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: finalSlackMessage,
      },
    },
    ...(metricFacts.length
      ? [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: metricFacts.join(" | "),
              },
            ],
          },
        ]
      : []),
  ];
}

export async function runReportingWorkflow(
  input: ReportingRunRequest,
): Promise<ReportingRunResponse> {
  const startedAt = new Date().toISOString();
  const accountId = normalizeAdAccountId(input.accountId);
  const dateRange = buildDateRange(input.dateStart, input.dateEnd);
  const { rows } = await getAccountInsights({
    accountId,
    level: "campaign",
    dateRange,
    accessToken: input.accessToken ?? null,
  });

  const llmCalls: LlmCallRecord[] = [];

  const promptInput = buildReportPromptInput({ accountId, rows, dateRange });
  const reportSummaryResult = await generateOpenRouterReportSummary(promptInput);
  const { model, report } = reportSummaryResult;
  const reportSummaryUsage =
    (reportSummaryResult.usage as OpenRouterUsage | undefined) ?? null;
  const reportSummaryPrompts =
    (reportSummaryResult.prompts as OpenRouterPrompts | undefined) ?? null;
  llmCalls.push({
    step: "report-summary",
    model,
    status: "success",
    errorMessage: null,
    usage: reportSummaryUsage,
    prompts: reportSummaryPrompts,
  });

  const toneExamples = input.toneExamples.trim();
  const snapshot = buildInsightsSnapshot(rows, dateRange);

  let toneProfile: ReportingRunResponse["toneProfile"] = null;
  if (toneExamples) {
    const toneProfileResult = await buildToneProfile(toneExamples);
    toneProfile = toneProfileResult.profile;
    llmCalls.push({
      step: "tone-profile",
      model: toneProfileResult.model,
      status: toneProfileResult.model ? "success" : "skipped",
      errorMessage: null,
      usage: toneProfileResult.usage,
      prompts: toneProfileResult.prompts,
    });
  }

  let finalSlackMessage = report.slackMessage;
  let toneRewriteBlocked: string | null = null;
  let toneRewriteModel: string | null = null;
  let toneRewriteUsage: OpenRouterUsage | null = null;
  let voiceScore: number | null = null;
  let voiceMismatches: string[] = [];
  let voiceRegenerated = false;
  let metaActivities: MetaActivitySummary | null = null;
  let changesSummary: string | null = null;

  if (toneProfile?.contentVocabulary.mentionsChanges) {
    try {
      const activityResponse = await getAccountActivitiesUnsafe({
        accountId,
        dateRange,
        accessToken: input.accessToken ?? null,
      });

      if (activityResponse.permissionDenied) {
        metaActivities = {
          count: 0,
          summary: "",
          permissionDenied: true,
          status: "permission-denied",
          note: activityResponse.error?.message ?? null,
        };
      } else {
        const summaryText = summarizeActivitiesForPrompt(activityResponse.activities);
        changesSummary = summaryText || null;
        metaActivities = {
          count: activityResponse.activities.length,
          summary: summaryText,
          permissionDenied: false,
          status: "success",
          note: null,
        };
      }
    } catch (error) {
      metaActivities = {
        count: 0,
        summary: "",
        permissionDenied: false,
        status: "error",
        note: error instanceof Error ? error.message : "Unknown activities error",
      };
    }
  } else {
    metaActivities = {
      count: 0,
      summary: "",
      permissionDenied: false,
      status: "skipped",
      note: toneProfile
        ? "examples do not reference campaign changes"
        : "no tone examples provided",
    };
  }

  if (toneExamples && toneProfile) {
    try {
      const composed = await composeClientMessage({
        report,
        snapshot,
        toneExamples,
        toneProfile,
        changesSummary,
      });
      toneRewriteModel = composed.model;
      toneRewriteUsage = composed.usage;
      llmCalls.push({
        step: "tone-compose",
        model: composed.model,
        status: "success",
        errorMessage: null,
        usage: composed.usage,
        prompts: composed.prompts,
      });
      let activeMessage = composed.message;

      try {
        const verdict = await gradeVoiceMatch({
          clientMessage: composed.message,
          samples: composed.samples,
        });
        voiceScore = verdict.score;
        voiceMismatches = verdict.mismatches;
        llmCalls.push({
          step: "voice-judge",
          model: verdict.model,
          status: verdict.model ? "success" : "skipped",
          errorMessage: null,
          usage: verdict.usage,
          prompts: verdict.prompts,
        });

        if (verdict.shouldRegenerate) {
          try {
            const revised = await composeClientMessage({
              report,
              snapshot,
              toneExamples,
              toneProfile,
              critiqueFeedback: verdict.mismatches,
              changesSummary,
            });
            activeMessage = revised.message;
            voiceRegenerated = true;
            toneRewriteModel = revised.model;
            toneRewriteUsage = revised.usage;
            llmCalls.push({
              step: "tone-compose-regenerate",
              model: revised.model,
              status: "success",
              errorMessage: null,
              usage: revised.usage,
              prompts: revised.prompts,
            });
          } catch (regenError) {
            // Keep the first attempt when revision fails; surface in observability via voiceScore.
            llmCalls.push({
              step: "tone-compose-regenerate",
              model: null,
              status: "error",
              errorMessage:
                regenError instanceof Error
                  ? regenError.message
                  : "Unknown regenerate error.",
              usage: null,
              prompts: null,
            });
          }
        }
      } catch (judgeError) {
        // Grading failure should not block the run — accept the first attempt silently.
        llmCalls.push({
          step: "voice-judge",
          model: null,
          status: "error",
          errorMessage:
            judgeError instanceof Error
              ? judgeError.message
              : "Unknown voice-judge error.",
          usage: null,
          prompts: null,
        });
      }

      finalSlackMessage = activeMessage;
    } catch (error) {
      toneRewriteBlocked =
        error instanceof Error ? error.message : "Unknown compose error.";
      llmCalls.push({
        step: "tone-compose",
        model: null,
        status: "error",
        errorMessage: toneRewriteBlocked,
        usage: null,
        prompts: null,
      });
    }
  }

  const totalPromptTokens = llmCalls.reduce(
    (sum, call) => sum + (call.usage?.promptTokens ?? 0),
    0,
  );
  const totalCompletionTokens = llmCalls.reduce(
    (sum, call) => sum + (call.usage?.completionTokens ?? 0),
    0,
  );
  const totalTokens = llmCalls.reduce(
    (sum, call) => sum + (call.usage?.totalTokens ?? 0),
    0,
  );
  const totalCostUsd = llmCalls.reduce(
    (sum, call) => sum + (call.usage?.costUsd ?? 0),
    0,
  );
  const totalLatencyMs = llmCalls.reduce(
    (sum, call) => sum + (call.usage?.latencyMs ?? 0),
    0,
  );

  const finalReport = {
    ...report,
    slackMessage: finalSlackMessage,
  };
  const slackWebhookConfigured = Boolean(process.env.SLACK_WEBHOOK_URL?.trim());
  let slackDelivery: { status: number; responseText: string } | null = null;
  let slackDeliveryBlocked: string | null = null;

  if (slackWebhookConfigured) {
    try {
      slackDelivery = await postSlackMessageUnsafe({
        text: finalSlackMessage,
        blocks: buildReportingSlackBlocks({
          finalSlackMessage,
          snapshot,
        }),
      });
    } catch (error) {
      slackDeliveryBlocked =
        error instanceof Error ? error.message : "Unknown Slack delivery error.";
    }
  } else {
    slackDeliveryBlocked = "Missing SLACK_WEBHOOK_URL.";
  }
  const finishedAt = new Date().toISOString();
  const runId = `reporting-${randomUUID()}`;

  const runLogPayload = {
    runId,
    flowType: "reporting",
    status: "success",
    selectedAccountId: accountId,
    model,
    summary: report.executiveSummary,
    startedAt,
    finishedAt,
    llmCalls,
    totals: {
      promptTokens: totalPromptTokens || null,
      completionTokens: totalCompletionTokens || null,
      totalTokens: totalTokens || null,
      costUsd: totalCostUsd || null,
      latencyMs: totalLatencyMs || null,
    },
    agentSteps: [
      {
        step: "meta-insights",
        status: "success",
        rowCount: rows.length,
      },
      {
        step: "meta-activities",
        status: metaActivities?.status ?? "skipped",
        activityCount: metaActivities?.count ?? 0,
        permissionDenied: metaActivities?.permissionDenied ?? false,
        note: metaActivities?.note ?? null,
      },
      {
        step: "report-summary",
        status: "success",
        model,
        usage: reportSummaryUsage,
      },
      {
        step: "tone-rewrite",
        status: toneRewriteBlocked ? "fallback" : toneProfile ? "success" : "skipped",
        toneProfile,
        sampleCount: toneProfile?.sampleCount ?? 0,
        voiceScore,
        voiceRegenerated,
        voiceMismatches,
        changesUsed: Boolean(changesSummary),
        model: toneRewriteModel,
        usage: toneRewriteUsage,
        errorMessage: toneRewriteBlocked,
      },
      {
        step: "slack-delivery",
        status: slackDelivery ? "success" : "skipped",
        responseStatus: slackDelivery?.status ?? null,
        blocked: slackDeliveryBlocked,
      },
    ],
    toolCalls: [
      {
        tool: "meta-insights",
        accountId,
        dateRange,
      },
      {
        tool: "meta-activities",
        accountId,
        dateRange,
        status: metaActivities?.status ?? "skipped",
        activityCount: metaActivities?.count ?? 0,
      },
      {
        tool: "openrouter-report-summary",
        model,
      },
      {
        tool: "slack-webhook",
        status: slackDelivery?.status ?? null,
        blocked: slackDeliveryBlocked,
      },
    ],
    artifacts: [
      {
        kind: "insights-snapshot",
        snapshot,
      },
      {
        kind: "report",
        report: finalReport,
      },
    ],
  };

  // Dual sink: legacy JSONL (local dev) + Supabase (durable, queryable).
  // Both are non-blocking — a sink failure must never break a user-facing run.
  await Promise.allSettled([
    writeStructuredRunLog(runLogPayload),
    persistRunToSupabase(runLogPayload),
  ]);

  return {
    runId,
    model,
    snapshot,
    report,
    finalSlackMessage,
    toneProfile,
    toneRewriteBlocked,
    voiceScore,
    voiceMismatches,
    voiceRegenerated,
    slackDelivery,
    slackDeliveryBlocked,
    metaActivities,
  };
}

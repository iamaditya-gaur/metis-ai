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

import {
  buildToneProfile,
  composeClientMessage,
  gradeVoiceMatch,
  summarizeActivitiesForPrompt,
  type ActivityRecord,
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

  const promptInput = buildReportPromptInput({ accountId, rows, dateRange });
  const { model, report } = await generateOpenRouterReportSummary(promptInput);
  const toneExamples = input.toneExamples.trim();
  const snapshot = buildInsightsSnapshot(rows, dateRange);
  const toneProfile = toneExamples ? await buildToneProfile(toneExamples) : null;
  let finalSlackMessage = report.slackMessage;
  let toneRewriteBlocked: string | null = null;
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
      let activeMessage = composed.message;

      try {
        const verdict = await gradeVoiceMatch({
          clientMessage: composed.message,
          samples: composed.samples,
        });
        voiceScore = verdict.score;
        voiceMismatches = verdict.mismatches;

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
          } catch {
            // Keep the first attempt when revision fails; surface in observability via voiceScore.
          }
        }
      } catch {
        // Grading failure should not block the run — accept the first attempt silently.
      }

      finalSlackMessage = activeMessage;
    } catch (error) {
      toneRewriteBlocked =
        error instanceof Error ? error.message : "Unknown compose error.";
    }
  }

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

  await writeStructuredRunLog({
    runId,
    flowType: "reporting",
    status: "success",
    selectedAccountId: accountId,
    model,
    summary: report.executiveSummary,
    startedAt,
    finishedAt,
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
  });

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

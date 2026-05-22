import { randomUUID } from "node:crypto";

import { postSlackMessage } from "../../../scripts/pocs/lib/slack.mjs";
import {
  buildInsightsSnapshot,
  buildReportPromptInput,
  generateOpenRouterReportSummary,
} from "../../../scripts/pocs/lib/reporting.mjs";
import { getAccountInsights, normalizeAdAccountId } from "../../../scripts/pocs/lib/meta-client.mjs";
import { writeStructuredRunLog } from "../../../scripts/pocs/lib/observability.mjs";

import { buildToneProfile, composeClientMessage, gradeVoiceMatch } from "@/lib/metis/tone";
import type { ReportingRunRequest, ReportingRunResponse } from "@/lib/metis/types";

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

  if (toneExamples && toneProfile) {
    try {
      const composed = await composeClientMessage({
        report,
        snapshot,
        toneExamples,
        toneProfile,
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
  };
}

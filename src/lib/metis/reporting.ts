import { randomUUID } from "node:crypto";

import { postSlackMessage } from "../../../scripts/pocs/lib/slack.mjs";
import {
  buildInsightsSnapshot,
  buildReportPromptInput,
  generateOpenRouterReportSummary,
} from "../../../scripts/pocs/lib/reporting.mjs";
import { getAccountInsights, normalizeAdAccountId } from "../../../scripts/pocs/lib/meta-client.mjs";
import { writeStructuredRunLog } from "../../../scripts/pocs/lib/observability.mjs";

import { buildToneProfile, rewriteClientMessageTone } from "@/lib/metis/tone";
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

  if (toneExamples && toneProfile) {
    try {
      finalSlackMessage = await rewriteClientMessageTone({
        report,
        snapshot,
        toneExamples,
        toneProfile,
      });
    } catch (error) {
      toneRewriteBlocked =
        error instanceof Error ? error.message : "Unknown tone rewrite error.";
    }
  }

  const finalReport = {
    ...report,
    slackMessage: finalSlackMessage,
  };
  const slackDelivery = await postSlackMessageUnsafe({
    text: finalSlackMessage,
    blocks: buildReportingSlackBlocks({
      finalSlackMessage,
      snapshot,
    }),
  });
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
      },
      {
        step: "slack-delivery",
        status: "success",
        responseStatus: slackDelivery.status,
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
        status: slackDelivery.status,
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
    slackDelivery: {
      status: slackDelivery.status,
      responseText: slackDelivery.responseText,
    },
  };
}

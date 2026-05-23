import { randomUUID } from "node:crypto";

import { postSlackMessage } from "../../../scripts/pocs/lib/slack.mjs";
import {
  buildInsightsSnapshot,
  buildReportPromptInput,
  generateOpenRouterReportSummary,
} from "../../../scripts/pocs/lib/reporting.mjs";
import { getAccountInsights, normalizeAdAccountId } from "../../../scripts/pocs/lib/meta-client.mjs";
import { writeStructuredRunLog } from "../../../scripts/pocs/lib/observability.mjs";

import { persistRunToSupabase } from "@/lib/metis/observability/supabase";
import {
  buildToneProfile,
  rewriteClientMessageTone,
  type OpenRouterUsage,
} from "@/lib/metis/tone";
import type { ReportingRunRequest, ReportingRunResponse } from "@/lib/metis/types";

type LlmCallRecord = {
  step:
    | "report-summary"
    | "tone-profile"
    | "tone-rewrite";
  model: string | null;
  status: "success" | "skipped" | "error";
  errorMessage: string | null;
  usage: OpenRouterUsage | null;
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
  llmCalls.push({
    step: "report-summary",
    model,
    status: "success",
    errorMessage: null,
    usage: reportSummaryUsage,
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
    });
  }

  let finalSlackMessage = report.slackMessage;
  let toneRewriteBlocked: string | null = null;
  let toneRewriteModel: string | null = null;
  let toneRewriteUsage: OpenRouterUsage | null = null;

  if (toneExamples && toneProfile) {
    try {
      const rewriteResult = await rewriteClientMessageTone({
        report,
        snapshot,
        toneExamples,
        toneProfile,
      });
      finalSlackMessage = rewriteResult.message;
      toneRewriteModel = rewriteResult.model;
      toneRewriteUsage = rewriteResult.usage;
      llmCalls.push({
        step: "tone-rewrite",
        model: rewriteResult.model,
        status: "success",
        errorMessage: null,
        usage: rewriteResult.usage,
      });
    } catch (error) {
      toneRewriteBlocked =
        error instanceof Error ? error.message : "Unknown tone rewrite error.";
      llmCalls.push({
        step: "tone-rewrite",
        model: null,
        status: "error",
        errorMessage: toneRewriteBlocked,
        usage: null,
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
    slackDelivery,
    slackDeliveryBlocked,
  };
}

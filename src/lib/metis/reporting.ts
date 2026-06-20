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
  buildCanonicalActivities,
  buildToneProfile,
  composeClientMessage,
  gradeFactMatch,
  gradeVoiceMatch,
  type ActivityRecord,
  type CanonicalActivity,
  type OpenRouterPrompts,
  type OpenRouterUsage,
} from "@/lib/metis/tone";
import {
  checkActivityDirections,
  violationsToCritique,
  type FactCheckViolation,
} from "@/lib/metis/fact-check";
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
    | "voice-judge"
    | "fact-judge";
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
  let factScore: number | null = null;
  let factMismatches: string[] = [];
  let factViolations: FactCheckViolation[] = [];
  let factCheckBlocked = false;
  let metaActivities: MetaActivitySummary | null = null;
  let changesSummary: string | null = null;
  let canonicalActivities: CanonicalActivity[] = [];
  // Visible diagnostic for /admin/runs — explains why regen did or didn't
  // fire. When a future failure mode shows "voiceScore=6 but no regen",
  // this object surfaces the exact inputs the decision was made on.
  let regenDecision: {
    voiceShouldRegenerate: boolean;
    factShouldRegenerate: boolean;
    deterministicViolations: number;
    combinedCritiqueLength: number;
    regenAttempted: boolean;
  } | null = null;

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
        const {
          summary: summaryText,
          canonical,
          systemActivitiesFiltered,
          systemActivityNames,
        } = buildCanonicalActivities(activityResponse.activities);
        changesSummary = summaryText || null;
        canonicalActivities = canonical;
        // Build a short note operators can read in /admin/runs telling them
        // how much automated noise we filtered out and what its names were.
        // Caps the names at ~5 to keep the run-log row scannable.
        const filteredNotePieces: string[] = [];
        if (systemActivitiesFiltered > 0) {
          const preview = systemActivityNames.slice(0, 5).join(", ");
          filteredNotePieces.push(
            `${systemActivitiesFiltered} automated event${systemActivitiesFiltered === 1 ? "" : "s"} filtered (${preview}${systemActivityNames.length > 5 ? ", …" : ""})`,
          );
        }
        metaActivities = {
          count: activityResponse.activities.length,
          summary: summaryText,
          permissionDenied: false,
          status: "success",
          note: filteredNotePieces.length ? filteredNotePieces.join(" · ") : null,
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

  /**
   * Build the SOURCE_FACTS bundle once. The LLM fact-judge sees the same
   * structured view the compose step does, minus voice examples.
   */
  function buildSourceFactsBundle(): string {
    const lines: string[] = [];
    lines.push(`Date range: ${snapshot.dateRange.label}`);
    lines.push(`Row count: ${snapshot.rowCount}`);
    lines.push(`Executive summary: ${report.executiveSummary}`);
    const whatChanged: string[] = Array.isArray(report.whatChanged)
      ? report.whatChanged
      : [];
    if (whatChanged.length) {
      lines.push("What changed:");
      whatChanged.forEach((item: string) => lines.push(`- ${item}`));
    }
    const risks: string[] = Array.isArray(report.risks) ? report.risks : [];
    if (risks.length) {
      lines.push("Risks:");
      risks.forEach((item: string) => lines.push(`- ${item}`));
    }
    const nextActions: string[] = Array.isArray(report.nextActions)
      ? report.nextActions
      : [];
    if (nextActions.length) {
      lines.push("Next actions:");
      nextActions.forEach((item: string) => lines.push(`- ${item}`));
    }
    if (changesSummary) {
      lines.push("");
      lines.push("CHANGES (structured campaign edits during the period):");
      lines.push(changesSummary);
    }
    if (snapshot.totals) {
      const t = snapshot.totals;
      lines.push("");
      lines.push("Totals:");
      if (t.spend !== null) lines.push(`- spend: $${t.spend}`);
      if (t.impressions !== null) lines.push(`- impressions: ${t.impressions}`);
      if (t.reach !== null) lines.push(`- reach: ${t.reach}`);
      if (t.clicks !== null) lines.push(`- clicks: ${t.clicks}`);
      if (t.ctr !== null) lines.push(`- ctr: ${t.ctr}%`);
      if (t.cpm !== null) lines.push(`- cpm: $${t.cpm}`);
      if (t.cpc !== null) lines.push(`- cpc: $${t.cpc}`);
      if (t.frequency !== null) lines.push(`- frequency: ${t.frequency}`);
    }
    return lines.join("\n");
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

      const sourceFacts = buildSourceFactsBundle();

      // Run voice + fact judges in parallel. allSettled so one failure
      // never blocks the other; never blocks the run.
      const [voiceSettled, factSettled] = await Promise.allSettled([
        gradeVoiceMatch({
          clientMessage: composed.message,
          samples: composed.samples,
        }),
        gradeFactMatch({
          clientMessage: composed.message,
          sourceFacts,
        }),
      ]);

      let voiceShouldRegenerate = false;
      let factShouldRegenerate = false;
      const combinedCritique: string[] = [];

      if (voiceSettled.status === "fulfilled") {
        const v = voiceSettled.value;
        voiceScore = v.score;
        voiceMismatches = v.mismatches;
        voiceShouldRegenerate = v.shouldRegenerate;
        combinedCritique.push(...v.mismatches);
        llmCalls.push({
          step: "voice-judge",
          model: v.model,
          status: v.model ? "success" : "skipped",
          errorMessage: null,
          usage: v.usage,
          prompts: v.prompts,
        });
      } else {
        llmCalls.push({
          step: "voice-judge",
          model: null,
          status: "error",
          errorMessage:
            voiceSettled.reason instanceof Error
              ? voiceSettled.reason.message
              : "Unknown voice-judge error.",
          usage: null,
          prompts: null,
        });
      }

      if (factSettled.status === "fulfilled") {
        const f = factSettled.value;
        factScore = f.score;
        factMismatches = f.mismatches;
        factShouldRegenerate = f.shouldRegenerate;
        combinedCritique.push(...f.mismatches);
        llmCalls.push({
          step: "fact-judge",
          model: f.model,
          status: f.model ? "success" : "skipped",
          errorMessage: null,
          usage: f.usage,
          prompts: f.prompts,
        });
      } else {
        llmCalls.push({
          step: "fact-judge",
          model: null,
          status: "error",
          errorMessage:
            factSettled.reason instanceof Error
              ? factSettled.reason.message
              : "Unknown fact-judge error.",
          usage: null,
          prompts: null,
        });
      }

      // Deterministic post-check: scan for direction flips on the actual
      // CHANGES list. This is the safety floor — if a flip survives the
      // regen below, we refuse to ship and fall back.
      const deterministicCheck = checkActivityDirections(
        composed.message,
        canonicalActivities,
      );
      factViolations = deterministicCheck.violations;
      if (deterministicCheck.violations.length) {
        combinedCritique.push(
          ...violationsToCritique(deterministicCheck.violations),
        );
      }

      const shouldRegenerate =
        voiceShouldRegenerate ||
        factShouldRegenerate ||
        deterministicCheck.violations.length > 0;

      regenDecision = {
        voiceShouldRegenerate,
        factShouldRegenerate,
        deterministicViolations: deterministicCheck.violations.length,
        combinedCritiqueLength: combinedCritique.length,
        regenAttempted: shouldRegenerate && combinedCritique.length > 0,
      };

      if (shouldRegenerate && combinedCritique.length) {
        try {
          const revised = await composeClientMessage({
            report,
            snapshot,
            toneExamples,
            toneProfile,
            critiqueFeedback: combinedCritique,
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

          // Re-run the deterministic check on the regenerated message.
          // If a direction flip survives, we refuse to ship the regenerated
          // message and fall back to the operator-view slackMessage. Voice
          // mismatch alone does NOT trigger fallback — only fact-violations.
          const recheck = checkActivityDirections(
            revised.message,
            canonicalActivities,
          );
          if (recheck.violations.length) {
            factViolations = recheck.violations;
            factCheckBlocked = true;
            activeMessage = report.slackMessage;
          } else {
            factViolations = [];
          }
        } catch (regenError) {
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
          // If regen failed and the first draft had fact violations,
          // fall back rather than ship a known-wrong message.
          if (deterministicCheck.violations.length) {
            factCheckBlocked = true;
            activeMessage = report.slackMessage;
          }
        }
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
    userId: input.userId ?? null,
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
        status: toneRewriteBlocked
          ? "fallback"
          : factCheckBlocked
            ? "fact-fallback"
            : toneProfile
              ? "success"
              : "skipped",
        toneProfile,
        sampleCount: toneProfile?.sampleCount ?? 0,
        voiceScore,
        voiceRegenerated,
        voiceMismatches,
        factScore,
        factMismatches,
        factViolations,
        factCheckBlocked,
        changesUsed: Boolean(changesSummary),
        regenDecision,
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
    factScore,
    factMismatches,
    factViolations,
    factCheckBlocked,
    slackDelivery,
    slackDeliveryBlocked,
    metaActivities,
  };
}

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
import {
  ensureRecipientOpening,
  redactGreetingRecipient,
  resolveReportingAccountName,
} from "@/lib/metis/recipient";

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
    | "fact-judge"
    | "voice-judge-regenerate"
    | "fact-judge-regenerate";
  model: string | null;
  status: "success" | "skipped" | "error";
  errorMessage: string | null;
  usage: OpenRouterUsage | null;
  prompts: OpenRouterPrompts | null;
};

const DEFAULT_LLM_CALL_TIMEOUT_MS = 45_000;
const DEFAULT_REPORTING_LLM_DEADLINE_MS = 120_000;

function boundedDuration(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed)
    ? Math.max(10_000, Math.min(180_000, parsed))
    : fallback;
}

function usageFromLlmError(error: unknown): OpenRouterUsage | null {
  if (!error || typeof error !== "object" || !("usage" in error)) return null;
  const usage = (error as { usage?: unknown }).usage;
  return usage && typeof usage === "object" ? (usage as OpenRouterUsage) : null;
}

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
  const accountName = resolveReportingAccountName(rows, input.accountName);
  const llmDeadlineAt =
    Date.now() +
    boundedDuration(
      process.env.METIS_REPORTING_LLM_DEADLINE_MS,
      DEFAULT_REPORTING_LLM_DEADLINE_MS,
    );
  const nextLlmTimeout = () => {
    const remainingMs = llmDeadlineAt - Date.now();
    if (remainingMs <= 0) {
      throw new Error("Reporting AI deadline exceeded before the next model call.");
    }
    return Math.max(1, Math.min(DEFAULT_LLM_CALL_TIMEOUT_MS, remainingMs));
  };

  const llmCalls: LlmCallRecord[] = [];

  const promptInput = buildReportPromptInput({ accountId, rows, dateRange });
  const reportSummaryResult = await generateOpenRouterReportSummary(promptInput, {
    maxTokens: 900,
    timeoutMs: nextLlmTimeout(),
  });
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
    const toneProfileResult = await buildToneProfile(toneExamples, {
      maxTokens: 700,
      timeoutMs: nextLlmTimeout(),
    });
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
    // Model-written summaries cannot be evidence for another model-written
    // message. Judges receive only the raw Meta-derived snapshot and edits.
    lines.push("Meta snapshot:", JSON.stringify(snapshot));
    if (changesSummary) {
      lines.push("");
      lines.push("CHANGES (structured campaign edits during the period):");
      lines.push(changesSummary);
    }
    return lines.join("\n");
  }

  // Without tone examples there is no compose step, so verify the summary
  // message directly before it can be delivered.
  if (!toneExamples || !toneProfile) {
    const sourceFacts = buildSourceFactsBundle();
    try {
      const fact = await gradeFactMatch({
        clientMessage: report.slackMessage,
        sourceFacts,
        maxTokens: 320,
        timeoutMs: nextLlmTimeout(),
      });
      factScore = fact.score;
      factMismatches = fact.mismatches;
      factCheckBlocked = fact.shouldRegenerate;
      llmCalls.push({
        step: "fact-judge",
        model: fact.model,
        status: fact.model ? "success" : "skipped",
        errorMessage: null,
        usage: fact.usage,
        prompts: fact.prompts,
      });
    } catch (error) {
      factCheckBlocked = true;
      llmCalls.push({
        step: "fact-judge",
        model: null,
        status: "error",
        errorMessage:
          error instanceof Error ? error.message : "Unknown fact-judge error.",
        usage: usageFromLlmError(error),
        prompts: null,
      });
    }
  }

  if (toneExamples && toneProfile) {
    try {
      const composed = await composeClientMessage({
        report,
        snapshot,
        toneExamples,
        toneProfile,
        changesSummary,
        recipientName: accountName,
        maxTokens: 650,
        timeoutMs: nextLlmTimeout(),
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
      const judgeMessage = redactGreetingRecipient(composed.message);
      const judgeSamples = composed.samples.map(redactGreetingRecipient);

      // Run voice + fact judges in parallel. allSettled lets both checks
      // finish, while either unavailable check still blocks Slack delivery.
      const initialJudgeTimeoutMs = nextLlmTimeout();
      const [voiceSettled, factSettled] = await Promise.allSettled([
        gradeVoiceMatch({
          clientMessage: judgeMessage,
          samples: judgeSamples,
          maxTokens: 280,
          timeoutMs: initialJudgeTimeoutMs,
        }),
        gradeFactMatch({
          clientMessage: judgeMessage,
          sourceFacts,
          maxTokens: 320,
          timeoutMs: initialJudgeTimeoutMs,
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
        toneRewriteBlocked = "Voice verification was unavailable.";
        activeMessage = report.slackMessage;
        const errorUsage = usageFromLlmError(voiceSettled.reason);
        llmCalls.push({
          step: "voice-judge",
          model: null,
          status: "error",
          errorMessage:
            voiceSettled.reason instanceof Error
              ? voiceSettled.reason.message
              : "Unknown voice-judge error.",
          usage: errorUsage,
          prompts: null,
        });
      }

      if (factSettled.status === "fulfilled") {
        const f = factSettled.value;
        factScore = f.score;
        factMismatches = f.mismatches;
        factShouldRegenerate = f.shouldRegenerate;
        combinedCritique.push(...f.mismatches);
        if (f.shouldRegenerate && !f.mismatches.length) {
          combinedCritique.push(
            "The fact check rejected the draft. Remove any claim that is not directly supported by the supplied Meta snapshot.",
          );
        }
        llmCalls.push({
          step: "fact-judge",
          model: f.model,
          status: f.model ? "success" : "skipped",
          errorMessage: null,
          usage: f.usage,
          prompts: f.prompts,
        });
      } else {
        factCheckBlocked = true;
        activeMessage = report.slackMessage;
        const errorUsage = usageFromLlmError(factSettled.reason);
        llmCalls.push({
          step: "fact-judge",
          model: null,
          status: "error",
          errorMessage:
            factSettled.reason instanceof Error
              ? factSettled.reason.message
              : "Unknown fact-judge error.",
          usage: errorUsage,
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
            recipientName: accountName,
            maxTokens: 650,
            timeoutMs: nextLlmTimeout(),
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

          // Re-run every safety check on the regenerated message. If any
          // completed check rejects it, fall back to the operator summary.
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

            // A rewrite is new model output, so the first draft's scores no
            // longer prove it is safe to send. Judge the final text again.
            const revisedJudgeTimeoutMs = nextLlmTimeout();
            const revisedJudgeMessage = redactGreetingRecipient(revised.message);
            const [revisedVoiceSettled, revisedFactSettled] =
              await Promise.allSettled([
                gradeVoiceMatch({
                  clientMessage: revisedJudgeMessage,
                  samples: revised.samples.map(redactGreetingRecipient),
                  maxTokens: 280,
                  timeoutMs: revisedJudgeTimeoutMs,
                }),
                gradeFactMatch({
                  clientMessage: revisedJudgeMessage,
                  sourceFacts,
                  maxTokens: 320,
                  timeoutMs: revisedJudgeTimeoutMs,
                }),
              ]);

            let revisedVoiceRejected = false;
            let revisedFactRejected = false;

            if (revisedVoiceSettled.status === "fulfilled") {
              const v = revisedVoiceSettled.value;
              voiceScore = v.score;
              voiceMismatches = v.mismatches;
              revisedVoiceRejected = v.shouldRegenerate;
              toneRewriteBlocked = revisedVoiceRejected
                ? "Regenerated client message did not pass the voice check."
                : null;
              llmCalls.push({
                step: "voice-judge-regenerate",
                model: v.model,
                status: v.model ? "success" : "skipped",
                errorMessage: null,
                usage: v.usage,
                prompts: v.prompts,
              });
            } else {
              revisedVoiceRejected = true;
              toneRewriteBlocked =
                "Voice verification of the regenerated message was unavailable.";
              const errorUsage = usageFromLlmError(revisedVoiceSettled.reason);
              llmCalls.push({
                step: "voice-judge-regenerate",
                model: null,
                status: "error",
                errorMessage:
                  revisedVoiceSettled.reason instanceof Error
                    ? revisedVoiceSettled.reason.message
                    : "Unknown regenerated voice-judge error.",
                usage: errorUsage,
                prompts: null,
              });
            }

            if (revisedFactSettled.status === "fulfilled") {
              const f = revisedFactSettled.value;
              factScore = f.score;
              factMismatches = f.mismatches;
              revisedFactRejected = f.shouldRegenerate;
              factCheckBlocked = revisedFactRejected;
              llmCalls.push({
                step: "fact-judge-regenerate",
                model: f.model,
                status: f.model ? "success" : "skipped",
                errorMessage: null,
                usage: f.usage,
                prompts: f.prompts,
              });
            } else {
              factCheckBlocked = true;
              revisedFactRejected = true;
              const errorUsage = usageFromLlmError(revisedFactSettled.reason);
              llmCalls.push({
                step: "fact-judge-regenerate",
                model: null,
                status: "error",
                errorMessage:
                  revisedFactSettled.reason instanceof Error
                    ? revisedFactSettled.reason.message
                    : "Unknown regenerated fact-judge error.",
                usage: errorUsage,
                prompts: null,
              });
            }

            // A failed or rejecting final judge blocks the rewritten message.
            if (revisedFactRejected) factCheckBlocked = true;
            if (revisedVoiceRejected || revisedFactRejected) {
              activeMessage = report.slackMessage;
            }
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
            usage: usageFromLlmError(regenError),
            prompts: null,
          });
          // If regen failed and the first draft had fact violations,
          // fall back rather than ship a known-wrong message.
          if (voiceShouldRegenerate) {
            toneRewriteBlocked = "Client-message rewrite failed after a voice rejection.";
          }
          if (factShouldRegenerate || deterministicCheck.violations.length) {
            factCheckBlocked = true;
          }
          if (
            voiceShouldRegenerate ||
            factShouldRegenerate ||
            deterministicCheck.violations.length
          ) {
            activeMessage = report.slackMessage;
          }
        }
      }

      finalSlackMessage = activeMessage;
    } catch (error) {
      toneRewriteBlocked =
        error instanceof Error ? error.message : "Unknown compose error.";
      factCheckBlocked = true;
      llmCalls.push({
        step: "tone-compose",
        model: null,
        status: "error",
        errorMessage: toneRewriteBlocked,
        usage: usageFromLlmError(error),
        prompts: null,
      });
    }
  }

  finalSlackMessage = ensureRecipientOpening(finalSlackMessage, accountName).message;

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
  const slackDeliveryAllowed = Boolean(input.userId);
  let slackDelivery: { status: number; responseText: string } | null = null;
  let slackDeliveryBlocked: string | null = null;

  if (slackWebhookConfigured && !slackDeliveryAllowed) {
    slackDeliveryBlocked =
      "Slack delivery is disabled for anonymous reporting runs.";
  } else if (
    slackWebhookConfigured &&
    (factCheckBlocked || (Boolean(toneExamples) && Boolean(toneRewriteBlocked)))
  ) {
    slackDeliveryBlocked =
      "Slack delivery was blocked because the final message did not pass quality verification.";
  } else if (slackWebhookConfigured) {
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

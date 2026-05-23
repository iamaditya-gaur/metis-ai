import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payload shape the rest of the app already builds for `writeStructuredRunLog`.
 * Kept loose (`unknown[]`) for the array fields so callers don't have to import
 * every nested type — the table stores them as JSONB.
 */
export type PersistRunPayload = {
  runId: string;
  flowType: string;
  status: string;
  selectedAccountId: string | null;
  model: string | null;
  summary: string | null;
  startedAt: string;
  finishedAt: string;
  totals?: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    latencyMs: number | null;
  } | null;
  llmCalls?: unknown[];
  agentSteps?: unknown[];
  toolCalls?: unknown[];
  artifacts?: unknown[];
};

export type PersistRunResult =
  | { ok: true }
  | { ok: false; reason: string };

function resolveEnvLabel(): string {
  const vercelEnv = process.env.VERCEL_ENV?.trim();
  if (vercelEnv) {
    return vercelEnv;
  }
  if (process.env.NODE_ENV === "production") {
    return "production";
  }
  return "development";
}

/**
 * Insert one run into `public.metis_runs`. Returns `{ok: false}` instead of
 * throwing so a Supabase outage / missing config can never break a real run.
 *
 * Skip cases (returns `{ok: false, reason: ...}`):
 *   - `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` not set
 *   - Supabase client throws (network, table missing, schema mismatch)
 *
 * Caller is expected to log the reason but continue the user-facing run.
 */
export async function persistRunToSupabase(
  payload: PersistRunPayload,
): Promise<PersistRunResult> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return { ok: false, reason: "supabase-not-configured" };
  }

  try {
    const supabase = createAdminClient();
    const totals = payload.totals ?? null;
    const { error } = await supabase.from("metis_runs").insert({
      run_id: payload.runId,
      flow_type: payload.flowType,
      status: payload.status,
      env: resolveEnvLabel(),
      selected_account_id: payload.selectedAccountId,
      model: payload.model,
      summary: payload.summary,
      started_at: payload.startedAt,
      finished_at: payload.finishedAt,
      total_prompt_tokens: totals?.promptTokens ?? null,
      total_completion_tokens: totals?.completionTokens ?? null,
      total_tokens: totals?.totalTokens ?? null,
      total_cost_usd: totals?.costUsd ?? null,
      total_latency_ms: totals?.latencyMs ?? null,
      llm_calls: payload.llmCalls ?? [],
      agent_steps: payload.agentSteps ?? [],
      tool_calls: payload.toolCalls ?? [],
      artifacts: payload.artifacts ?? [],
    });

    if (error) {
      return { ok: false, reason: error.message };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown supabase error",
    };
  }
}

import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountLabel } from "@/lib/metis/accounts";
import type {
  RunDetailRecord,
  RunListItem,
  StatusTone,
  WorkflowMode,
} from "@/lib/metis/types";

export type RunFilters = {
  env?: string;
  flowType?: WorkflowMode;
  selectedAccountId?: string;
  model?: string;
  status?: string;
  startedAfter?: string;
  startedBefore?: string;
  /**
   * Future user-scoping. When user auth ships, pass `session.user.id` here
   * for the user-facing surface; leave undefined for the admin surface.
   */
  userId?: string | null;
  limit?: number;
};

export type LlmCallDetail = {
  step: string;
  model: string | null;
  status: string;
  errorMessage: string | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    latencyMs: number | null;
    attempts: Array<{
      model: string;
      status: string;
      httpStatus: number | null;
      latencyMs: number;
      errorMessage: string | null;
    }>;
    attemptedModels: string[];
  } | null;
  prompts: {
    systemPrompt: string;
    userMessage: string;
    responseRaw: string;
  } | null;
};

export type RunDetailFull = RunDetailRecord & {
  env: string;
  totals: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    latencyMs: number | null;
  };
  llmCalls: LlmCallDetail[];
  userId: string | null;
};

function toWorkflowMode(value: string | null | undefined): WorkflowMode {
  return value?.toLowerCase().includes("builder") ? "builder" : "reporting";
}

function toStatusTone(value: string | null | undefined): StatusTone {
  const normalized = value?.toLowerCase() ?? "";
  if (["pass", "success", "ok", "completed"].includes(normalized)) return "success";
  if (["fail", "failed", "error"].includes(normalized)) return "warning";
  return "neutral";
}

type DbRow = {
  run_id: string;
  flow_type: string;
  status: string;
  env: string;
  selected_account_id: string | null;
  model: string | null;
  summary: string | null;
  started_at: string;
  finished_at: string | null;
  total_prompt_tokens: number | null;
  total_completion_tokens: number | null;
  total_tokens: number | null;
  total_cost_usd: string | null;
  total_latency_ms: number | null;
  llm_calls: unknown;
  agent_steps: unknown;
  tool_calls: unknown;
  artifacts: unknown;
  user_id: string | null;
};

function mapRowToSummary(row: DbRow): RunListItem {
  return {
    runId: row.run_id,
    flowType: toWorkflowMode(row.flow_type),
    status: row.status ?? "unknown",
    statusTone: toStatusTone(row.status),
    selectedAccountId: row.selected_account_id,
    accountLabel: getAccountLabel(row.selected_account_id),
    summary: row.summary,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function mapRowToDetail(row: DbRow): RunDetailFull {
  return {
    ...mapRowToSummary(row),
    env: row.env,
    model: row.model,
    totals: {
      promptTokens: row.total_prompt_tokens,
      completionTokens: row.total_completion_tokens,
      totalTokens: row.total_tokens,
      costUsd: row.total_cost_usd ? Number(row.total_cost_usd) : null,
      latencyMs: row.total_latency_ms,
    },
    llmCalls: Array.isArray(row.llm_calls)
      ? (row.llm_calls as LlmCallDetail[])
      : [],
    agentSteps: Array.isArray(row.agent_steps) ? row.agent_steps : [],
    toolCalls: Array.isArray(row.tool_calls) ? row.tool_calls : [],
    artifacts: Array.isArray(row.artifacts) ? row.artifacts : [],
    userId: row.user_id,
  };
}

/**
 * Distinct values for filter dropdowns. Cached at request scope; for a
 * heavier dashboard we'd memoize across requests.
 */
export type RunFilterOptions = {
  envs: string[];
  models: string[];
  accountIds: string[];
  statuses: string[];
};

const SUMMARY_COLUMNS =
  "run_id, flow_type, status, env, selected_account_id, model, summary, started_at, finished_at, user_id";

const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, total_prompt_tokens, total_completion_tokens, total_tokens, total_cost_usd, total_latency_ms, llm_calls, agent_steps, tool_calls, artifacts`;

export async function listRuns(filters: RunFilters = {}): Promise<RunListItem[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("metis_runs")
    .select(SUMMARY_COLUMNS)
    .order("started_at", { ascending: false })
    .limit(filters.limit ?? 50);

  if (filters.env) query = query.eq("env", filters.env);
  if (filters.flowType) query = query.eq("flow_type", filters.flowType);
  if (filters.selectedAccountId)
    query = query.eq("selected_account_id", filters.selectedAccountId);
  if (filters.model) query = query.eq("model", filters.model);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.startedAfter) query = query.gte("started_at", filters.startedAfter);
  if (filters.startedBefore) query = query.lte("started_at", filters.startedBefore);
  // userId === undefined means "admin view, show all"; userId === string means
  // "user view, scope to that user"; userId === null means "show only pre-auth rows".
  if (filters.userId === null) {
    query = query.is("user_id", null);
  } else if (typeof filters.userId === "string") {
    query = query.eq("user_id", filters.userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("listRuns supabase error:", error);
    return [];
  }
  return (data as DbRow[] | null)?.map(mapRowToSummary) ?? [];
}

export async function getRunById(
  runId: string,
  opts: { userId?: string | null } = {},
): Promise<RunDetailFull | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("metis_runs")
    .select(DETAIL_COLUMNS)
    .eq("run_id", runId)
    .limit(1);

  if (opts.userId === null) {
    query = query.is("user_id", null);
  } else if (typeof opts.userId === "string") {
    query = query.eq("user_id", opts.userId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("getRunById supabase error:", error);
    return null;
  }
  if (!data) return null;
  return mapRowToDetail(data as DbRow);
}

export async function listRunFilterOptions(): Promise<RunFilterOptions> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { envs: [], models: [], accountIds: [], statuses: [] };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("metis_runs")
    .select("env, model, selected_account_id, status")
    .order("started_at", { ascending: false })
    .limit(500);

  if (error || !data) {
    return { envs: [], models: [], accountIds: [], statuses: [] };
  }

  const envs = new Set<string>();
  const models = new Set<string>();
  const accountIds = new Set<string>();
  const statuses = new Set<string>();

  for (const row of data as Array<{
    env: string | null;
    model: string | null;
    selected_account_id: string | null;
    status: string | null;
  }>) {
    if (row.env) envs.add(row.env);
    if (row.model) models.add(row.model);
    if (row.selected_account_id) accountIds.add(row.selected_account_id);
    if (row.status) statuses.add(row.status);
  }

  return {
    envs: [...envs].sort(),
    models: [...models].sort(),
    accountIds: [...accountIds].sort(),
    statuses: [...statuses].sort(),
  };
}

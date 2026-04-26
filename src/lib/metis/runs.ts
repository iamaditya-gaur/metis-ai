import { readFile } from "node:fs/promises";

import { getObservabilityLogPath } from "../../../scripts/pocs/lib/observability.mjs";

import { getAccountLabel } from "@/lib/metis/accounts";
import type { RunDetailRecord, RunListItem, StatusTone, WorkflowMode } from "@/lib/metis/types";

type RawRunEvent = {
  runId?: string;
  flowType?: string;
  status?: string;
  selectedAccountId?: string | null;
  model?: string | null;
  summary?: string | null;
  startedAt?: string;
  finishedAt?: string | null;
  agentSteps?: unknown[];
  toolCalls?: unknown[];
  artifacts?: unknown[];
};

function toWorkflowMode(value: string | undefined): WorkflowMode {
  return value?.toLowerCase().includes("builder") ? "builder" : "reporting";
}

function toStatusTone(value: string | undefined): StatusTone {
  const normalized = value?.toLowerCase() ?? "";

  if (["pass", "success", "ok", "completed"].includes(normalized)) {
    return "success";
  }

  if (["fail", "failed", "error"].includes(normalized)) {
    return "warning";
  }

  return "neutral";
}

function mapRun(event: RawRunEvent): RunDetailRecord | null {
  if (!event.runId || !event.startedAt) {
    return null;
  }

  const flowType = toWorkflowMode(event.flowType);

  return {
    runId: event.runId,
    flowType,
    status: event.status ?? "unknown",
    statusTone: toStatusTone(event.status),
    selectedAccountId: event.selectedAccountId ?? null,
    accountLabel: getAccountLabel(event.selectedAccountId ?? null),
    summary: event.summary ?? null,
    startedAt: event.startedAt,
    finishedAt: event.finishedAt ?? null,
    model: event.model ?? null,
    agentSteps: Array.isArray(event.agentSteps) ? event.agentSteps : [],
    toolCalls: Array.isArray(event.toolCalls) ? event.toolCalls : [],
    artifacts: Array.isArray(event.artifacts) ? event.artifacts : [],
  };
}

export async function listRunDetails(limit = 20): Promise<RunDetailRecord[]> {
  const logPath = getObservabilityLogPath();

  try {
    const content = await readFile(logPath, "utf8");
    const parsed = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RawRunEvent)
      .map(mapRun)
      .filter((value): value is RunDetailRecord => Boolean(value))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));

    return parsed.slice(0, limit);
  } catch {
    return [];
  }
}

export async function listRunSummaries(limit = 20): Promise<RunListItem[]> {
  const runs = await listRunDetails(limit);

  return runs.map((run) => ({
    runId: run.runId,
    flowType: run.flowType,
    status: run.status,
    statusTone: run.statusTone,
    selectedAccountId: run.selectedAccountId,
    accountLabel: run.accountLabel,
    summary: run.summary,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  }));
}

export async function getRunDetail(runId: string) {
  const runs = await listRunDetails(200);
  return runs.find((run) => run.runId === runId) ?? null;
}

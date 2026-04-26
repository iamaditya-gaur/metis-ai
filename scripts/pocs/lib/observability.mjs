import { appendJsonLine } from "./fs.mjs";
import { sanitizeGraphPayload } from "./mask.mjs";

function resolveObservabilityLogPath() {
  const configured = process.env.POC_OBSERVABILITY_LOG_PATH?.trim();

  if (configured) {
    return configured;
  }

  if (process.env.VERCEL) {
    return "/tmp/metis-observability/observability-runs.jsonl";
  }

  return "logs/pocs/observability-runs.jsonl";
}

const observabilityLogPath = resolveObservabilityLogPath();

export function getObservabilityLogPath() {
  return observabilityLogPath;
}

export async function writeStructuredRunLog(runPayload) {
  const event = {
    runId: runPayload.runId,
    flowType: runPayload.flowType,
    status: runPayload.status,
    selectedAccountId: runPayload.selectedAccountId,
    model: runPayload.model ?? null,
    summary: runPayload.summary ?? null,
    startedAt: runPayload.startedAt,
    finishedAt: runPayload.finishedAt,
    agentSteps: sanitizeGraphPayload(runPayload.agentSteps ?? []),
    toolCalls: sanitizeGraphPayload(runPayload.toolCalls ?? []),
    artifacts: sanitizeGraphPayload(runPayload.artifacts ?? []),
  };

  await appendJsonLine(observabilityLogPath, event);

  return {
    logPath: observabilityLogPath,
    event,
  };
}

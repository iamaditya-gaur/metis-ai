import { randomUUID } from "node:crypto";

import { isoNow, todayDate, writeJsonFile, writeTextFile } from "./lib/fs.mjs";
import { getObservabilityLogPath, writeStructuredRunLog } from "./lib/observability.mjs";
import { readJsonFile } from "./lib/reporting.mjs";

const reportEvidencePath = "docs/sub-agents/poc-report-summary-evidence.json";
const summaryPath = "docs/sub-agents/poc-observability-summary.md";
const evidencePath = "docs/sub-agents/poc-observability-evidence.json";

function buildSummary({ verdict, blocker, runId, logWritten, logPath }) {
  const lines = [
    "# POC: Observability",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- Built one multi-step reporting run payload from passing POC evidence.",
    "- Wrote one structured run log entry to the local observability log file.",
    "- Captured agent steps, tool calls, and artifacts in a reusable JSONL format.",
    "",
    "## Outcome",
    "",
    `- Run ID: ${runId ?? "not created"}`,
    `- Local log written: ${logWritten ? "yes" : "no"}`,
    `- Log path: ${logPath ?? "not available"}`,
  ];

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: one run is now inspectable in the configured observability surfaces.");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-observability-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Fix the local logging blocker, then rerun before the thin integrated flows."
      : "- Reuse the same logging pattern in the thin reporting and builder flows.",
  );

  return lines.join("\n");
}

async function main() {
  let verdict = "PASS";
  let blocker = null;
  let runId = null;
  let logWritten = false;
  let logPath = getObservabilityLogPath();

  try {
    const reportEvidence = await readJsonFile(reportEvidencePath);

    if (reportEvidence.verdict !== "PASS") {
      throw new Error("poc-report-summary did not pass, so observability cannot be tested on a valid run.");
    }

    runId = `poc-reporting-${randomUUID()}`;
    const startedAt = isoNow();
    const finishedAt = isoNow();

    const runPayload = {
      runId,
      flowType: "reporting",
      status: "PASS",
      selectedAccountId: reportEvidence.promptInput.selectedAccountId,
      model: reportEvidence.model,
      summary: reportEvidence.report.executiveSummary,
      startedAt,
      finishedAt,
      agentSteps: [
        {
          agentName: "Manager / Ops Lead Agent",
          status: "PASS",
          inputSummary: "Loaded reporting evidence and prepared Reporting Analyst input.",
          outputSummary: "Approved report summary for delivery.",
        },
        {
          agentName: "Reporting Analyst Agent",
          status: "PASS",
          inputSummary: "Consumed sanitized campaign insight snapshot.",
          outputSummary: reportEvidence.report.executiveSummary,
        },
      ],
      toolCalls: [
        {
          toolName: "meta-insights",
          status: "PASS",
          requestPayload: reportEvidence.promptInput.reportingWindow,
          responsePayload: reportEvidence.promptInput.snapshot,
        },
        {
          toolName: "openrouter-report-summary",
          status: "PASS",
          requestPayload: { model: reportEvidence.model },
          responsePayload: reportEvidence.report,
        },
      ],
      artifacts: [
        {
          type: "report",
          label: "report-summary",
          content: reportEvidence.report,
        },
      ],
    };

    const written = await writeStructuredRunLog(runPayload);
    logWritten = true;
    logPath = written.logPath;

    await writeJsonFile(evidencePath, {
      slice: "poc-observability",
      runAt: finishedAt,
      verdict,
      blocker,
      runId,
      logWritten,
      logPath,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({ verdict, blocker, runId, logWritten, logPath }),
    );

    console.log(JSON.stringify({ verdict, blocker, runId, evidencePath, summaryPath }));
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown observability error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-observability",
      runAt: isoNow(),
      verdict,
      blocker,
      runId,
      logWritten,
      logPath,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({ verdict, blocker, runId, logWritten, logPath }),
    );

    console.log(JSON.stringify({ verdict, blocker, runId, evidencePath, summaryPath }));
    process.exitCode = 1;
  }
}

await main();

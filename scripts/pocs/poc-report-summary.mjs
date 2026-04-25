import { writeJsonFile, writeTextFile, isoNow, todayDate } from "./lib/fs.mjs";
import {
  generateOpenRouterReportSummary,
  readJsonFile,
  buildReportPromptInput,
} from "./lib/reporting.mjs";

const reportingEvidencePath = "docs/sub-agents/poc-meta-reporting-evidence.json";
const summaryPath = "docs/sub-agents/poc-report-summary-summary.md";
const evidencePath = "docs/sub-agents/poc-report-summary-evidence.json";

function buildSummary({ verdict, blocker, model, report }) {
  const lines = [
    "# POC: Report Summary",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- Loaded the sanitized reporting evidence produced by `poc-meta-reporting`.",
    "- Built a structured Reporting Analyst prompt input from the saved insight rows.",
    "- Attempted to generate a Slack-ready report summary using the configured OpenRouter server-side key if present.",
    "",
    "## Outcome",
    "",
    `- Source evidence: [poc-meta-reporting-evidence.json](/Users/adi/my-weekender-project/${reportingEvidencePath})`,
    `- OpenRouter model used: ${model ?? "not available"}`,
  ];

  if (report) {
    lines.push(`- Executive summary: ${report.executiveSummary}`);
    lines.push(`- Slack message length: ${report.slackMessage.length} characters`);
  }

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: a structured report summary and concise Slack message were generated.");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-report-summary-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Stop here until the OpenRouter configuration or model-call issue is fixed."
      : "- Reporting summary generation is proven for this slice.",
  );

  return lines.join("\n");
}

async function main() {
  let verdict = "PASS";
  let blocker = null;
  let model = null;
  let report = null;

  try {
    const reportingEvidence = await readJsonFile(reportingEvidencePath);

    if (reportingEvidence.verdict !== "PASS") {
      throw new Error(
        "poc-meta-reporting did not pass, so report summary generation cannot proceed safely.",
      );
    }

    const promptInput = buildReportPromptInput({
      accountId: reportingEvidence.selectedAccountId,
      rows: reportingEvidence.rows,
      dateRange: reportingEvidence.dateRange,
    });

    const generated = await generateOpenRouterReportSummary(promptInput);
    model = generated.model;
    report = generated.report;

    await writeJsonFile(evidencePath, {
      slice: "poc-report-summary",
      runAt: isoNow(),
      verdict,
      blocker,
      model,
      promptInput,
      report,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        model,
        report,
      }),
    );

    console.log(JSON.stringify({ verdict, blocker, model, evidencePath, summaryPath }));
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown report summary error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-report-summary",
      runAt: isoNow(),
      verdict,
      blocker,
      model,
      report,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        model,
        report,
      }),
    );

    console.log(JSON.stringify({ verdict, blocker, model, evidencePath, summaryPath }));
    process.exitCode = 1;
  }
}

await main();

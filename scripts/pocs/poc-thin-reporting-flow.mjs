import { randomUUID } from "node:crypto";

import { isoNow, todayDate, writeJsonFile, writeTextFile } from "./lib/fs.mjs";
import { readJsonFile } from "./lib/reporting.mjs";

const summaryPath = "docs/sub-agents/poc-thin-reporting-flow-summary.md";
const evidencePath = "docs/sub-agents/poc-thin-reporting-flow-evidence.json";

function buildSummary({ verdict, blocker, completedSteps }) {
  const lines = [
    "# POC: Thin Reporting Flow",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- Composed the reporting chain from prior POC outputs.",
    "- Verified the required slice dependencies were all in a passing state.",
    "- Built one thin run artifact that points to the saved output chain.",
    "",
    "## Outcome",
    "",
    `- Completed steps: ${completedSteps.join(" -> ") || "none"}`,
  ];

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: the thin reporting flow is proven end to end.");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-thin-reporting-flow-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Clear the missing dependency and rerun this end-to-end reporting proof."
      : "- Thin reporting flow can be mirrored in the app layer next.",
  );

  return lines.join("\n");
}

async function main() {
  let verdict = "PASS";
  let blocker = null;
  const completedSteps = [];

  try {
    const metaReporting = await readJsonFile("docs/sub-agents/poc-meta-reporting-evidence.json");
    const reportSummary = await readJsonFile("docs/sub-agents/poc-report-summary-evidence.json");
    const slackDelivery = await readJsonFile("docs/sub-agents/poc-slack-delivery-evidence.json");
    const observability = await readJsonFile("docs/sub-agents/poc-observability-evidence.json");

    if (metaReporting.verdict !== "PASS") {
      throw new Error("poc-meta-reporting is not passing.");
    }
    completedSteps.push("meta-reporting");

    if (reportSummary.verdict !== "PASS") {
      throw new Error("poc-report-summary is not passing.");
    }
    completedSteps.push("report-summary");

    if (slackDelivery.verdict !== "PASS") {
      throw new Error(`poc-slack-delivery is blocked: ${slackDelivery.blocker}`);
    }
    completedSteps.push("slack-delivery");

    if (observability.verdict !== "PASS") {
      throw new Error(`poc-observability is blocked: ${observability.blocker}`);
    }
    completedSteps.push("observability");

    await writeJsonFile(evidencePath, {
      slice: "poc-thin-reporting-flow",
      runAt: isoNow(),
      verdict,
      blocker,
      runId: `thin-reporting-${randomUUID()}`,
      completedSteps,
      reportSummary: reportSummary.report,
    });
    await writeTextFile(summaryPath, buildSummary({ verdict, blocker, completedSteps }));

    console.log(JSON.stringify({ verdict, blocker, evidencePath, summaryPath }));
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown thin reporting flow error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-thin-reporting-flow",
      runAt: isoNow(),
      verdict,
      blocker,
      completedSteps,
    });
    await writeTextFile(summaryPath, buildSummary({ verdict, blocker, completedSteps }));

    console.log(JSON.stringify({ verdict, blocker, evidencePath, summaryPath }));
    process.exitCode = 1;
  }
}

await main();

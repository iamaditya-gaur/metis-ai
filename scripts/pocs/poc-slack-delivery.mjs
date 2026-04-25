import { isoNow, todayDate, writeJsonFile, writeTextFile } from "./lib/fs.mjs";
import { readJsonFile } from "./lib/reporting.mjs";
import { buildSlackBlocksFromReport, postSlackMessage } from "./lib/slack.mjs";

const reportEvidencePath = "docs/sub-agents/poc-report-summary-evidence.json";
const summaryPath = "docs/sub-agents/poc-slack-delivery-summary.md";
const evidencePath = "docs/sub-agents/poc-slack-delivery-evidence.json";

function buildSummary({ verdict, blocker, plainMessageStatus, formattedMessageStatus }) {
  const lines = [
    "# POC: Slack Delivery",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- Loaded the saved reporting-summary evidence.",
    "- Attempted one plain-text Slack webhook message.",
    "- Attempted one formatted Slack webhook message using report content.",
    "",
    "## Outcome",
    "",
    `- Plain message status: ${plainMessageStatus ?? "not sent"}`,
    `- Formatted message status: ${formattedMessageStatus ?? "not sent"}`,
  ];

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: both Slack webhook messages were accepted.");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-slack-delivery-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Fix Slack webhook readiness, then rerun this slice before the thin reporting flow."
      : "- Slack delivery is proven for reporting output.",
  );

  return lines.join("\n");
}

async function main() {
  let verdict = "PASS";
  let blocker = null;
  let plainMessageResult = null;
  let formattedMessageResult = null;

  try {
    const reportEvidence = await readJsonFile(reportEvidencePath);

    if (reportEvidence.verdict !== "PASS") {
      throw new Error("poc-report-summary did not pass, so Slack delivery cannot be tested safely.");
    }

    plainMessageResult = await postSlackMessage({
      text: `Metis AI POC plain-text check (${todayDate()}): ${reportEvidence.report.executiveSummary}`,
    });

    formattedMessageResult = await postSlackMessage({
      text: reportEvidence.report.slackMessage,
      blocks: buildSlackBlocksFromReport(reportEvidence.report),
    });

    await writeJsonFile(evidencePath, {
      slice: "poc-slack-delivery",
      runAt: isoNow(),
      verdict,
      blocker,
      plainMessageResult,
      formattedMessageResult,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        plainMessageStatus: plainMessageResult.status,
        formattedMessageStatus: formattedMessageResult.status,
      }),
    );

    console.log(JSON.stringify({ verdict, blocker, evidencePath, summaryPath }));
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown Slack delivery error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-slack-delivery",
      runAt: isoNow(),
      verdict,
      blocker,
      plainMessageResult,
      formattedMessageResult,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        plainMessageStatus: plainMessageResult?.status ?? null,
        formattedMessageStatus: formattedMessageResult?.status ?? null,
      }),
    );

    console.log(JSON.stringify({ verdict, blocker, evidencePath, summaryPath }));
    process.exitCode = 1;
  }
}

await main();

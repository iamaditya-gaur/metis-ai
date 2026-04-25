import { randomUUID } from "node:crypto";

import { isoNow, todayDate, writeJsonFile, writeTextFile } from "./lib/fs.mjs";
import { readJsonFile } from "./lib/reporting.mjs";

const summaryPath = "docs/sub-agents/poc-thin-builder-flow-summary.md";
const evidencePath = "docs/sub-agents/poc-thin-builder-flow-evidence.json";

function buildSummary({ verdict, blocker, completedSteps }) {
  const lines = [
    "# POC: Thin Builder Flow",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- Composed the builder chain from prior POC outputs.",
    "- Verified the required slice dependencies were all in a passing state.",
    "- Built one thin run artifact that points to the saved builder chain.",
    "",
    "## Outcome",
    "",
    `- Completed steps: ${completedSteps.join(" -> ") || "none"}`,
  ];

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: the thin builder flow is proven end to end.");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-thin-builder-flow-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Clear the missing dependency and rerun this end-to-end builder proof."
      : "- Thin builder flow can be mirrored in the app layer next.",
  );

  return lines.join("\n");
}

async function main() {
  let verdict = "PASS";
  let blocker = null;
  const completedSteps = [];

  try {
    const brandResearch = await readJsonFile("docs/sub-agents/poc-brand-research-evidence.json");
    const brandBrief = await readJsonFile("docs/sub-agents/poc-brand-brief-evidence.json");
    const builderOutput = await readJsonFile("docs/sub-agents/poc-builder-output-evidence.json");
    const draftValidation = await readJsonFile("docs/sub-agents/poc-draft-validation-evidence.json");
    const draftWrite = await readJsonFile("docs/sub-agents/poc-draft-write-evidence.json");
    const observability = await readJsonFile("docs/sub-agents/poc-observability-evidence.json");

    if (brandResearch.verdict !== "PASS") {
      throw new Error("poc-brand-research is not passing.");
    }
    completedSteps.push("brand-research");

    if (brandBrief.verdict !== "PASS") {
      throw new Error("poc-brand-brief is not passing.");
    }
    completedSteps.push("brand-brief");

    if (builderOutput.verdict !== "PASS") {
      throw new Error("poc-builder-output is not passing.");
    }
    completedSteps.push("builder-output");

    if (draftValidation.verdict !== "PASS") {
      throw new Error(`poc-draft-validation is blocked: ${draftValidation.blocker}`);
    }
    completedSteps.push("draft-validation");

    if (draftWrite.verdict !== "PASS") {
      throw new Error(`poc-draft-write is blocked: ${draftWrite.blocker}`);
    }
    completedSteps.push("draft-write");

    if (observability.verdict !== "PASS") {
      throw new Error(`poc-observability is blocked: ${observability.blocker}`);
    }
    completedSteps.push("observability");

    await writeJsonFile(evidencePath, {
      slice: "poc-thin-builder-flow",
      runAt: isoNow(),
      verdict,
      blocker,
      runId: `thin-builder-${randomUUID()}`,
      completedSteps,
      builderOutput: builderOutput.builderOutput,
    });
    await writeTextFile(summaryPath, buildSummary({ verdict, blocker, completedSteps }));

    console.log(JSON.stringify({ verdict, blocker, evidencePath, summaryPath }));
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown thin builder flow error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-thin-builder-flow",
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

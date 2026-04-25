import { isoNow, todayDate, writeJsonFile, writeTextFile } from "./lib/fs.mjs";
import { readJsonFile } from "./lib/reporting.mjs";
import { validateDraftLaunchSpec } from "./lib/draft-validation.mjs";

const builderEvidencePath = "docs/sub-agents/poc-builder-output-evidence.json";
const summaryPath = "docs/sub-agents/poc-draft-validation-summary.md";
const evidencePath = "docs/sub-agents/poc-draft-validation-evidence.json";

function buildSummary({ verdict, blocker, validatedDrafts }) {
  const lines = [
    "# POC: Draft Validation",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- Loaded the saved builder-output evidence.",
    "- Applied deterministic safety validation to the DraftLaunchSpec.",
    "- Converted the draft spec into normalized write payloads for a later Meta write attempt.",
    "",
    "## Outcome",
    "",
    `- Campaign payload ready: ${validatedDrafts?.campaignPayload ? "yes" : "no"}`,
    `- Ad set payloads: ${validatedDrafts?.adSetPayloads?.length ?? 0}`,
    `- Creative payloads: ${validatedDrafts?.creativePayloads?.length ?? 0}`,
    `- Ad payloads: ${validatedDrafts?.adPayloads?.length ?? 0}`,
  ];

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: paused-draft payloads passed deterministic safety checks.");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-draft-validation-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Tighten builder output or validator rules before attempting any Meta draft write."
      : "- Continue to `poc-observability` and then the paused draft write attempt.",
  );

  return lines.join("\n");
}

async function main() {
  let verdict = "PASS";
  let blocker = null;
  let validatedDrafts = null;

  try {
    const builderEvidence = await readJsonFile(builderEvidencePath);

    if (builderEvidence.verdict !== "PASS") {
      throw new Error("poc-builder-output did not pass, so draft validation cannot proceed safely.");
    }

    validatedDrafts = validateDraftLaunchSpec(builderEvidence.builderOutput);

    await writeJsonFile(evidencePath, {
      slice: "poc-draft-validation",
      runAt: isoNow(),
      verdict,
      blocker,
      validatedDrafts,
    });
    await writeTextFile(summaryPath, buildSummary({ verdict, blocker, validatedDrafts }));

    console.log(JSON.stringify({ verdict, blocker, evidencePath, summaryPath }));
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown draft validation error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-draft-validation",
      runAt: isoNow(),
      verdict,
      blocker,
      validatedDrafts,
    });
    await writeTextFile(summaryPath, buildSummary({ verdict, blocker, validatedDrafts }));

    console.log(JSON.stringify({ verdict, blocker, evidencePath, summaryPath }));
    process.exitCode = 1;
  }
}

await main();

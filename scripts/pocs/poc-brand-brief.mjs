import { isoNow, todayDate, writeJsonFile, writeTextFile } from "./lib/fs.mjs";
import {
  buildBrandBriefPromptInput,
  generateBrandBrief,
  getBuilderInputsFromEnv,
  loadBrandResearchEvidence,
} from "./lib/builder.mjs";

const summaryPath = "docs/sub-agents/poc-brand-brief-summary.md";
const evidencePath = "docs/sub-agents/poc-brand-brief-evidence.json";

function buildSummary({ verdict, blocker, model, builderInputs, brandBrief }) {
  const lines = [
    "# POC: Brand Brief",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- Loaded the saved brand-research bundle from `poc-brand-research`.",
    "- Built a structured Brand Strategist prompt input.",
    "- Attempted to generate a structured `BrandBrief` with OpenRouter.",
    "",
    "## Outcome",
    "",
    `- Brand URL: ${builderInputs.brandUrl}`,
    `- Objective assumption: ${builderInputs.objective}`,
    `- Support level assumption: ${builderInputs.supportLevel}`,
    `- OpenRouter model used: ${model ?? "not available"}`,
  ];

  if (brandBrief) {
    lines.push(
      `- Positioning captured: ${brandBrief.positioning ? "yes" : "no"}`,
      `- Audience items: ${brandBrief.audience.length}`,
      `- Differentiators: ${brandBrief.differentiators.length}`,
      `- Missing inputs called out: ${brandBrief.missingInputs.length}`,
    );
  }

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: a structured BrandBrief was generated and saved.");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-brand-brief-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Stop here until the LLM/config blocker is fixed."
      : "- Continue to `poc-builder-output` using the saved BrandBrief evidence.",
  );

  return lines.join("\n");
}

async function main() {
  const builderInputs = getBuilderInputsFromEnv();
  let verdict = "PASS";
  let blocker = null;
  let model = null;
  let brandBrief = null;

  try {
    const brandResearchEvidence = await loadBrandResearchEvidence();

    if (brandResearchEvidence.verdict !== "PASS") {
      throw new Error("poc-brand-research did not pass, so BrandBrief generation cannot proceed safely.");
    }

    const promptInput = buildBrandBriefPromptInput({
      brandResearchEvidence,
      builderInputs,
    });
    const generated = await generateBrandBrief(promptInput);
    model = generated.model;
    brandBrief = generated.brandBrief;

    await writeJsonFile(evidencePath, {
      slice: "poc-brand-brief",
      runAt: isoNow(),
      verdict,
      blocker,
      model,
      builderInputs,
      brandBrief,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({ verdict, blocker, model, builderInputs, brandBrief }),
    );

    console.log(JSON.stringify({ verdict, blocker, model, evidencePath, summaryPath }));
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown brand brief error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-brand-brief",
      runAt: isoNow(),
      verdict,
      blocker,
      model,
      builderInputs,
      brandBrief,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({ verdict, blocker, model, builderInputs, brandBrief }),
    );

    console.log(JSON.stringify({ verdict, blocker, model, evidencePath, summaryPath }));
    process.exitCode = 1;
  }
}

await main();

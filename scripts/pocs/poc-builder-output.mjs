import { isoNow, todayDate, writeJsonFile, writeTextFile } from "./lib/fs.mjs";
import {
  buildBuilderOutputPromptInput,
  generateBuilderOutput,
  getBuilderInputsFromEnv,
  loadBrandBriefEvidence,
} from "./lib/builder.mjs";

const summaryPath = "docs/sub-agents/poc-builder-output-summary.md";
const evidencePath = "docs/sub-agents/poc-builder-output-evidence.json";

function buildSummary({ verdict, blocker, model, builderInputs, builderOutput }) {
  const lines = [
    "# POC: Builder Output",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- Loaded the saved BrandBrief from `poc-brand-brief`.",
    "- Built a structured Campaign Strategist / Copywriter prompt input.",
    "- Attempted to generate `CampaignPlan`, `CopyPack`, and `DraftLaunchSpec` with OpenRouter.",
    "",
    "## Outcome",
    "",
    `- Brand URL: ${builderInputs.brandUrl}`,
    `- Objective assumption: ${builderInputs.objective}`,
    `- Support level assumption: ${builderInputs.supportLevel}`,
    `- OpenRouter model used: ${model ?? "not available"}`,
  ];

  if (builderOutput) {
    lines.push(
      `- Funnel stages generated: ${builderOutput.campaignPlan?.funnelStages?.length ?? 0}`,
      `- TOF variants: ${builderOutput.copyPack?.tof?.length ?? 0}`,
      `- MOF variants: ${builderOutput.copyPack?.mof?.length ?? 0}`,
      `- BOF variants: ${builderOutput.copyPack?.bof?.length ?? 0}`,
      `- Draft status requested: ${builderOutput.draftLaunchSpec?.requestedStatus ?? "n/a"}`,
    );
  }

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: structured builder output was generated and saved.");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-builder-output-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Stop here until the dependency or LLM blocker is fixed."
      : "- Continue to draft validation once the builder output is reviewed.",
  );

  return lines.join("\n");
}

async function main() {
  const builderInputs = getBuilderInputsFromEnv();
  let verdict = "PASS";
  let blocker = null;
  let model = null;
  let builderOutput = null;

  try {
    const brandBriefEvidence = await loadBrandBriefEvidence();

    if (brandBriefEvidence.verdict !== "PASS") {
      throw new Error("poc-brand-brief did not pass, so builder output generation cannot proceed safely.");
    }

    const promptInput = buildBuilderOutputPromptInput({
      brandBriefEvidence,
      builderInputs,
    });
    const generated = await generateBuilderOutput(promptInput);
    model = generated.model;
    builderOutput = generated.builderOutput;

    await writeJsonFile(evidencePath, {
      slice: "poc-builder-output",
      runAt: isoNow(),
      verdict,
      blocker,
      model,
      builderInputs,
      builderOutput,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({ verdict, blocker, model, builderInputs, builderOutput }),
    );

    console.log(JSON.stringify({ verdict, blocker, model, evidencePath, summaryPath }));
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown builder output error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-builder-output",
      runAt: isoNow(),
      verdict,
      blocker,
      model,
      builderInputs,
      builderOutput,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({ verdict, blocker, model, builderInputs, builderOutput }),
    );

    console.log(JSON.stringify({ verdict, blocker, model, evidencePath, summaryPath }));
    process.exitCode = 1;
  }
}

await main();

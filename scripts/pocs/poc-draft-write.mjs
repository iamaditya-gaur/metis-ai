import { isoNow, todayDate, writeJsonFile, writeTextFile } from "./lib/fs.mjs";
import { createPausedCampaignDraft, listAccessibleAdAccounts } from "./lib/meta-client.mjs";
import { ACCOUNT_LABELS, resolveDraftAccountId } from "./lib/accounts.mjs";
import { maskAdAccountId } from "./lib/mask.mjs";
import { readJsonFile } from "./lib/reporting.mjs";

const validationEvidencePath = "docs/sub-agents/poc-draft-validation-evidence.json";
const summaryPath = "docs/sub-agents/poc-draft-write-summary.md";
const evidencePath = "docs/sub-agents/poc-draft-write-evidence.json";

function buildSummary({ verdict, blocker, selectedAccountId, selectedAccountLabel, createdCampaignId, apiStatus }) {
  const lines = [
    "# POC: Draft Write",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- Loaded the deterministic paused-draft payloads from `poc-draft-validation`.",
    "- Attempted one real paused Meta campaign creation on the selected account.",
    "- Stopped before lower-level writes if the first write path failed.",
    "",
    "## Outcome",
    "",
    `- Draft target account: ${maskAdAccountId(selectedAccountId)} (${selectedAccountLabel})`,
    `- API status: ${apiStatus ?? "not available"}`,
    `- Created campaign ID: ${createdCampaignId ?? "not created"}`,
  ];

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: at least one paused campaign draft object was created successfully.");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-draft-write-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Fix the Meta asset/permission/schema blocker before attempting deeper draft creation."
      : "- Optionally expand from campaign-only write to ad set and ad creation after review.",
  );

  return lines.join("\n");
}

async function main() {
  const selectedAccountId = resolveDraftAccountId();
  const selectedAccountLabel = ACCOUNT_LABELS.draft;
  let verdict = "PASS";
  let blocker = null;
  let createdCampaignId = null;
  let apiStatus = null;
  let responsePayload = null;

  try {
    const validationEvidence = await readJsonFile(validationEvidencePath);

    if (validationEvidence.verdict !== "PASS") {
      throw new Error("poc-draft-validation did not pass, so Meta draft write cannot proceed safely.");
    }

    const { accounts } = await listAccessibleAdAccounts();
    if (!accounts.find((account) => account.id === selectedAccountId)) {
      throw new Error(
        "The configured draft/action account is not accessible to the configured Meta token.",
      );
    }

    const result = await createPausedCampaignDraft({
      accountId: selectedAccountId,
      campaignDraft: validationEvidence.validatedDrafts.campaignPayload,
    });

    apiStatus = result.status;
    responsePayload = result.payload;
    createdCampaignId = result.payload?.id ?? null;

    if (!createdCampaignId) {
      throw new Error("Meta campaign creation returned no campaign id.");
    }

    await writeJsonFile(evidencePath, {
      slice: "poc-draft-write",
      runAt: isoNow(),
      verdict,
      blocker,
      selectedAccountId,
      selectedAccountLabel,
      apiStatus,
      createdCampaignId,
      responsePayload,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        selectedAccountId,
        selectedAccountLabel,
        createdCampaignId,
        apiStatus,
      }),
    );

    console.log(JSON.stringify({ verdict, blocker, createdCampaignId, evidencePath, summaryPath }));
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown draft write error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-draft-write",
      runAt: isoNow(),
      verdict,
      blocker,
      selectedAccountId,
      selectedAccountLabel,
      apiStatus,
      createdCampaignId,
      responsePayload,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        selectedAccountId,
        selectedAccountLabel,
        createdCampaignId,
        apiStatus,
      }),
    );

    console.log(JSON.stringify({ verdict, blocker, createdCampaignId, evidencePath, summaryPath }));
    process.exitCode = 1;
  }
}

await main();

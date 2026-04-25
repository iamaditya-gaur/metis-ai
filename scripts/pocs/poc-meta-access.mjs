import { writeJsonFile, writeTextFile, isoNow, todayDate } from "./lib/fs.mjs";
import { listAccessibleAdAccounts, normalizeAdAccountId } from "./lib/meta-client.mjs";
import { maskAdAccountId, maskName } from "./lib/mask.mjs";

const summaryPath = "docs/sub-agents/poc-meta-access-summary.md";
const evidencePath = "docs/sub-agents/poc-meta-access-evidence.json";

function buildSummary({ verdict, blocker, accounts, pages, selectedAccountId }) {
  const lines = [
    "# POC: Meta Access",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- `GET /me/adaccounts` using the local Meta access token.",
    "- Pagination metadata capture for accessible accounts.",
    "- Whether the env-selected account is present in the accessible account list.",
    "",
    "## Outcome",
    "",
    `- Accessible accounts returned: ${accounts.length}`,
    `- Pages fetched: ${pages.length}`,
    `- Env-selected account: ${selectedAccountId ? maskAdAccountId(selectedAccountId) : "not set"}`,
  ];

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: token can read at least one ad account and the selected account is accessible.");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-meta-access-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Stop here until the Meta token or selected account issue is fixed."
      : "- Continue to `poc-meta-reporting` with the confirmed selected account.",
  );

  return lines.join("\n");
}

async function main() {
  const selectedAccountId = process.env.META_AD_ACCOUNT_ID?.trim()
    ? normalizeAdAccountId(process.env.META_AD_ACCOUNT_ID)
    : null;

  let verdict = "PASS";
  let blocker = null;

  try {
    const { accounts, pages } = await listAccessibleAdAccounts();
    const selectedAccount = selectedAccountId
      ? accounts.find((account) => account.id === selectedAccountId)
      : null;

    if (accounts.length === 0) {
      verdict = "FAIL";
      blocker = "Meta returned zero accessible ad accounts for the configured token.";
    } else if (selectedAccountId && !selectedAccount) {
      verdict = "FAIL";
      blocker =
        "The configured META_AD_ACCOUNT_ID is not present in the accessible account list for this token.";
    }

    const evidence = {
      slice: "poc-meta-access",
      runAt: isoNow(),
      verdict,
      blocker,
      selectedAccountId: selectedAccountId ? maskAdAccountId(selectedAccountId) : null,
      pages,
      accounts: accounts.map((account) => ({
        id: maskAdAccountId(account.id),
        accountId: account.accountId ? maskAdAccountId(account.accountId) : null,
        name: maskName(account.name),
        accountStatus: account.accountStatus,
        currency: account.currency,
        timezoneName: account.timezoneName,
        amountSpent: account.amountSpent,
        selected: account.id === selectedAccountId,
      })),
    };

    await writeJsonFile(evidencePath, evidence);
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        accounts,
        pages,
        selectedAccountId,
      }),
    );

    console.log(
      JSON.stringify({
        verdict,
        blocker,
        accessibleAccounts: accounts.length,
        evidencePath,
        summaryPath,
      }),
    );

    if (verdict === "FAIL") {
      process.exitCode = 1;
    }
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown Meta access error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-meta-access",
      runAt: isoNow(),
      verdict,
      blocker,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        accounts: [],
        pages: [],
        selectedAccountId,
      }),
    );

    console.log(JSON.stringify({ verdict, blocker, evidencePath, summaryPath }));
    process.exitCode = 1;
  }
}

await main();

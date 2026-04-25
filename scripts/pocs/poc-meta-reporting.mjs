import { writeJsonFile, writeTextFile, isoNow, todayDate } from "./lib/fs.mjs";
import {
  getAccountInsights,
  listAccessibleAdAccounts,
  resolveDateRangeFromEnv,
} from "./lib/meta-client.mjs";
import { ACCOUNT_LABELS, resolveReportingAccountId } from "./lib/accounts.mjs";
import { maskAdAccountId, maskName } from "./lib/mask.mjs";
import { buildInsightsSnapshot } from "./lib/reporting.mjs";

const summaryPath = "docs/sub-agents/poc-meta-reporting-summary.md";
const evidencePath = "docs/sub-agents/poc-meta-reporting-evidence.json";

function buildSummary({
  verdict,
  blocker,
  rowCount,
  pages,
  dateRange,
  snapshot,
  selectedAccountId,
  selectedAccountLabel,
}) {
  const lines = [
    "# POC: Meta Reporting",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- Verified the env-selected account is accessible to the local Meta token.",
    "- Called `GET /act_<account_id>/insights` at `campaign` level for one unattended-safe reporting window.",
    "- Normalized the returned rows into a reporting snapshot suitable for summary generation.",
    "",
    "## Outcome",
    "",
    `- Selected account: ${maskAdAccountId(selectedAccountId)} (${selectedAccountLabel})`,
    `- Reporting window: ${dateRange.label}`,
    `- Insight rows returned: ${rowCount}`,
    `- Pages fetched: ${pages.length}`,
  ];

  if (snapshot) {
    lines.push(
      `- Total spend: ${snapshot.totals.spend ?? "n/a"}`,
      `- Total impressions: ${snapshot.totals.impressions ?? "n/a"}`,
      `- Total clicks: ${snapshot.totals.clicks ?? "n/a"}`,
      `- Derived CTR: ${snapshot.totals.ctr ?? "n/a"}%`,
      `- Derived CPC: ${snapshot.totals.cpc ?? "n/a"}`,
    );
  }

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: the selected account returned usable campaign-level insight rows.");
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-meta-reporting-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Stop here until the Meta reporting blocker is fixed."
      : "- Continue to `poc-report-summary` using the saved sanitized reporting evidence.",
  );

  return lines.join("\n");
}

async function main() {
  const selectedAccountId = resolveReportingAccountId();
  const selectedAccountLabel = ACCOUNT_LABELS.reporting;
  const dateRange = resolveDateRangeFromEnv();
  let verdict = "PASS";
  let blocker = null;

  try {
    const { accounts } = await listAccessibleAdAccounts();

    if (!accounts.find((account) => account.id === selectedAccountId)) {
      throw new Error(
        "The configured META_AD_ACCOUNT_ID is not accessible to the configured Meta token.",
      );
    }

    const { rows, pages, level } = await getAccountInsights({
      accountId: selectedAccountId,
      level: "campaign",
      dateRange,
    });

    if (rows.length === 0) {
      verdict = "FAIL";
      blocker = "Meta insights returned zero usable rows for the configured account and date range.";
    }

    const snapshot = buildInsightsSnapshot(rows, dateRange);
    const evidence = {
      slice: "poc-meta-reporting",
      runAt: isoNow(),
      verdict,
      blocker,
      selectedAccountId: maskAdAccountId(selectedAccountId),
      level,
      dateRange,
      rowCount: rows.length,
      pages,
      snapshot,
      rows: rows.map((row) => ({
        ...row,
        accountId: row.accountId ? maskAdAccountId(row.accountId) : null,
        accountName: maskName(row.accountName),
        campaignId: row.campaignId ? maskAdAccountId(row.campaignId) : null,
        campaignName: maskName(row.campaignName),
      })),
    };

    await writeJsonFile(evidencePath, evidence);
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        rowCount: rows.length,
        pages,
        dateRange,
        snapshot,
        selectedAccountId,
        selectedAccountLabel,
      }),
    );

    console.log(
      JSON.stringify({
        verdict,
        blocker,
        rowCount: rows.length,
        evidencePath,
        summaryPath,
      }),
    );

    if (verdict === "FAIL") {
      process.exitCode = 1;
    }
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown Meta reporting error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-meta-reporting",
      runAt: isoNow(),
      verdict,
      blocker,
      selectedAccountId: maskAdAccountId(selectedAccountId),
      dateRange,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        rowCount: 0,
        pages: [],
        dateRange,
        snapshot: null,
        selectedAccountId,
        selectedAccountLabel,
      }),
    );

    console.log(JSON.stringify({ verdict, blocker, evidencePath, summaryPath }));
    process.exitCode = 1;
  }
}

await main();

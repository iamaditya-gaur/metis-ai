import { isoNow, todayDate, writeJsonFile, writeTextFile } from "./lib/fs.mjs";
import {
  buildBrandResearchBundle,
  chooseHighSignalLinks,
  extractPageData,
  fetchPage,
  resolveBrandUrl,
} from "./lib/brand-research.mjs";

const summaryPath = "docs/sub-agents/poc-brand-research-summary.md";
const evidencePath = "docs/sub-agents/poc-brand-research-evidence.json";

function buildSummary({ verdict, blocker, bundle, targetUrl, attemptedUrls }) {
  const lines = [
    "# POC: Brand Research",
    "",
    `**Date:** ${todayDate()}`,
    `**Verdict:** ${verdict}`,
    "",
    "## What was tested",
    "",
    "- Fetched a real brand site using direct HTTP requests.",
    "- Extracted title, meta description, headings, paragraphs, list items, CTAs, and internal links.",
    "- Crawled the homepage plus a small set of high-signal internal pages.",
    "- Normalized the captured content into one brand-research text bundle for later Brand Strategist use.",
    "",
    "## Outcome",
    "",
    `- Target URL: ${targetUrl}`,
    `- URLs attempted: ${attemptedUrls.length}`,
  ];

  if (bundle) {
    lines.push(
      `- Pages crawled successfully: ${bundle.pagesCrawled}`,
      `- Bundle length: ${bundle.bundleText.length} characters`,
      `- Enough signal for next step: ${bundle.enoughSignal ? "yes" : "no"}`,
    );
  }

  if (blocker) {
    lines.push(`- Blocker: ${blocker}`);
  } else {
    lines.push("- Result: a reusable brand text bundle was saved for the next builder slice.");
  }

  if (bundle?.qualityNotes?.length) {
    lines.push("", "## Quality notes", "");
    for (const note of bundle.qualityNotes) {
      lines.push(`- ${note}`);
    }
  }

  lines.push(
    "",
    "## Evidence",
    "",
    `- [poc-brand-research-evidence.json](/Users/adi/my-weekender-project/${evidencePath})`,
    "",
    "## Next step",
    "",
    blocker
      ? "- Stop here until the fetch/extraction blocker is fixed."
      : bundle?.enoughSignal
        ? "- Continue to `poc-brand-brief` once OpenRouter credit is available."
        : "- Parser worked, but extraction is thin; improve parser/fallback before `poc-brand-brief`.",
  );

  return lines.join("\n");
}

async function main() {
  const targetUrl = resolveBrandUrl();
  const queue = [targetUrl];
  const visitedUrls = new Set();
  const attemptedUrls = [];
  const pages = [];
  let verdict = "PASS";
  let blocker = null;

  try {
    while (queue.length > 0 && pages.length < 5) {
      const currentUrl = queue.shift();

      if (!currentUrl || visitedUrls.has(currentUrl)) {
        continue;
      }

      visitedUrls.add(currentUrl);
      attemptedUrls.push(currentUrl);

      const response = await fetchPage(currentUrl);

      if (!response.ok) {
        continue;
      }

      if (!response.contentType?.includes("text/html")) {
        continue;
      }

      const pageData = extractPageData(response.url, response.html);
      pages.push(pageData);

      const nextLinks = chooseHighSignalLinks(targetUrl, pageData, visitedUrls, 4);

      for (const nextLink of nextLinks) {
        if (!visitedUrls.has(nextLink) && !queue.includes(nextLink) && queue.length < 8) {
          queue.push(nextLink);
        }
      }
    }

    const bundle = buildBrandResearchBundle(pages, targetUrl);

    if (pages.length === 0) {
      verdict = "FAIL";
      blocker = "No HTML pages were fetched successfully from the target brand URL.";
    } else if (!bundle.enoughSignal) {
      verdict = "FAIL";
      blocker =
        "Extraction completed, but the bundle is too thin for confident brand-brief generation without parser/fallback improvement.";
    }

    const evidence = {
      slice: "poc-brand-research",
      runAt: isoNow(),
      verdict,
      blocker,
      targetUrl,
      attemptedUrls,
      bundle,
    };

    await writeJsonFile(evidencePath, evidence);
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        bundle,
        targetUrl,
        attemptedUrls,
      }),
    );

    console.log(
      JSON.stringify({
        verdict,
        blocker,
        targetUrl,
        pagesCrawled: bundle.pagesCrawled,
        evidencePath,
        summaryPath,
      }),
    );

    if (verdict === "FAIL") {
      process.exitCode = 1;
    }
  } catch (error) {
    verdict = "FAIL";
    blocker = error instanceof Error ? error.message : "Unknown brand research error.";

    await writeJsonFile(evidencePath, {
      slice: "poc-brand-research",
      runAt: isoNow(),
      verdict,
      blocker,
      targetUrl,
      attemptedUrls,
    });
    await writeTextFile(
      summaryPath,
      buildSummary({
        verdict,
        blocker,
        bundle: null,
        targetUrl,
        attemptedUrls,
      }),
    );

    console.log(JSON.stringify({ verdict, blocker, targetUrl, evidencePath, summaryPath }));
    process.exitCode = 1;
  }
}

await main();

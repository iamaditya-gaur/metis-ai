# Brand Research Options Summary

**Date:** 2026-04-25
**Scope:** Free or no-cost website-content extraction for weekend MVP brand research
**Decision lens:** minimal cost, minimal breakage, enough content quality for brand brief generation

## Recommendation

Use a **two-step local pipeline** for the weekend MVP:

1. **Default path:** direct HTTP fetch + local HTML parsing in TypeScript
2. **Fallback path:** local Playwright render for JS-heavy sites, then run the same parser

Do **not** make Firecrawl the default for the MVP.

Reason:

- `0` external paid dependencies on the main path
- fits the current `Next.js + TypeScript` repo cleanly
- easier to debug than an external scraping API
- enough quality for brand briefing if we extract homepage + a few high-signal pages

## Compared Options

### 1. Plain fetch + HTML parsing

**What it is**

- Fetch page HTML directly
- Parse locally with a lightweight extractor
- Recommended stack for this repo:
  - `fetch`
  - `cheerio` for DOM parsing
  - `@mozilla/readability` + `jsdom` for article-like cleanup where useful

**Why it fits**

- native `fetch` is already standard web platform behavior
- Cheerio is a fast HTML parser for Node
- Mozilla Readability can turn noisy HTML into cleaner article text

**Strengths**

- free
- least operational complexity
- easiest to control and inspect
- no API key or vendor lock-in

**Weaknesses**

- weaker on JS-rendered sites
- may pull nav/footer noise unless we filter
- extraction quality depends on our heuristics

**Weekend verdict**

Best default choice.

### 2. Firecrawl free plan

**What it is**

- External API that returns clean markdown/HTML from a URL
- Handles dynamic pages, caching, rate limits, and JS-rendered content

**Official constraints**

- free plan is `500` one-time credits
- scrape costs `1 credit / page`
- free tier has `2` concurrent requests

**Strengths**

- very good extraction quality out of the box
- simpler for dynamic pages
- returns markdown directly

**Weaknesses**

- external dependency and API key
- one-time free credits, not durable for repeated testing
- another failure point in the MVP path
- more moving parts than needed for initial POC

**Weekend verdict**

Useful as an optional fallback if local extraction fails badly on real target sites. Not the main recommendation for a free-first MVP.

### 3. Other free/no-cost local approaches

#### A. Playwright render + parser

**What it is**

- Open the page in a local browser
- wait for render
- read the final HTML/content
- parse locally

**Strengths**

- good for JS-heavy marketing sites
- no paid vendor
- strong fallback when direct fetch misses rendered content

**Weaknesses**

- slower
- heavier runtime
- more fragile than plain fetch if overused

**Weekend verdict**

Best fallback path, not the default path.

#### B. Trafilatura

**What it is**

- Python library for extracting main text and metadata from web pages

**Strengths**

- free
- strong text extraction
- good if the Python worker becomes the main agent runtime

**Weaknesses**

- adds a second app-language path for a repo that is currently TypeScript-first
- not the best first choice unless brand research is moved fully into Python

**Weekend verdict**

Good option later if the CrewAI worker owns this step. Not the simplest first implementation for this repo.

## Recommended Weekend Implementation

Build brand research as a deterministic tool, not an agent capability.

Suggested flow:

1. Fetch the brand homepage with `fetch`
2. Parse title, meta description, headings, paragraph text, links, and obvious CTA text
3. Extract likely high-signal links such as `/about`, `/pricing`, `/products`, `/services`
4. Fetch up to `3-5` pages total
5. Normalize to a single cleaned text bundle
6. If fetched text is too thin or obviously broken, retry one page with Playwright

This gives enough input quality for the Brand Strategist without adding cost.

## Decision

For this repo, use:

- **Primary:** `fetch` + `cheerio`
- **Optional cleanup:** `@mozilla/readability` + `jsdom`
- **Fallback for hard sites:** `Playwright`
- **Not default:** `Firecrawl`

That is the cleanest weekend choice for free usage, low breakage, and acceptable content quality.

## Sources

- MDN Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- Cheerio docs: https://cheerio.js.org/
- Mozilla Readability: https://github.com/mozilla/readability
- Playwright docs: https://playwright.dev/docs/intro
- Playwright Python docs: https://playwright.dev/python/docs/intro
- Firecrawl scrape docs: https://docs.firecrawl.dev/features/scrape
- Firecrawl billing: https://docs.firecrawl.dev/billing
- Firecrawl pricing: https://www.firecrawl.dev/pricing
- Trafilatura quickstart: https://trafilatura.readthedocs.io/en/stable/quickstart.html

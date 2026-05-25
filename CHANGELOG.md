# Changelog

All notable changes to Metis AI are recorded here. Newest first.

The project does not follow strict SemVer — it's a single-environment web app
deployed continuously. Each entry is dated and tagged with its PR.

---

## 2026-05-25 — Tone fidelity + fact guardrails

**PR:** [#1](https://github.com/iamaditya-gaur/metis-ai/pull/1) — squash-merged to `main`.

### What shipped

- **Client-message voice now mirrors uploaded examples.** Step B of the reporting
  pipeline (`composeClientMessage` in `src/lib/metis/tone.ts`) no longer
  rewrites Step A's neutral draft — it composes a fresh message from the
  factual report payload plus 8 verbatim user examples wrapped in
  `<EXAMPLES>` / `<FACTS>` / `<TASK>` blocks. Compose temperature raised
  to 0.7; sample budget raised from 4 to 8.
- **Cost-gated voice + fact judges run in parallel** (`Promise.allSettled`)
  after the first compose. A combined critique (voice mismatches + fact
  mismatches + deterministic violations) drives at most one regenerate. Voice
  threshold tightened from 7 → 8 so borderline cases fire.
- **Three-tier activity attribution** (`buildCanonicalActivities`).
  Meta `/activities` events are classified `MANUAL` (operator edits — first-
  person verbiage), `RULE` (operator-defined automation — neutral passive
  verbiage), or `SYSTEM` (Shopify Audiences, ASA auto-audiences, pixel
  events, etc. — filtered out before reaching the LLM). Prevents the
  "you bumped audiences on X" hallucination class.
- **Prioritised + deduped change history.** Budget / status changes lead;
  same-(object, field, direction) edits within the window collapse to one
  row with `(edited Nx)`. Cap raised 10 → 20 so the earliest day of a
  weekly window doesn't get truncated behind automated noise.
- **Deterministic objective-aware metric selection**
  (`src/lib/metis/metric-selection.ts`, 665 lines, zero LLM cost). User
  vocabulary always wins; otherwise a codified media-buyer rule table per
  Meta objective decides. ROAS / AOV / purchase-value only appear as primary
  on `OUTCOME_SALES`. Impressions / reach blocked from primary on
  conversion objectives unless the user's examples mention them.
- **ROAS pipeline.** Meta `action_values` (previously fetched but unused) are
  now consumed; `purchaseValue`, `roas`, `aov`, `linkClicks`, `lpv` flow
  through snapshot → primary-metric tier → compose. Mentioned in 100 % of
  the test account's example messages — now correctly surfaced.
- **Deterministic fact-check** (`src/lib/metis/fact-check.ts`).
  Regex-level direction-flip detection (UP/DOWN, PAUSE/RESUME, CREATE/DELETE)
  paired with the LLM fact-judge. If violations survive one regen, the run
  falls back to the operator-view message rather than ship a wrong claim
  (`factCheckBlocked: true`).
- **OpenRouter 401 surfacing.** When the API key is invalid / expired /
  revoked, both `scripts/pocs/lib/llm.mjs` and
  `scripts/pocs/lib/reporting.mjs` short-circuit and throw a single-sentence
  user-facing message naming the env var and where to update it — replaces
  the raw upstream payload dump that previously bubbled up.

### New observability fields

`ReportingRunResponse` now includes `factScore`, `factMismatches`,
`factViolations`, `factCheckBlocked`, and a `regenDecision` diagnostic on each
saved run for debugging why regen did / didn't fire.

### Files of note for the next agent

| Path | Why |
|---|---|
| `src/lib/metis/tone.ts` | Compose flow + voice judge + activity classification + content vocabulary |
| `src/lib/metis/metric-selection.ts` | Objective-aware deterministic metric picker |
| `src/lib/metis/fact-check.ts` | Deterministic direction-flip detector |
| `src/lib/metis/reporting.ts` | Top-level pipeline; wires compose / judge / regen / persist |
| `scripts/pocs/lib/reporting.mjs` | Step A summariser; ROAS/AOV computation from `action_values` |
| `scripts/pocs/lib/llm.mjs` | OpenRouter helper; usage + prompts capture; 401 short-circuit |
| `src/lib/auth/admin-gate.ts` | HMAC-signed cookie auth; swap-point for Supabase Auth |

### Verification (preview, pre-merge)

Confirmed on `https://metis-8msx0dvyt-iamaditya-gaurs-projects.vercel.app`:
- Reporting run completes end-to-end against the test ad account.
- Voice closer to uploaded examples.
- Budget direction reported correctly on `OUTCOME_SALES` campaigns.
- ROAS, spend, results selected — impressions / reach / frequency omitted.
- Shopify Audiences automated events filtered.
- Admin trace UI at `/admin/runs/[runId]` shows per-call model, tokens, cost,
  latency, prompts, response.

### Known gaps (carried into the next session)

- Supabase Branching not yet enabled — preview deploys share the production
  database. See `docs/handoff/supabase-branching.md`.
- No user auth yet. `/admin` is the only gated surface; reporting is open.
- Voice judge threshold (8) is hand-tuned. Needs a small eval set later.
- No automated tests for the reporting pipeline.

---

## 2026-04-26 — Observability v1

**PR:** [#2](https://github.com/iamaditya-gaur/metis-ai/pull/2) +
[#3](https://github.com/iamaditya-gaur/metis-ai/pull/3) (middleware nodejs fix)

- Per-LLM-call usage + latency + cost + fallback chain capture.
- Supabase `public.metis_runs` persistence (JSONL kept as dev fallback).
- Admin gate (`/admin/login`, HMAC-signed cookie, middleware on `/admin/*`).
- Admin trace UI: `/admin/runs` (list + filters), `/admin/runs/[runId]`
  (trace tree, expandable per-call panels with raw prompts + response).
- Legacy `/app/runs` route deleted.

---

## 2026-04-22 — Initial reporting + builder POC

Pre-history. Reporting (`/reporting`) generates a factual operator view and a
client-style message; builder (`/builder`) creates paused Meta campaign drafts
from a brand URL. Direct OpenRouter `fetch()`; Meta Graph v25; Slack webhook
delivery.

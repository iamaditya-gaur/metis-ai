# Handoff — Tone fidelity + fact guardrails release (2026-05-25)

This doc exists to brief the **next agent** picking up Metis AI after this
release lands. Read this first if you're new to the codebase, then read
`docs/reporting-context.md` for the full product context.

## What just shipped

Squash-merged to `main` via [PR #1](https://github.com/iamaditya-gaur/metis-ai/pull/1).
Full diff: ~30 files, ~5k LoC. See `CHANGELOG.md` for the user-facing summary.

The release closes the original product gap: the client-style message now
sounds like the operator and reports activity accurately. Two prior failure
modes — corporate-flavoured rewrites and direction-flipped action verbs — are
both addressed with deterministic guardrails plus an LLM judge backstop.

## How the reporting pipeline now runs (per user invocation)

1. **Meta `/insights` fetch** (`scripts/pocs/lib/meta-client.mjs`)
2. **Conditional Meta `/activities` fetch** — only when the user's tone
   examples mention changes (`contentVocabulary.mentionsChanges`).
   Permission failures degrade gracefully — the rest of the run continues.
3. **Snapshot build** (`scripts/pocs/lib/reporting.mjs`
   `buildInsightsSnapshot`). Computes ROAS, AOV, purchase value, link clicks,
   landing-page views from Meta `action_values`.
4. **Step A — factual report summary**: LLM call → `{executiveSummary,
   whatChanged, risks, nextActions, slackMessage}`. Powers the operator-view
   UI.
5. **Tone profile build** (`buildToneProfile` in `src/lib/metis/tone.ts`):
   numeric style, content vocabulary, mentioned-metrics, mentions-changes
   signals extracted from uploaded examples.
6. **Step B — compose client message** (`composeClientMessage`): fresh
   composition from `<EXAMPLES>` + `<FACTS>` (split into `<METRICS_PRIMARY>`
   selected by `selectPrimaryMetrics` + `<METRICS_OPTIONAL>`) + optional
   `<CHANGES>` block (canonical activities with `ACTOR` column).
   Temperature 0.7, 8 examples max.
7. **Parallel judges** (`Promise.allSettled`): voice judge (score 0-10 vs
   examples) + fact judge (catalog-aware 8-category sanity check).
8. **Deterministic fact-check** (`checkActivityDirections` in
   `src/lib/metis/fact-check.ts`): regex sweep for same-axis direction flips
   (UP↔DOWN, PAUSE↔RESUME, CREATE↔DELETE).
9. **One regen attempt** if any guardrail trips. Critique = voice mismatches
   + fact mismatches + deterministic violations. Regen output is re-checked
   deterministically.
10. **Fallback to operator-view message** if violations survive regen
    (`factCheckBlocked: true`).
11. **Slack delivery** (if webhook configured).
12. **Persist run** to Supabase `public.metis_runs` (JSONL fallback in local
    dev). Each LLM call's system prompt + user message + raw response are
    captured for admin-UI inspection.

## The deterministic spine (no LLM cost)

Three modules do the load-bearing work without spending LLM tokens:

- **`metric-selection.ts`** — Picks which metrics belong in
  `<METRICS_PRIMARY>` based on (a) user's example vocabulary first, then
  (b) a codified per-objective priority table. `SALES_ONLY_METRICS` blocks
  ROAS/AOV/purchase-value from appearing on non-sales campaigns by default.
  `CONVERSION_OBJECTIVES` blocks impressions/reach from primary for sales /
  leads / traffic / engagement / app-promotion unless vocabulary explicitly
  asks. Density cap = `averageMetricCount + 1`.
- **`tone.ts` `classifyActivityActor`** — Tags each `/activities` row as
  MANUAL / RULE / SYSTEM via pattern matching on event type, actor name, and
  object name. SYSTEM rows (Shopify, ASA, pixel events, advantage auto, etc.)
  are filtered before reaching the LLM. MANUAL gets first-person verbiage;
  RULE gets neutral passive.
- **`fact-check.ts` `checkActivityDirections`** — Regex sweep for same-axis
  verb flips. Returns a `FactCheckResult` and `violationsToCritique` helper
  that produces compose-ready critique strings.

## Things the next agent should know

### Carried-over follow-ups

| Item | Where | Why it matters |
|---|---|---|
| **Supabase Branching** | `docs/handoff/supabase-branching.md` | Preview deploys still hit the production DB. Set up branching to isolate. |
| **User auth** | Not started | Today `/reporting` is open; only `/admin` is gated. When user auth lands, the `user_id` column on `metis_runs` (already added) gets populated, and `getRunById` already accepts `{ userId }` for RLS-style filtering. |
| **Voice judge eval set** | Not started | Threshold 8 is hand-tuned. Build a small eval set of (examples, draft, expected score) to validate. |
| **No automated tests on reporting** | `scripts/pocs/poc-*.mjs` are ad-hoc | Worth a real test suite around `metric-selection.ts`, `fact-check.ts`, `classifyActivityActor`. |

### Things that look wrong but aren't

- **`agentSteps` extends `LlmCallRecord`** in `reporting.ts` — that's
  deliberate, the same record powers both top-level pipeline tracing and the
  flat `llmCalls[]` array consumed by the admin UI.
- **`originalSlackMessage` is *not* in `factLock`** — Step B intentionally
  doesn't see Step A's draft (that's the whole tone-fidelity fix). Don't
  re-add it.
- **`temperature: 0.7` on compose** — voice tokens need warmth. Facts come
  from `factLock`, so this doesn't endanger correctness.
- **`composeClientMessage` returns a `samples` field on top of
  `clientMessage`** — those are the exact 8 samples used, so the judge can
  grade against the same evidence the model saw.

### Gotchas

- Vercel bakes env vars at *deploy time*. Updating an env var requires a
  redeploy for that change to take effect on a given deployment. The 401
  error message added in this release explicitly calls this out.
- Middleware runs on Node, not Edge — `src/middleware.ts` has
  `runtime: "nodejs"` because the admin gate uses `node:crypto`. Don't
  remove that line.
- `vercel env pull` masks encrypted values as empty strings. Don't trust the
  pulled file to know if a key is set correctly — use the Vercel dashboard.

### New env vars (all already in Vercel)

- `METIS_ADMIN_PASSWORD` — `/admin/login` password
- `METIS_ADMIN_COOKIE_SECRET` — HMAC key for the signed admin cookie

Plus the pre-existing: `OPENROUTER_API_KEY`, `META_ACCESS_TOKEN` (per-account
via header), `SLACK_WEBHOOK_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`.

## Branching workflow

- All work on a topic branch off `main`.
- One commit per logical move (use the existing convention —
  `feat(reporting): ...`, `fix(reporting): ...`, `chore(supabase): ...`).
- Push, open PR, let Vercel build a preview, verify on the preview URL.
- Squash-merge when ready.
- `vercel deploy --prod` after merge.
- `vercel remove <url> --yes` to clean stale previews.

Never push directly to `main`.

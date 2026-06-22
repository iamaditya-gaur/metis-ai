# Changelog

All notable changes to Metis AI are recorded here. Newest first.

The project does not follow strict SemVer — it's a single-environment web app
deployed continuously. Each entry is dated and tagged with its PR.

---

## 2026-06-22 — Production landing, history polish, picker refinements

**Branch:** `feat/foundation-and-shell` — fast-forwarded into `main`.

### What shipped

- **Real landing page at `/`.** The waitlist UI was replaced with a marketing
  landing that funnels to `/signup` or `/login`. New auth-aware `LandingNav`
  shows *Sign in* + *Get started* for visitors and *Open app* when a Supabase
  session is present. Hero / FeatureSections / FinalCta rewritten in the
  reporting JTBD voice. `WaitlistForm` component and `/api/waitlist` route
  deleted; `waitlist_signups` table preserved so historical captures stay.
- **History tab — sort, delete, hero, back nav.** `/app/history` now has a
  sort dropdown (Newest / Oldest / Highest cost / Status), per-row trash
  icon backed by a server action (`src/app/app/history/actions.ts`) that
  relies on RLS for safety, and the "Open run" link uses the primary
  dark-orange button. `/app/history/[runId]` surfaces the client-style
  message at the top with a `HistoryCopyButton`, then operator view, then
  metrics, then expand-on-demand LLM/tool JSON. Bottom "Back to history"
  button replaced with a top-left `← History` chevron via an optional
  `backHref` prop on `AppShell`.
- **Date-picker viewport-aware flip + tighter footprint.** Popover now
  measures available space at open-time and flips above the trigger when
  there's less than ~360px below it. Max-height + vertical scroll fallback
  for short viewports. Removed the redundant "Done" footer button. Same-day
  double-click no longer commits a 0-day range.
- **Studio "Edit window" → dropdown menu.** The collapsed-summary chip's
  CTA became a real menu (`Edit inputs` / `Generate again`). Closes on
  outside click and ESC.
- **Code hygiene pass.** `npm run lint` green (fixed 5 errors + 2 warnings:
  setState-in-effect cases reworked into open-handlers / success paths,
  apostrophe escapes, unused imports, aria-pressed swapped to aria-selected
  on `role="gridcell"`). Deleted ~200 lines of orphan CSS from rounds 1-5
  and removed the unreferenced `MissionControlSwitcher` component.

### New files of note

| Path | Why |
|---|---|
| `src/app/page.tsx` | New auth-aware landing; reads Supabase session server-side |
| `src/components/landing-nav.tsx` | Top nav with Sign in / Get started / Open app CTAs |
| `src/app/app/history/actions.ts` | `deleteRunAction` server action |
| `src/components/history-row-actions.tsx` | Trash button + native confirm |
| `src/components/history-copy-button.tsx` | Clipboard with idle / copied / failed state |
| `src/components/app-shell.tsx` | Now optional `backHref` + `backLabel` for top-left chevron |

### Verification

Confirmed on a Vercel preview before merging to main, then on production
`https://metis-ai-nine.vercel.app`:
- `/api/health` returns `env: production` with all 8 envs `true`.
- `/`, `/login`, `/signup`, `/reset-password`, `/reporting` all 200.
- `/app/reports`, `/app/history`, `/app/history?sort=cost`, `/app/history/<id>` all 307 → `/login` when unauth'd.
- `/api/metis/tone-sources` returns 401 unauth'd.
- `/api/waitlist` returns 404 (route deleted).
- Supabase advisors unchanged (no new RLS regressions).

### Known gaps (carried into the next session)

- Tone-preset UI is auto-save only; explicit save/rename for pasted text is the next UX pickup.
- Mobile drawer still doesn't trap focus.
- Collapsed sidebar uses native `title` tooltips; Linear-style hover panels would feel more polished.
- Legacy `/app/reporting` and `/app/reporting-new` routes still served but unlinked from the new sidebar — candidate for deletion.
- `npm run lint` and `npm run build` are not yet wired into CI.

---

## 2026-06-21 — Authed reporting flow + studio rehaul

**Branch:** `feat/foundation-and-shell` (multi-commit; ultimately merged 2026-06-22).

### What shipped

- **Auth foundation + saved Meta connections.** Supabase Auth via
  `@supabase/ssr` with cookie sessions and RLS scoped by `auth.uid()`.
  Encrypted Meta tokens stored in `meta_connections`
  (AES-256-GCM, `src/lib/crypto/token-encryption.ts`). New authed
  reporting flow at `/app/reports` (`src/components/authed-reporting-studio.tsx`)
  uses saved connections instead of re-pasting tokens.
- **Auth UI rebuild.** Crisp Inter font via `next/font`, clean `.auth-card`,
  no backdrop-filter haze. Auto-confirm signup pattern
  (`admin.createUser({ email_confirm: true })` then `signInWithPassword` on
  the same submit so users land signed-in).
- **Env hardening.** `src/lib/supabase/env.ts` is the single source of truth
  for Supabase env validation (rejects empty strings, names the missing var
  in the thrown error). `/api/health` returns booleans for every required
  env so future deploys can be curl-probed.
- **Post-login UX rehaul (sidebar shell).** Sidebar moved into
  `src/app/app/layout.tsx` so it stays mounted across nav (no flash).
  Per-route `loading.tsx` skeletons for `reports / history / connections /
  settings`. Sidebar collapse cookie (`metis.sidebar`), `useLinkStatus`
  pending bar, mobile drawer.
- **Reporting studio rehaul (collapsing-wizard).** Replaced the
  three-column input strip + side-CTA layout with a single tall form that
  collapses to a summary chip after generation. New brand-matched
  `DateRangePicker` (single control, presets, default to most recent
  fully-available window). Unified tone-context drop-zone with file-chip
  inline UI and a `Use preset ▾` dropdown. Output region rebuilt with a
  tabs/inline-disclosure A/B switch so operator-view demotion can be
  evaluated in-browser. Honest empty states — no fake placeholder numbers.
- **Tone-source persistence.** New `meta_tone_sources` Supabase table
  (`supabase/0008_meta_tone_sources.sql`, RLS-scoped by `auth.uid()`).
  `src/lib/tone-sources/queries.ts` + `src/app/api/metis/tone-sources/route.ts`
  expose list / create / touch / delete. Uploaded tone files auto-save as
  presets in the authed flow.
- **Sidebar fixes.** `:has()` CSS grid switch eliminates the SSR/CSR
  mismatch that caused expanded-sidebar overlap. Toggle relocated from a
  full-width footer pill to a conventional hamburger button in the
  sidebar header. Default collapsed-to-icons.

### Files of note for the next agent

| Path | Why |
|---|---|
| `src/app/(auth)/` | login / signup / reset-password pages |
| `src/lib/supabase/{server,admin,client,middleware,env}.ts` | Supabase clients + env validation |
| `src/components/authed-reporting-studio.tsx` | Connection picker + accounts loader on `/app/reports` |
| `src/components/reporting-studio.tsx` | Shared studio component (used by `/reporting` + `/app/reports`) |
| `src/components/date-range-picker.tsx` | Brand-matched single-control picker with presets |
| `src/components/app-sidebar.tsx` | Hamburger toggle + cookie collapse + mobile drawer |
| `supabase/0004_meta_connections.sql` | Encrypted Meta-token connections + RLS |
| `supabase/0008_meta_tone_sources.sql` | Reusable tone presets + RLS |

### Verification

Confirmed on a Vercel preview before merging to main:
- `npm run build` clean.
- `/api/health` returns 200 with all 8 envs `true`.
- `/login`, `/signup`, `/reset-password`, `/reporting` all 200.
- `/app/*` redirects to `/login` when unauth'd.
- Save-connection flow redirects to `/app/reports?connection=<id>&saved=1` with a toast.
- Both studio output variants render correctly.

### Known gaps (carried into the next session)

- Sidebar collapse cookie persists but the layout's grid is driven by the sidebar's data-attribute via `:has()` — not by the cookie attribute. (One source of truth — but worth knowing if you debug a layout glitch.)
- Mobile drawer focus-trap not implemented.
- Tone-preset history is read-only for pasted text (uploads auto-save; explicit save UI pending).
- Tooltip on collapsed-sidebar icons is the native `title` attribute.

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

Confirmed on a Vercel preview before merging to main:
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

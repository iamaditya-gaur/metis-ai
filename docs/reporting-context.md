# Reporting Context

Last updated: 2026-09-01

## Purpose

This file is a handoff context for future agents working on the standalone reporting product.

The goal is to preserve:
- what has already been built
- the decisions that are now locked
- the important files to review before touching code
- the Vercel deployment context for taking this live later

## Reporting Model Policy

The reporting flow keeps each model on one narrow job. Defaults can be changed
with environment variables without editing code:

| Step | Default | Reason |
|---|---|---|
| Factual summary | `openai/gpt-5.4-mini` | Passed the factual monthly baseline |
| Tone extraction | `anthropic/claude-sonnet-4.6` | Existing production baseline retained after the newer bundle failed final checks |
| Client message | `anthropic/claude-sonnet-4.6` | Existing production baseline retained after the newer bundle failed final checks |
| Voice and fact checks | `openai/gpt-5.4-mini` | Only judge that passed every controlled good/bad case |

The client-message fallback order is Claude Sonnet 4.6, then the configured
reporting model. Signed-in and evaluation calls retry once only when the provider
returns empty, malformed, or schema-incomplete JSON. Anonymous shared-key calls
do not retry unless explicitly enabled. Each attempt is captured in usage and
cost totals, and the reporting workflow has a bounded AI-call deadline.

The August monthly evaluation tested GPT-5.6 Luna for tone extraction and
GPT-5.6 Terra for client messages. The integrated bundle passed deterministic
checks, but a required second judge pass rejected voice in all three runs and
facts in one run. Those models remain evaluation candidates, not defaults.

### Recipient identity guard

The final message recipient comes from the account name returned by Meta. The
name selected in the browser is only a fallback when a zero-row insight response
does not include it. Names are normalized before entering the prompt, and a
deterministic final check repairs a missing, generic, or wrong opening before the
message is returned, logged, or sent.

### Private evaluation boundary

Tone examples, frozen Meta data, prompts, model outputs, and cost ledgers stay
under `.private-evals/`. That directory is ignored by Git. Public tests and docs
use generic account examples only.

### Rollback

No code rollback is required for a model-only incident. Set the tone and client
message model environment variables back to the prior model chain, keep summary
and judges on the factual baseline, then redeploy. The recipient guard and JSON
validation should remain enabled.

## Locked Product Decision

The production reporting experience is no longer the old reporting tab inside the `/app` workspace shell.

The current shipping direction is:
- keep the existing app-shell routes in the repo for now
- treat `/reporting` as the standalone reporting product
- no sidebar on `/reporting`
- first screen asks the user for a Meta access token
- after token entry, the user lands in the standalone reporting desk

Important clarification:
- this is still one Next.js codebase
- this is still one linked Vercel project
- `/reporting` is a new standalone product surface inside the same repo, not a separate repo or separate deployed app yet

This means future work on reporting should prioritize `/reporting`, not `/app/reporting` or `/app/reporting-new`, unless there is a specific maintenance reason.

## Current Product Shape

### Standalone route

- Public standalone route: `/reporting`
- File: [src/app/reporting/page.tsx](../src/app/reporting/page.tsx)

### User flow

1. User opens `/reporting`
2. User sees:
   - left intro section
   - right Meta access token input
   - secondary guide button for getting a Meta token
3. User pastes a Meta access token
4. App calls `POST /api/metis/accounts`
5. Accessible Meta ad accounts are loaded for that session
6. User reaches the reporting desk
7. User selects account + date range + optional pasted past client/team messages and/or uploaded `.txt` / `.md` context files
8. App calls `POST /api/metis/reporting`
9. App returns:
   - core metrics
   - factual operator summary
   - client-style final message
10. User can copy the final client-style message directly from the client view using the circular corner copy action

## Important Product Decisions

### 1. Standalone reporting uses user-supplied token input

For `/reporting`, the Meta token is entered by the user and sent server-side in POST bodies.

This is different from the internal `/app` flow, which can still fall back to env-backed account access.

### 2. Token handling is session-style and ephemeral

The token is:
- posted from the browser to the server
- used to fetch accounts and reporting data
- not shown in output panels
- not intended to be logged or persisted

### 3. Reporting still uses the same reporting logic and connectors

The standalone product is a new UI and route, not a separate reporting backend.

The same underlying reporting workflow still handles:
- Meta insights fetch
- factual summary generation
- tone/profile extraction
- client-style message rewrite
- Slack delivery
- observability

### 4. Client-style reporting is a core value prop

The reporting product is not only about generating a factual report.

A key product promise is:
- the report stays grounded in actual Meta data
- the final summary should sound much closer to how the user has historically reported performance to clients or teams

### 4b. Context input now supports both paste and file upload

The tone/context input for `/reporting` is no longer paste-only.

Users can now provide historical reporting examples in two ways:
- paste text directly into the context textarea
- upload one or more `.txt` or `.md` files

Current behavior:
- both sources are merged into the same `toneExamples` payload before the reporting run
- uploaded files are managed in UI as removable items
- uploaded content is not forced into the textarea UI
- invalid files are rejected client-side

### 4c. Client view now includes a copy action

After a run completes, the final message card in the client view includes a premium circular corner copy action.

Current behavior:
- clicking the button copies the full final client-style message
- success is shown by changing the button itself into a green-tinted check state
- there is no separate floating copied badge anymore

### 5. Metrics currently prioritized in the core metrics section

The current standalone reporting desk prioritizes:
- Spend
- Cost per result
- CTR
- CPM
- CPC

### 6. Cost per result logic

The bug where `cost per result` surfaced the wrong action has already been fixed.

Current logic:
- request action data from Meta insights
- request `cost_per_action_type`
- choose the primary result using objective-aware logic
- for `OUTCOME_SALES`, prefer purchase-type actions over noisy high-volume actions like `page_engagement`

## Current Routes And APIs

### Standalone route

- `/reporting`
- file: [src/app/reporting/page.tsx](../src/app/reporting/page.tsx)

### Standalone UI

- [src/components/standalone-reporting-flow.tsx](../src/components/standalone-reporting-flow.tsx)
- this component owns the token-entry screen, token session handoff, and the account-loading waiting state overlay

### Shared reporting desk UI

- [src/components/reporting-studio.tsx](../src/components/reporting-studio.tsx)
- this component now owns:
  - reporting form state
  - tone-context paste input
  - tone-context file upload state
  - reporting run waiting state overlay
  - final message copy action

### Account loading API

- route: `POST /api/metis/accounts`
- file: [src/app/api/metis/accounts/route.ts](../src/app/api/metis/accounts/route.ts)

Behavior:
- no public `GET` account list
- `POST` accepts `{ accessToken }` or a signed-in saved `connectionId`
- used by standalone `/reporting`

### Reporting run API

- route: `POST /api/metis/reporting`
- file: [src/app/api/metis/reporting/route.ts](../src/app/api/metis/reporting/route.ts)

Behavior:
- accepts reporting payload
- supports optional `accessToken`
- used by standalone `/reporting`

## Files Future Agents Must Review First

These are the primary files to read before proposing or making changes to the reporting product:

- [src/app/reporting/page.tsx](../src/app/reporting/page.tsx)
- [src/components/standalone-reporting-flow.tsx](../src/components/standalone-reporting-flow.tsx)
- [src/components/reporting-studio.tsx](../src/components/reporting-studio.tsx)
- [src/components/processing-overlay.tsx](../src/components/processing-overlay.tsx)
- [src/components/glass-panel.tsx](../src/components/glass-panel.tsx)
- [src/components/status-pill.tsx](../src/components/status-pill.tsx)
- [src/app/globals.css](../src/app/globals.css)
- [src/app/api/metis/accounts/route.ts](../src/app/api/metis/accounts/route.ts)
- [src/app/api/metis/reporting/route.ts](../src/app/api/metis/reporting/route.ts)
- [src/lib/metis/accounts.ts](../src/lib/metis/accounts.ts)
- [src/lib/metis/reporting.ts](../src/lib/metis/reporting.ts)
- [src/lib/metis/tone.ts](../src/lib/metis/tone.ts)
- [src/lib/metis/types.ts](../src/lib/metis/types.ts)
- [scripts/pocs/lib/meta-client.mjs](../scripts/pocs/lib/meta-client.mjs)
- [scripts/pocs/lib/reporting.mjs](../scripts/pocs/lib/reporting.mjs)
- [vercel.json](../vercel.json)
- [.vercel/project.json](../.vercel/project.json)

If the future task is about live deployment or production hardening, the agent should also review:

- [README.md](../README.md)

## Vercel Context

This repo is already linked to a Vercel project.

### Vercel project link

The local checkout is linked through ignored `.vercel` metadata. Do not copy
project or organization IDs into committed documentation.

### Vercel framework config

From [vercel.json](../vercel.json):
- framework: `nextjs`

### Important deployment note

The standalone `/reporting` route is part of the same Next.js app right now.

So taking it live on Vercel currently means deploying the same project, while:
- using `/reporting` as the intended reporting product route
- not treating the old `/app` reporting routes as the primary production experience

Practical implication:
- if you push this repo to GitHub, you can keep working on both the old app-shell surfaces and the standalone `/reporting` product later
- there is no separate “secondary reporting project” to preserve independently yet
- if you want true separation later, that would require either a route split strategy, a second Vercel project, or a second repo

## Reporting Runtime Dependencies

The standalone route depends on more than just the user token input.

Future agents should remember:

- Meta account fetch for `/reporting` can use the user-supplied access token
- reporting generation still requires `OPENROUTER_API_KEY`
- signed-in Slack delivery still requires `SLACK_WEBHOOK_URL`; anonymous runs
  only return the message on screen
- Meta client behavior may also use `META_APP_SECRET` if app secret proof is configured
- evaluation commands must never send Slack messages, write Supabase run logs,
  or deploy the app

Relevant env references:
- [src/lib/metis/env.ts](../src/lib/metis/env.ts)
- [scripts/pocs/lib/meta-client.mjs](../scripts/pocs/lib/meta-client.mjs)
- [scripts/pocs/lib/reporting.mjs](../scripts/pocs/lib/reporting.mjs)
- [scripts/pocs/lib/slack.mjs](../scripts/pocs/lib/slack.mjs)

## Known Direction For Future Improvements

Future reporting work will likely focus on:
- better standalone UX polish
- stronger reporting copy and onboarding
- better tone-context ingestion and quality controls
- better guide/help content for token acquisition
- improving the client-style message quality
- improving operator-view presentation
- improved clipboard and client-message delivery flows
- production hardening before public deployment
- Vercel deployment readiness and environment setup

## Session Changes Already Landed

These changes were implemented during the latest `/reporting` iteration and should be preserved unless the user explicitly changes direction:

### 1. Waiting states were upgraded

The standalone reporting product now has panel-level processing overlays instead of relying only on button-label changes.

Implemented in:
- [src/components/processing-overlay.tsx](../src/components/processing-overlay.tsx)
- [src/components/glass-panel.tsx](../src/components/glass-panel.tsx)
- [src/components/standalone-reporting-flow.tsx](../src/components/standalone-reporting-flow.tsx)
- [src/components/reporting-studio.tsx](../src/components/reporting-studio.tsx)
- [src/app/globals.css](../src/app/globals.css)

Current behavior:
- token loading uses a centered processing overlay inside the token panel
- report generation uses a centered processing overlay inside the reporting hero panel
- buttons also show inline processing indicators
- stale output panels dim during report generation

### 2. Tone context input was expanded

The reporting desk now supports both pasted context and uploaded text/markdown files.

Implemented in:
- [src/components/reporting-studio.tsx](../src/components/reporting-studio.tsx)
- [src/app/globals.css](../src/app/globals.css)

Current behavior:
- upload button accepts `.txt`, `.md`, and `.markdown`
- multiple files are allowed
- duplicate, empty, unsupported, and oversized files are rejected client-side
- uploaded files show as removable UI items
- pasted text plus uploaded file contents are merged into one reporting context payload

### 3. Client view copy action was added

The final client-style message now includes a circular corner copy action.

Implemented in:
- [src/components/reporting-studio.tsx](../src/components/reporting-studio.tsx)
- [src/app/globals.css](../src/app/globals.css)

Current behavior:
- the copy button sits in the top-right corner of the final message card
- success changes the button itself into a green check state
- failure changes the button into an error state
- no extra copied badge should appear

## Constraints

- Do not assume `/app/reporting` is the production target
- Do not automatically execute changes without user permission if the user explicitly asks for review or confirmation first
- Preserve the standalone `/reporting` route unless the user explicitly changes direction
- Preserve the split between factual summary and client-style message
- Preserve ephemeral token behavior for the standalone flow
- Preserve the current `/reporting` UX improvements unless the user explicitly asks to replace them:
  - panel-level loading overlays
  - dual tone-context input (paste + file upload)
  - circular client-message copy action

## Prompt For A Future Agent

Use this prompt for the next agent:

```text
Read the standalone reporting context first in `docs/reporting-context.md`.

Then review these files before proposing any changes:
- `src/app/reporting/page.tsx`
- `src/components/standalone-reporting-flow.tsx`
- `src/components/reporting-studio.tsx`
- `src/components/processing-overlay.tsx`
- `src/components/glass-panel.tsx`
- `src/components/status-pill.tsx`
- `src/app/globals.css`
- `src/app/api/metis/accounts/route.ts`
- `src/app/api/metis/reporting/route.ts`
- `src/lib/metis/accounts.ts`
- `src/lib/metis/reporting.ts`
- `src/lib/metis/tone.ts`
- `src/lib/metis/types.ts`
- `scripts/pocs/lib/meta-client.mjs`
- `scripts/pocs/lib/reporting.mjs`
- `vercel.json`
- `.vercel/project.json`

Important context:
- The production reporting direction is the standalone `/reporting` route, not the old `/app` reporting section.
- The old `/app` reporting surfaces still exist in the same repo, but they are not the primary product direction.
- The user enters a Meta access token on the first screen.
- The tool should generate fact-grounded summaries that sound much closer to how the user has historically reported to clients or teams.
- The current `/reporting` product already includes:
  - panel-level waiting state overlays
  - pasted or uploaded tone-context input
  - circular final-message copy action
- Do not execute automatically after your review.

After reviewing, briefly confirm:
1. that you understand the current standalone reporting architecture
2. what files are most relevant to the requested task
3. what you plan to change

Then wait for explicit user permission before executing.
```

## Update — 2026-06-22

The shared `<ReportingStudio>` component shape changed during the 2026-06-21
and 2026-06-22 sessions but the **API contract is unchanged**:

- `POST /api/metis/reporting` still accepts `{ accountId, dateStart, dateEnd, toneExamples, accessToken? | connectionId? }`.
- `POST /api/metis/accounts` still accepts `{ accessToken? | connectionId? }`.
- The standalone `/reporting` route still uses the token-paste flow, the
  shared studio, and never persists user-scoped data.

What changed (UI only — `src/lib/metis/*` untouched):

- The form is now a **collapsing wizard**: inputs are tall before a run,
  collapse to a summary chip + dropdown menu after.
- A new brand-matched `<DateRangePicker>` replaced the two native date inputs.
- The tone-context block is one unified drop-zone (textarea + file chips +
  `Use preset ▾` dropdown on the authed flow, paste/upload only on the
  public flow).
- The output region is currently in an A/B between tabs and inline-disclosure
  variants; once the user picks, the loser will be deleted.
- The authed flow at `/app/reports` adds DB-backed tone presets via
  `meta_tone_sources` (Round 6, `supabase/0008_meta_tone_sources.sql`).

If you're touching the studio, start at
[src/components/reporting-studio.tsx](src/components/reporting-studio.tsx) —
the surface that owns all of the above.

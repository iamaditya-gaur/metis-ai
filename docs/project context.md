# Metis AI Context Plan

## Project

- Name: `Metis AI`
- Repo: `https://github.com/iamaditya-gaur/metis-ai`
- Local path: `/Users/adi/my-weekender-project`
- Live URL: `https://metis-ai-nine.vercel.app`
- Current date context: `2026-04-25` '12:40 AM'

## User Context

- User is a beginner with near-zero terminal experience.
- User prefers step-by-step execution, minimal assumptions, and short clear explanations.
- User wants no bonus work, no batching, and pauses whenever browser clicks, passwords, auth, or manual input are required.
- User is vibe-coding an AI Weekender project and wants high output quality with low operational friction.
- User wants this file kept current so a new agent can resume quickly without rebuilding context from scratch.

## Working Style To Continue

- Proceed in small, explicit steps.
- Explain commands briefly before running them.
- Stop if a command fails and inspect the actual error instead of improvising.
- Keep secrets out of GitHub and chat.
- Prefer doing the work directly instead of over-explaining.
- For larger features: inspect codebase first, then make a short plan, then implement, then verify.
- For non-trivial work: scope first, then POC, then build.

## What Has Been Built So Far

- A custom waitlist landing page has been built in Next.js.
- The landing page is live on Vercel.
- Supabase-backed email capture is implemented and working.
- The current repo still mainly contains the waitlist product shell, not the MaaS app yet.

Waitlist implementation already added:

- hero section
- product explanation sections
- bottom CTA
- waitlist signup form
- Next.js API route for waitlist submissions
- Supabase admin helper
- SQL schema for waitlist emails
- local env example
- Vercel framework config fix

## Current Product Direction

- Product: `Metis AI`
- Category: multi-agent / Meta ads workflow product
- Primary hackathon track: `MaaS`
- Positioning: an AI ops team for Meta ads, not a generic chatbot

Original mind-map scope:

- `Builder`
  - Inputs: brand website URL, objective, level of campaign support needed
  - Outputs: brand analysis, copy, campaign strategy
- `Reporting`
  - Inputs: date range, prior messages / tone examples
  - Output: summary report

Refined weekend MVP direction now agreed:

1. Reporting
   - read real Meta ad account data
   - generate a useful performance summary
   - send it to Slack
2. Builder
   - analyze a brand website
   - generate strategy and copy
   - create paused Meta draft objects only

## Major Decisions Now Locked

### Agent count

Use exactly `4` agents:

1. `Manager / Ops Lead Agent`
2. `Brand Strategist Agent`
3. `Campaign Strategist / Copywriter Agent`
4. `Reporting Analyst Agent`

Meta execution and Slack delivery are deterministic tools, not agents.

### Safety rule

Weekend MVP must not make live changes to active client accounts.

Allowed:

- read Meta account/campaign/ad set/ad/creative/insights data
- create new paused draft objects only
- send Slack messages
- store logs, traces, and outputs

Blocked:

- no updates to existing active campaigns
- no budget increases
- no status changes to `ACTIVE`
- no deleting or replacing existing Meta objects
- no autonomous live optimization
- no audience upload unless separately scoped and verified

All created draft objects should be clearly prefixed:

```text
[AIW-DRAFT] Metis AI
```

### Token / auth decision for weekend MVP

- Use the already-generated long-lived Meta user token for the MVP.
- Use the token to fetch accessible ad accounts so the user can choose which account to operate on.
- Do not hardcode a single ad account ID in the code.
- Prefer server-side env-var storage for the main demo path.
- Do not log, persist, or expose the token.

Production direction later:

- move to proper Meta OAuth and/or system-user flows
- add encrypted token storage, RBAC, and revocation handling

### Output surfaces for judging

The weekend MVP should land outputs on real surfaces:

- Slack for reporting summaries and failure alerts
- Meta ad account for paused draft campaign objects
- internal observability UI for run traces and debugging

## Recommended Stack Going Forward

Already decided and present:

- Frontend: `Next.js + TypeScript`
- Hosting: `Vercel`
- Database: `Supabase / Postgres`

Recommended additions for the MaaS MVP:

- Agent orchestration: `CrewAI`
- LLM provider: `OpenAI`
- Observability: `Langfuse`
- Run/state persistence: `Supabase`
- Slack delivery: incoming webhook
- Meta integration: Meta Marketing API

Important deployment reality:

- Keep Vercel as the user-facing app host.
- The POC can be backend-only and local first.
- If CrewAI deployment becomes the weekend blocker, preserve the same 4-agent architecture and structured handoffs, but execute with server-side TypeScript orchestration as a fallback. This fallback is for shipping pressure only, not the preferred long-term direction.

## Why These Choices Were Made

- `4 agents` keeps the system understandable, scorable for MaaS, and realistic to ship by Saturday.
- `Langfuse` was chosen because the rubric is capability-based and Langfuse is the quickest path to strong trace visibility for this deadline.
- `Supabase` remains the durable source of truth because agent-only memory is not enough for a real app.
- `Paused drafts only` gives real Meta output without risking live client spend.
- `Account selection from token` is better than hardcoding one ad account and better matches the intended product shape.

## MaaS Rubric Strategy

The biggest scoring levers are:

- `Working product shipping real output`
- `Observability`
- `Agent org structure`
- `Evaluation and iteration`

The current product strategy is designed to maximize those first.

Target scoring posture:

- Real output: `L4`, stretch `L5`
- Agent org structure: `L4`
- Observability: `L4`
- Evaluation and iteration: `L3`, stretch `L4`
- Agent handoffs and memory: `L4`
- Cost and latency: `L3`
- Management UI: `L3`

This means the build should prioritize:

- real Slack output
- real paused Meta draft output
- clear manager + specialist structure
- visible traces and logs
- named eval cases

## Memory And Handoffs Direction

Use three memory layers:

1. Working memory
   - current run state
   - selected account
   - inputs
   - intermediate outputs
2. Episodic memory
   - prior reports
   - prior builder runs
   - prior failures/resolutions
3. Semantic memory
   - KPI definitions
   - safety rules
   - naming conventions
   - team norms

Handoffs between agents should be structured objects, not loose prose.

Examples:

- `RunContext`
- `AccountContext`
- `BrandBrief`
- `CampaignPlan`
- `CopyPack`
- `DraftLaunchSpec`
- `ReportSummary`

## Meta API Feasibility Boundary

What is considered realistic for the weekend MVP:

- fetch accessible ad accounts for the token user
- read campaigns, ad sets, ads, creatives, and insights
- pull date-range reporting data
- generate reporting summaries
- generate brand brief + strategy + copy
- create paused draft campaign objects if required assets/permissions exist

Known limits/risk areas:

- access is limited to what the token user can actually access
- some client account actions may depend on Meta app permissions / advanced access
- campaign creation may require specific assets like page, IG account, pixel, or conversions depending on setup
- audience automation is not part of the current weekend MVP
- live optimization is explicitly out of scope

## Key Documents Created So Far

- Waitlist implementation context:
  - `README.md`
  - `docs/superpowers/plans/2026-04-23-meta-ads-agent-waitlist.md`
- MaaS scoping doc:
  - `docs/superpowers/plans/2026-04-25-metis-ai-maas-scope.md`
- Build/process notes:
  - `docs/build process.md`
  - `handbook/09-scoring.md`

The scoping doc is now the main decision document for the MaaS MVP.

Recent additions:

- the MaaS scope doc now includes user stories and a realistic live flow chart
- `docs/sub-agents/` now exists for subagent research summaries
- current saved subagent summaries:
  - `docs/sub-agents/meta-tools-summary.md`
  - `docs/sub-agents/slack-tools-summary.md`
  - `docs/sub-agents/brand-research-summary.md`

## Important Existing Repo Files

- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/hero.tsx`
- `src/components/feature-sections.tsx`
- `src/components/final-cta.tsx`
- `src/components/waitlist-form.tsx`
- `src/app/api/waitlist/route.ts`
- `src/lib/supabase/admin.ts`
- `supabase/waitlist.sql`
- `.env.local.example`
- `README.md`
- `vercel.json`

New planning file added:

- `docs/superpowers/plans/2026-04-25-metis-ai-maas-scope.md`

## Infra / Deployment Status

### Supabase

- Supabase project was created manually by the user.
- Waitlist SQL was run successfully.
- Local `.env.local` was created manually by the user with:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Local signup test worked.
- Production env vars were added into Vercel.
- Secrets must remain out of Git and chat.

### GitHub / Vercel

- Git repo initialized locally.
- Public GitHub repo created and pushed successfully.
- Vercel project created and linked.
- Initial Vercel framework/SSO issues were fixed.
- Current live waitlist site works.

## Current State Right Now

- Waitlist app exists and works.
- MaaS product direction is now clearly defined.
- The 4-agent architecture is locked.
- The safety boundary is locked.
- The observability direction is locked: `Langfuse + Supabase`.
- The next step is not full product build.
- The next step is a small POC to validate the riskiest assumptions.

## Next Step: POC

The next agent/session should start by creating and then executing a small POC plan.

The POC should validate these assumptions first:

1. The Meta token can list accessible ad accounts.
2. A selected account can return useful insights for a date range.
3. A brand URL can be fetched and converted into a useful brief.
4. The reporting flow can generate a good Slack-ready summary.
5. The builder flow can generate a structured campaign plan and copy pack.
6. Paused draft creation is actually possible on the chosen test account without touching live campaigns.
7. Langfuse can capture at least one multi-agent trace.
8. Supabase can store run, step, tool-call, and artifact records for the POC.

POC should be backend-first:

- small scripts or minimal routes
- no polished UI first
- prove the brain and integrations first

## Recommended Continuation Pattern

When continuing in a new agent/session:

1. Read:
   - `README.md`
   - this file
   - `docs/superpowers/plans/2026-04-25-metis-ai-maas-scope.md`
   - the current `src/` files
2. Summarize current state in 5-8 lines.
3. Do not revisit already-locked decisions unless a real blocker appears.
4. Read any relevant files in `docs/sub-agents/` before re-researching tool choices.
5. Create the tiny POC plan.
6. Execute the POC step by step.
7. Feed POC learnings back into the context and scope docs before full build.

## Suggested Prompt To Resume In Another Agent

`Read README.md, docs/project context.md, docs/superpowers/plans/2026-04-25-metis-ai-maas-scope.md, and any relevant files under docs/sub-agents/. Inspect the current codebase before doing anything. Continue step by step in the same style. Do the tiny POC first, not the full build. Keep the locked decisions unless a real blocker appears.`

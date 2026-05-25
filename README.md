# Metis AI

Client-ready Meta Ads reporting in the operator's actual voice. Grounded in real performance data. Inspectable end-to-end.

On my own client work, this cuts roughly **45 minutes of weekly reporting and an hour of monthly reporting.**

## Try It

- **Reporting flow** — [metis-ai-nine.vercel.app/reporting](https://metis-ai-nine.vercel.app/reporting)
- **Admin trace UI** (gated) — [metis-ai-nine.vercel.app/admin/runs](https://metis-ai-nine.vercel.app/admin/runs)

Paste a Meta access token, pick an ad account, run a real report.

## The Problem

Most Meta reporting tools break in one of two ways:

- Factually correct, but stiff and generic. The operator rewrites it before sending.
- Sounds human, but invents tone, structure, or claims the data doesn't support.

Either way, the last mile happens manually in Slack, docs, or WhatsApp.

> Reporting isn't finished when the numbers are correct. It's finished when the update is ready to send.

That last mile is what Metis automates.

## What It Does

- Pulls live Meta Ads insights for the account and window you pick
- Builds a factual operator view: spend, key metric movements, what changed, risks, next actions
- Learns voice from past client messages you upload (`.txt` / `.md`)
- Produces a client-ready message that sounds like the author of those messages — and posts to Slack if a webhook is set

About 10 seconds end to end.

## How The Agents Work Together

```
[ Meta Ads API ]
       │
       ▼
[ Insights snapshot ]
       │
       ▼
[ Factual report ]  ── LLM 1
       │
       ▼
[ Tone profile from your examples ]  ── LLM 2
       │
       ▼
[ Compose client message ]  ── LLM 3 (writes from facts + examples)
       │
       ├─► Voice judge (LLM)  ─┐
       └─► Fact judge (LLM)    ├─► one regen if either flags
           + regex fact-check ─┘
       │
       ▼
[ Slack delivery + run captured to Supabase ]
       │
       ▼
[ /admin/runs trace tree ]
```

Two things to know about the back-and-forth:

- The compose step does **not** rewrite the factual report. It reads facts + your examples and writes a fresh message. Anchoring on a pre-written draft is what kept earlier versions sounding corporate.
- Two judges run in parallel after the first compose. If either flags an issue, one regen runs with the specific mismatches as feedback. Cost-gated — happy path is one cheap judge call per run.

### What I Tightened Recently

- Three-tier activity attribution. Operator edits get first-person verbiage, automation rules get neutral passive, and noise from Shopify Audiences / pixel events / ASA gets filtered out before it reaches the LLM.
- Deterministic objective-aware metric selection. ROAS / AOV only surface on `OUTCOME_SALES` campaigns. Impressions / reach are blocked from primary on conversion objectives unless your examples explicitly mention them.
- Direction-flip fact check. Regex sweep over UP/DOWN, PAUSE/RESUME, CREATE/DELETE pairs catches the failure mode where the model flips a verb. If violations survive one regen, the run falls back to the operator-view message rather than ship a wrong claim.
- Every LLM call captured durably — model picked (including fallback chain), prompts, raw response, tokens, cost, latency. Persisted to Postgres, viewable as a trace tree at `/admin/runs`.

## Stack

- Next.js 16 / TypeScript / Tailwind on Vercel
- OpenRouter as the LLM gateway with multi-model fallback (Claude Sonnet → GPT family)
- Supabase Postgres for run persistence
- Meta Graph API v25 for insights + change history
- Slack webhook for delivery

No LangChain, no vector DB, no MCP runtime, no agent framework. Just a deterministic pipeline of small, tight LLM calls each given a focused job.

## Known Limits

- No persistent memory across runs yet. Within-run context works well.
- No user authentication yet. Reporting is open; admin trace UI is the only gated surface.
- Voice judge threshold is hand-tuned (7/10). Needs an eval set to train from outcomes.
- Reporting eval script exists but isn't wired into CI.
- Builder mode (`/builder`, paused-draft creation) is functional but less polished than reporting.

## Upcoming

- Email delivery (alongside Slack)
- Workflow automation — scheduled and event-triggered runs without manual kickoff
- Multi-user authentication with per-user data isolation
- State management for a smoother UX across the reporting flow
- Design and interface polish

## Recently Shipped

- **2026-05-25 — Tone fidelity + fact guardrails.** Compose decoupled from the factual draft, voice + fact judges in parallel, deterministic direction-flip checks, objective-aware metric selection. [PR #1](https://github.com/iamaditya-gaur/metis-ai/pull/1)
- **2026-04-26 — Observability v1.** Per-LLM-call tokens / cost / latency / fallback chain, Supabase persistence, `/admin/runs` trace UI behind an HMAC-signed cookie gate. [PR #2](https://github.com/iamaditya-gaur/metis-ai/pull/2) · [PR #3](https://github.com/iamaditya-gaur/metis-ai/pull/3)
- **2026-04-22 — Initial reporting + builder POC.** Real Meta data → factual report → client-style message → Slack.

Full history in [`CHANGELOG.md`](CHANGELOG.md). The next thing I'm picking up is [Supabase Branching](docs/handoff/supabase-branching.md) so preview deploys stop sharing the production database.

## Context

Originally built as a submission to the **GrowthX AI Buildathon (MaaS track)**. Full rubric posture in [`docs/maas-context.md`](docs/maas-context.md).

If you're a builder, hiring manager, or fellow PM and want to talk through the decisions — reach me via [my GitHub profile](https://github.com/iamaditya-gaur).

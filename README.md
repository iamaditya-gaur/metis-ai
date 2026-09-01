# Metis AI ✨

Hey there. Metis is what I built instead of manually rewriting my Meta Ads reports in Slack every Friday. It pulls live data, writes a factual operator view, and then rewrites that into a client message that actually sounds like *you*.

On my own client work it saves me roughly **45 minutes a week and an hour every month.** Small, but every weekend back is worth it.

## Try It

- **Production App:** [metis-ai-nine.vercel.app](https://metis-ai-nine.vercel.app)
- **Admin trace UI** (gated): [metis-ai-nine.vercel.app/admin/runs](https://metis-ai-nine.vercel.app/admin/runs)

Paste a Meta access token, pick an ad account, run a real report.

## The Problem 🤔

Most Meta reporting tools break in one of two ways:

- Factually correct, but stiff and generic. You end up rewriting it before sending.
- Sounds human, but invents tone, structure, or claims the data doesn't actually back.

Either way the last mile happens manually, in Slack or docs or WhatsApp.

> Reporting isn't finished when the numbers are correct. It's finished when the update is ready to send.

That last mile is what Metis is built to automate.

## What It Does

- Pulls live Meta Ads insights for the account and window you pick
- Builds a factual operator view: spend, key metric movements, what changed, risks, suggested next actions
- Learns voice from past client messages you upload (`.txt` or `.md`)
- Produces a client-ready message that sounds like the author of those examples; signed-in runs can post it to Slack when a webhook is set

About 10 seconds end to end.

## How The Agents Work Together 🧩

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
       └─► Fact judge (LLM)    ├─► one regen if either flags an issue
           + regex fact-check ─┘
       │
       ▼
[ Slack delivery + run captured to Supabase ]
       │
       ▼
[ /admin/runs trace tree ]
```

Two things worth knowing about the back-and-forth:

- The compose step does **not** rewrite the factual report. It reads facts plus your examples and writes a fresh message. Anchoring on a pre-written draft is what kept earlier versions sounding corporate.
- Two judges run in parallel after the first compose. If either flags something, one regen runs with the specific mismatches as feedback, then the rewritten text is judged again. The happy path stays bounded to one voice check and one fact check.

Current defaults remain GPT-5.4 Mini for the factual summary and judges, with Claude Sonnet 4.6 for tone extraction and the client message. A monthly test of newer models did not pass the final voice and fact checks, so those models were not promoted. Every step remains environment-configurable for future controlled tests.

### What I Tightened Recently

- **Three-tier activity attribution.** Operator edits get first-person verbiage, automation rules get neutral passive, and noise from Shopify Audiences, pixel events, and ASA gets filtered out before it reaches the LLM.
- **Deterministic objective-aware metric selection.** ROAS and AOV only surface on `OUTCOME_SALES` campaigns. Impressions and reach get blocked from primary on conversion objectives unless your examples explicitly mention them.
- **Direction-flip fact check.** A regex sweep over UP / DOWN, PAUSE / RESUME, CREATE / DELETE pairs catches the failure mode where the model flips a verb. If violations survive one regen, the run falls back to the operator-view message rather than ship a wrong claim.
- **Every LLM call captured durably.** Model picked (including the fallback chain), prompts, raw response, tokens, cost, latency. Persisted to Postgres, viewable as a trace tree at `/admin/runs`.
- **Selected-account recipient guard.** The final greeting uses the account name returned by Meta, not a name inferred from campaign data or old tone examples. A deterministic final check repairs a missing or wrong greeting before delivery.
- **Anonymous delivery guard.** The public reporting demo can generate an on-screen result, but only signed-in runs may post to the configured Slack webhook.
- **Private setup metadata.** Public health checks return one ready/not-ready value. Detailed setup status requires the signed admin cookie, and Meta accounts load only from a caller-supplied or signed-in saved connection.
- **Bounded structured-response retry.** Signed-in and evaluation calls retry empty, malformed, or incomplete JSON once. Anonymous shared-key calls do not retry unless explicitly enabled. All billable attempts remain attached to usage records.

## Stack 🛠️

- Next.js 16, TypeScript, Tailwind on Vercel
- OpenRouter as the LLM gateway with multi-model fallback (Claude Sonnet, GPT family)
- Supabase Postgres for run persistence
- Meta Graph API v25 for insights and change history
- Slack webhook for delivery

No LangChain, no vector DB, no MCP runtime, no agent framework. Just a deterministic pipeline of small, tight LLM calls, each given a focused job.

## Security And Privacy

- API keys and Meta tokens come from encrypted user storage or environment variables; they are never committed or included in generated text.
- Raw prompts and responses are confidential run data stored behind the app's access controls, not in this public repository.
- Evaluation fixtures, tone examples, outputs, and cost ledgers stay in the Git-ignored `.private-evals/` directory. Public tests use generic account names only.

## Known Limits

Being honest about what's still rough:

- The public `/reporting` demo intentionally keeps token-paste access; `/app/reports` is authenticated.
- The anonymous demo still needs a platform-level request quota before this branch can be broadly promoted.
- The model evaluation covers one account and two August windows. Broader account and season coverage is still needed before automated model promotion.
- Private reporting evals remain manual because real fixtures never enter Git; public tests, lint, build, audit, and dependency review now run on pull requests.
- The build is clean, but Next.js now warns that its `middleware` filename will need migration to `proxy` in a future release.
- Builder mode (`/builder`, paused-draft creation) is functional but less polished than reporting.

## Upcoming

- Email delivery (alongside Slack)
- Workflow automation, scheduled and event-triggered runs without manual kickoff
- State management for a smoother UX across the reporting flow
- Design and interface polish
- Per-user tone-preset management UI (uploads auto-save; explicit save/rename for pasted text is next)
- Mobile drawer focus-trap and collapsed-sidebar tooltip upgrade
- Wire `npm run lint` + `npm run build` checks into CI on PRs

## Recently Shipped

- **2026-07-18, Bring your own AI key (BYOK).** Signed-in users connect their own OpenRouter (one-click OAuth) or OpenAI (paste) key in Settings — authed reports then run on *their* key instead of the shared app key. Keys are AES-256-GCM encrypted at rest and RLS-scoped to the owner, with only the last four shown; no connected key means a friendly prompt, never a silent fallback to the app's key. The open `/reporting` demo still uses the app key. New `llm_keys` table (migration `0010`).
- **2026-06-22, History tab polish + session wrap-up.** Sort + per-row delete on `/app/history`, client-style message hero on each run detail with a copy button, top-left "← History" chevron back nav. Lint and build green; ~200 lines of orphan CSS pruned.
- **2026-06-22, Production landing page + auth-aware nav.** `/` is now a real landing page (the waitlist form is gone — the historical signups stay in the DB). Top nav switches between *Sign in / Get started* and *Open app* depending on the Supabase session.
- **2026-06-21, Reporting studio rehaul.** Collapsing-wizard input form, brand-matched date-range picker with presets and viewport-aware flip, unified tone-context drop-zone with DB-backed *Use preset* history (`meta_tone_sources` table), output tab / inline-disclosure A/B, conventional hamburger sidebar toggle, sentence-case eyebrows. Reporting brain (`src/lib/metis/*`) untouched.
- **2026-06-21, Auth foundation + saved Meta connections.** Supabase Auth via `@supabase/ssr` with cookie sessions and RLS scoped by `auth.uid()`. Encrypted Meta tokens stored in `meta_connections` (AES-256-GCM). Authed reporting flow at `/app/reports` uses saved connections instead of re-pasting tokens every run.
- **2026-05-25, Tone fidelity + fact guardrails.** Compose decoupled from the factual draft, voice and fact judges in parallel, deterministic direction-flip checks, objective-aware metric selection. [PR #1](https://github.com/iamaditya-gaur/metis-ai/pull/1)
- **2026-04-26, Observability v1.** Per-LLM-call tokens, cost, latency, fallback chain captured. Supabase persistence, `/admin/runs` trace UI behind an HMAC-signed cookie gate. [PR #2](https://github.com/iamaditya-gaur/metis-ai/pull/2) · [PR #3](https://github.com/iamaditya-gaur/metis-ai/pull/3)
- **2026-04-22, Initial reporting + builder POC.** Real Meta data, factual report, client-style message, Slack.

Full history in [`CHANGELOG.md`](CHANGELOG.md). The next thing I'm picking up is [Supabase Branching](docs/handoff/supabase-branching.md) so preview deploys stop sharing the production database.

## Say Hi 👋

If something in here looks fun, broken, useful, or worth a chat, drop me a line. Could be an idea, a question, a war story about your own reporting workflow, or just to catch up. Always happy to talk.

Reach me through [my GitHub profile](https://github.com/iamaditya-gaur).

---

*Originally built as a submission to the GrowthX AI Buildathon (MaaS track). Full rubric posture lives in [`docs/maas-context.md`](docs/maas-context.md).*

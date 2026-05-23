# Metis AI

Client-ready Meta Ads reporting in the operator's actual voice. Grounded in real performance data. Inspectable end-to-end.

**On my own client work, this automated roughly 45 minutes of weekly reporting and an hour of monthly reporting.**

**Try it:** [metis-ai-nine.vercel.app/reporting](https://metis-ai-nine.vercel.app/reporting) — paste a Meta access token, pick an account, run a real report.

---

## The Problem

Media buyers and lean agencies don't struggle to see metrics inside Meta. They struggle to turn those metrics into a clean, client-ready update fast.

Most reporting tools break in one of two ways:

- The report is factually accurate, but stiff and generic. The operator still rewrites it manually before sending.
- The report sounds human, but invents tone, structure, or claims the data doesn't actually support.

Either way, the operator ends up doing the cleanup in Slack, docs, or WhatsApp before anything goes out.

**Reporting isn't finished when the numbers are correct. It's finished when the update is ready to send.** That last mile is the work Metis is built to automate.

---

## What It Does

Open `/reporting`. Paste a Meta access token. Pick an ad account and date range. Optionally upload one or more past client messages (`.txt` / `.md`) — these become the tone context.

In about 10 seconds you get back:

- **Operator view** — factual breakdown: spend, key metric movements, what changed, risks, suggested next actions.
- **Client message** — the same content rewritten to sound like the author of your uploaded examples. Matches their sentence rhythm, opener style, numeric formatting, which metrics they typically mention, and whether they typically reference campaign changes made during the period.

Copy the client message, or have it auto-posted to Slack if `SLACK_WEBHOOK_URL` is configured.

---

## How It Works

```
[ Meta Ads API ]
       │
       ▼
[ Insights snapshot ] ──────────────────┐
       │                                │
       ▼                                │
[ Factual report ] ── LLM 1             │
       │                                │ run log
       ▼                                │ (every
[ Tone profile from examples ] ── LLM 2 │  LLM call,
       │                                │  prompts,
       ▼                                │  response,
[ Client-style rewrite ] ── LLM 3       │  tokens,
       │                                │  cost,
       ▼                                │  latency)
[ Optional Slack delivery ]             │
                                        ▼
                              [ Supabase metis_runs ]
                                        │
                                        ▼
                          [ Admin observability UI ]
                              /admin/runs (gated)
```

Three things make this more than a prompt wrapper:

1. **Tone adaptation is grounded, not creative.** A tone profile is extracted from the user's examples (greeting style, sentence rhythm, which metrics they mention, whether they reference campaign changes). The compose step writes only from facts in the Meta snapshot, formatted in the user's numeric idiom, mentioning only the metrics that appear in their voice signature.

2. **A judge LLM grades voice match.** If the first draft scores below threshold, one regeneration runs with the specific mismatches as feedback. Cost-gated — the happy path is one cheap judge call per run, not unconditional retries.

3. **Every LLM call is captured durably.** Model picked (including fallback chain), system prompt, user message, raw response, tokens, cost, latency. Persisted to Supabase, viewable as a trace tree at `/admin/runs`. Debugging "why did the model produce *this*" stays possible weeks after the run.

---

## Decisions and Tradeoffs

The product calls behind the code:

**Soft preference for metric selection, not a hard filter.** When the tone profile shows the user typically mentions spend and results, the compose model gets `<METRICS_PRIMARY>` (those) and `<METRICS_OPTIONAL>` (everything else: impressions, CPC, reach, frequency). The model uses primary freely and reaches into optional only when the narrative requires it. A hard filter would strip facts the user occasionally *does* need to reference. Soft preference plus a density target ("don't exceed the user's typical metric count by more than one") keeps the rhythm honest without losing the safety net.

**Cost-gated critique loop instead of always-regenerate.** A naive build regenerates on every run. That doubles cost. The judge LLM is a small cheap model that scores the first draft 0–10; only a score below 7 triggers a regen. Worst case is 2× tone latency; happy path is one extra small judge call. The judge's mismatch list is captured, so the threshold can be tuned from real data later.

**Direct fetch to OpenRouter, not a proxy gateway.** Most LLM observability platforms ship as proxies you route through. That adds latency and creates migration friction. Instead the OpenRouter call stays direct, and I capture the usage block from the response inline. Same data, no third-party hop. The data goes to my own Postgres table — if I outgrow this surface I can layer a vendor in; if the vendor disappears I keep my data.

**In-app observability before adopting a vendor.** I evaluated Langfuse, Helicone, Phoenix, LangSmith, and Braintrust. Each solves the polished-UI problem but adds vendor risk and free-tier ceilings. I built `/admin/runs` myself first — half a day of work, zero lock-in, every signal I'd want from a vendor. If after a few weeks of using it I find myself wishing for cross-run search or shareable links, that's the signal to add Langfuse as a second sink. Not before.

**Admin gate now, user auth later.** The trace inspection surface is locked behind a password and a signed-cookie middleware. The user-facing reporting route stays open because the model needs a user-supplied Meta token anyway, so there's no leak surface there. The auth helper is abstracted into a single function — swapping it to Supabase Auth plus an admin allowlist won't require middleware, routes, or UI changes.

**The shared-database risk is acknowledged, not solved.** Preview deployments currently share the production Supabase project. Documented honestly in [`docs/handoff/supabase-branching.md`](docs/handoff/supabase-branching.md) as the next priority, with a concrete playbook. Branching is the proper fix, and it's the next thing I'm picking up.

---

## Recently Shipped

- **Phase 1 + 2 — Tone fidelity.** Rebuilt the voice prompt from scratch. Examples now passed as labeled exemplars instead of bare JSON. Voice extracted from up to 8 samples. Judge LLM grades each draft and triggers a regen only when below threshold. Content vocabulary extracted to filter metric selection. Meta `/activities` endpoint integrated so campaign changes the user actually made during the period can be woven in. ([PR #1](https://github.com/iamaditya-gaur/metis-ai/pull/1) — separate review track)

- **Phase 3 + 4 — Observability.** Captured per-LLM-call tokens, cost, latency, fallback chain, raw prompts and responses. Persisted to Supabase, replacing the prior `/tmp/.jsonl` writes that were getting wiped between Vercel cold starts. Built `/admin/runs` (filtered list) and `/admin/runs/[runId]` (full trace tree) with a signed-cookie admin gate. ([PR #2](https://github.com/iamaditya-gaur/metis-ai/pull/2), [PR #3](https://github.com/iamaditya-gaur/metis-ai/pull/3))

---

## Known Limits

Honest about the current state:

- **No persistent memory across runs.** Within-run context works well. The system doesn't yet learn "this client prefers X" or "this account always uses Y reporting cadence."
- **No user authentication.** Designed-for, not built-yet. The admin gate is the first auth surface; user auth comes after Supabase Branching closes the data-isolation gap first.
- **Voice judge threshold is hand-tuned.** Default is 7/10 for triggering a regen. With more runs I'd train this from outcomes instead of guessing.
- **No eval CI yet.** A reporting eval script exists; it isn't wired into the merge flow.
- **Builder mode is minimal.** The other surface (`/builder` for paused-draft campaign creation) is functional but less polished than the reporting flow — reporting got the recent investment.

---

## What's Next

In priority order:

1. **Supabase Branching** — close the shared-DB risk before doing anything multi-user. [Handoff doc ready](docs/handoff/supabase-branching.md).
2. **User authentication** — Supabase Auth plus an admin allowlist. The admin-gate helper is already abstracted for this swap (`src/lib/auth/admin-gate.ts`).
3. **Per-account persistent memory** — store voice profile and recurring preferences per Meta account, so the operator doesn't re-upload examples every cycle.
4. **Reporting eval loop in CI** — gate merges on regression checks against canned `(snapshot, examples)` pairs.
5. **Polish the builder flow** to match the reporting one.

---

## Tech Stack

Next.js 16 / TypeScript / Tailwind on Vercel. OpenRouter as the LLM gateway with multi-model fallback (Claude Sonnet → GPT-5 family). Supabase Postgres for run persistence. Meta Graph API v25 for ad insights and change history. Slack webhook for delivery.

No vector DB. No LangChain. No MCP runtime. No agent framework. Just a deterministic pipeline of small, tight LLM calls each given a focused job. Easier to reason about, debug, and improve than a generic agent loop.

---

## Code Worth Reading

If you want to see how the interesting bits work:

- [`src/lib/metis/tone.ts`](src/lib/metis/tone.ts) — tone profile extraction, voice compose, judge LLM, content vocabulary, raw-prompt capture.
- [`src/lib/metis/reporting.ts`](src/lib/metis/reporting.ts) — the workflow orchestration.
- [`src/lib/observability/queries.ts`](src/lib/observability/queries.ts) — durable run data, filter-aware queries.
- [`src/components/observability/trace-tree.tsx`](src/components/observability/trace-tree.tsx) — the admin trace UI.
- [`src/lib/auth/admin-gate.ts`](src/lib/auth/admin-gate.ts) — HMAC-signed cookie auth, swappable to Supabase Auth without UI changes.

Deeper context lives in [`docs/reporting-context.md`](docs/reporting-context.md) and the [handoff docs](docs/handoff/).

---

## Context

Originally built as a submission to the **GrowthX AI Buildathon (MaaS track)**. The rubric pushed me to think rigorously about agent structure, observability, evals, and management UI — full posture-against-rubric notes in [`docs/maas-context.md`](docs/maas-context.md).

If you're a builder, hiring manager, or fellow PM and want to talk through the decisions, the things that didn't work the first time, or what I'd change about the architecture today — reach me via the GitHub profile.

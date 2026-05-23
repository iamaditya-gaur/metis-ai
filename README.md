# Metis AI

> An AI reporting function for Meta Ads teams. Pulls live performance data, writes a factual operator-style summary, then rewrites it in the user's actual voice using their past messages — and captures every LLM call along the way so the work is inspectable, not opaque.

**Live:** [metis-ai-nine.vercel.app/reporting](https://metis-ai-nine.vercel.app/reporting) — paste a Meta access token to try it on a real account.

**Repo status:** active. Built solo as a portfolio project to explore what an agentic workflow looks like when it's pointed at a specific, ugly, real-world job — not at "generic chatbot."

---

## The wedge

Reporting breaks in one of two places:

- It's factual and accurate, but stiff and generic. Operator still rewrites it manually before sending.
- It sounds human, but starts inventing tone, structure, or claims the data doesn't support. Operator deletes it and starts over.

Most media buyers and lean agencies end up doing the same manual cleanup in Slack, docs, or WhatsApp every reporting cycle. The metrics aren't the bottleneck. **Turning metrics into a clean, client-ready update is the bottleneck.**

Metis closes that gap by keeping the factual layer locked to real performance data, but adapting the *delivery* — voice, structure, metric selection, even references to recent campaign changes — to match how the operator already reports.

---

## What you can actually do today

Go to [`/reporting`](https://metis-ai-nine.vercel.app/reporting):

1. Paste a Meta access token, pick an ad account and date range.
2. Optional but recommended: upload one or more past client messages (`.txt` / `.md`) or paste them inline. This is the "tone context."
3. Run the report. In about 10 seconds you get back:
   - **Operator view** — factual breakdown: spend, key metric movements, what changed, risks, next actions.
   - **Client message** — the same content rewritten to sound like the author of your uploaded examples.
4. Copy the client message, or have it auto-posted to Slack if `SLACK_WEBHOOK_URL` is configured.

---

## What's behind it

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

1. **Tone adaptation is grounded, not creative.** A tone profile is extracted from the user's uploaded examples (greeting style, sentence rhythm, which metrics they typically mention, whether they reference campaign changes). The final message must use only facts from the Meta snapshot, formatted in the user's typical numeric idiom, mentioning only the metrics that appear in their voice signature.

2. **A judge LLM grades voice match.** If the first draft scores below threshold, one regeneration runs with the specific mismatches as feedback. Cost-gated — happy path is one extra cheap judge call per run, not unconditional retries.

3. **Every LLM call is captured durably.** Model picked (including fallback chain), system prompt, user prompt, raw response, tokens, cost, latency. Persisted to Supabase, viewable as a trace tree at `/admin/runs`. Lets me debug "why did the model produce *this*" weeks after the run happened.

---

## Decisions and tradeoffs

The interesting product calls — kept brief:

**Soft preference for metric selection, not hard filter.** When the tone profile says the user typically mentions spend + results, the compose model gets `<METRICS_PRIMARY>` (those) and `<METRICS_OPTIONAL>` (everything else: impressions, CPC, reach, frequency). The model is told to use primary freely and reach into optional only if the narrative requires it. Hard filtering would have stripped away facts that occasionally *do* need to be referenced. Soft preference + density target ("don't exceed the user's typical metric count by more than one") keeps the rhythm honest without losing safety net.

**Cost-gated critique loop.** A naive build would regenerate on every run "just in case." That's 2× the cost on every job. The judge LLM is a small cheap model that grades the first draft 0–10; only score < 7 triggers a regen. Worst case is 2× tone latency; happy path is +1 small judge call. Captured the judge's reasoning so I can tune the threshold from data.

**Direct fetch to OpenRouter, not a proxy.** Most LLM observability platforms ship as proxies you route through. That adds latency and creates migration friction. Instead the OpenRouter call stays direct and I capture the response usage block inline — same data, no third-party gateway hop. The data goes to my own Postgres table. If I outgrow that surface I can add a vendor later; if the vendor goes away I keep my data.

**In-app observability before adding a vendor.** Evaluated Langfuse, Helicone, Phoenix, LangSmith, Braintrust. All of them solve the "polished UI" problem but introduce vendor risk and free-tier ceilings. Decided to build `/admin/runs` myself first — half a day of work, zero lock-in, every signal I'd want from a vendor. If after a few weeks I find myself wishing for cross-run search or shareable links, *that's* the signal to add Langfuse. Not before.

**Admin observability gated, user routes open.** Even pre-auth, the trace inspection surface is locked behind a password and a signed-cookie middleware. Same code structure ready to swap to Supabase Auth + admin allowlist later — no UI rewrites required. The user-facing reporting route stays open because the model needs a Meta access token from the user anyway, so there's no leak surface there.

**Service-role-key blast radius is a known open issue.** When the project gets multi-user, the current "preview deploys share production Supabase" topology becomes a real risk. Logged as the next handoff task ([`docs/handoff/supabase-branching.md`](docs/handoff/supabase-branching.md)) instead of pretending it's fine.

---

## Recently shipped

- **Phase 1+2 (tone fidelity):** rebuilt the voice prompt from scratch — examples passed as labeled exemplars instead of bare JSON, voice extracted from up to 8 samples, a judge LLM grades each draft and triggers a regen only when below threshold, content vocabulary extracted to filter metric selection, Meta `/activities` endpoint integrated so campaign changes the user actually made during the period can be woven in. ([PR #1](https://github.com/iamaditya-gaur/metis-ai/pull/1) — separate review track)

- **Phase 3+4 (observability):** captured per-LLM-call tokens / cost / latency / fallback chain / raw prompts and responses. Persisted to Supabase, replacing the old `/tmp/.jsonl` writes that were getting wiped between Vercel cold starts. Built `/admin/runs` (filtered list) + `/admin/runs/[runId]` (full trace tree) with a signed-cookie admin gate. ([PR #2](https://github.com/iamaditya-gaur/metis-ai/pull/2), [PR #3](https://github.com/iamaditya-gaur/metis-ai/pull/3))

---

## Known limits

Being honest, not modest:

- **No persistent memory across runs.** The system has strong within-run context but doesn't yet learn "this client prefers X" or "this account always uses Y reporting cadence." Memory is the obvious next layer.
- **No user authentication.** Designed-for, not built-yet. The admin gate is the first auth surface; user auth comes after Supabase Branching closes the data-isolation gap first.
- **Voice judge isn't fine-tuned.** The judge is a cheap general-purpose model graded against examples. Works well in practice but the threshold (default 7/10) is hand-tuned, not data-driven. With more runs I'd train this from outcomes.
- **No evaluation CI yet.** A POC eval script exists; it's not wired into the merge flow. Would be a one-day add when the surface stabilizes.
- **Builder mode is minimal.** The other surface (`/builder` for paused-draft campaign creation) is functional but less polished than the reporting flow — reporting got the recent investment.

---

## What's next

The order of next moves, by priority:

1. **Supabase Branching** — close the shared-DB risk before doing anything else multi-user. Handoff doc already written.
2. **User auth** — Supabase Auth + admin allowlist. The admin-gate helper is already abstracted for this swap (`src/lib/auth/admin-gate.ts`).
3. **Per-account persistent memory** — store voice profile + recurring reporting preferences per Meta account, so the operator doesn't re-upload examples every cycle.
4. **Reporting eval loop in CI** — gate merges on regression checks against canned (snapshot, examples) pairs.
5. **Polish the builder flow** to match the reporting one.

---

## Tech stack

Next.js 16 / TypeScript / Tailwind on Vercel.
OpenRouter as the LLM gateway (multi-model fallback: Claude Sonnet → GPT-5 family).
Supabase Postgres for run persistence.
Meta Graph API v25 for ad insights + change history.
Slack webhook for delivery.

No vector DB, no LangChain, no MCP runtime, no agent framework. Just a deterministic pipeline of small specific LLM calls each given a tight job. Easier to reason about, debug, and improve than a generic agent loop.

---

## Poking around

The interesting code lives in:

- [`src/lib/metis/tone.ts`](src/lib/metis/tone.ts) — tone profile extraction, voice compose, judge LLM, content vocabulary, raw-prompt capture.
- [`src/lib/metis/reporting.ts`](src/lib/metis/reporting.ts) — the workflow orchestration.
- [`src/lib/observability/queries.ts`](src/lib/observability/queries.ts) — durable run data.
- [`src/components/observability/trace-tree.tsx`](src/components/observability/trace-tree.tsx) — the admin trace UI.
- [`src/lib/auth/admin-gate.ts`](src/lib/auth/admin-gate.ts) — HMAC-signed cookie auth, swappable to Supabase Auth without UI changes.

For deeper context on a specific area:

- [`docs/reporting-context.md`](docs/reporting-context.md) — original product context for the reporting flow.
- [`docs/handoff/supabase-branching.md`](docs/handoff/supabase-branching.md) — next agent's handoff for closing the multi-tenant data isolation gap.

---

## Why I built this

I'm a product manager building this on the side. The thesis: as more PMs ship their own working software, the meaningful differentiation isn't "I used an AI tool" — it's *what specific real-world workflow did you understand well enough to automate properly.* This project is my attempt to pick one ugly, deeply manual workflow (client reporting in lean media-buying teams) and build something that closes the last mile, not the easy middle.

If you're a builder, hiring manager, or fellow PM — happy to walk through the decisions, the things that didn't work the first time, and what I'd change about the architecture today. Reach me via the GitHub profile.

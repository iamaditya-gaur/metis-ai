# research: byok llm keys + meta oauth connect + agent architecture / langchain

**date:** 2026-07-17 · **branch:** `feat/byok-and-meta-oauth` (off `origin/main` @ `ba10f6a`) · **status:** research only, no code changed

three PM questions answered:
1. per-user llm keys (byok) — see below
2. one-click meta connect — see below
3. current agent structure + is langchain/langgraph worth adopting — see final section

---

## 1. byok — users bring their own ai key

### today

one `OPENROUTER_API_KEY` env var in vercel. every user's report burns the app owner's credits. the key is read deep in the reporting engine (`scripts/pocs/lib/llm.mjs:61` and `scripts/pocs/lib/reporting.mjs:334`), surfaced in `src/lib/metis/env.ts` readiness checks and `/api/health`. default model is `openai/gpt-5.4-mini` (an openai model, routed through openrouter).

### recommendation

support **two providers at launch**: openrouter (primary) and openai (direct). openrouter alone already covers "broad use cases" since it proxies openai, anthropic, google, etc. — openai-direct is for users who only have an openai account.

**connect ux differs per provider, and this is the interesting part:**

- **openrouter has a one-click flow.** it officially supports oauth pkce ("proof key for code exchange" — a secure variant of the log-in-with-X pattern). user clicks "connect openrouter", logs in on openrouter's site, approves, and our callback receives a real api key for that user. no copy-paste at all. docs: [oauth pkce guide](https://openrouter.ai/docs/guides/overview/auth/oauth), [code-for-key exchange endpoint](https://openrouter.ai/docs/api/api-reference/o-auth/exchange-auth-code-for-api-key).
- **openai has no such flow.** users must paste a key (create at platform.openai.com). we validate it instantly with a free `GET /v1/models` call before saving — wrong keys get rejected with a clear message.

**storage — reuse what exists.** `src/lib/crypto/token-encryption.ts` (aes-256-gcm, the same lockbox already protecting meta tokens — its own docstring anticipates "user secrets" beyond meta). add one supabase table, e.g. `llm_keys`, mirroring `meta_connections`: `user_id`, `provider` ('openrouter' | 'openai'), `ciphertext/iv/auth_tag`, `label`, `last_validated_at`, rls scoped to `auth.uid()`. show only the last 4 characters after save; delete = hard delete.

**runtime.** both providers speak the same "openai-compatible" api — identical request format, different base url (`https://openrouter.ai/api/v1` vs `https://api.openai.com/v1`). so one code path serves both. model ids need a tiny mapping: openrouter wants `openai/gpt-5.4-mini`, openai-direct wants `gpt-5.4-mini` (drop the prefix).

**key-validity checks.** openrouter: `GET /api/v1/key` returns validity + remaining credits. openai: `GET /v1/models`. run at save time and surface friendly errors at report time (401 → "your key was revoked — reconnect", out-of-credits → say so, don't silently fall back to the app's own key — that's the cost leak we're closing).

**one boundary decision to flag:** the key is read inside `scripts/pocs/lib/*.mjs` — the engine room next to the off-limits `src/lib/metis/*`. byok needs one surgical change there: let the llm call accept a key parameter instead of only reading the env var. small, isolated, but it touches engine-adjacent code, so it needs explicit approval before implementation.

**open product questions (decide before building):**

1. does the app-owner key remain as a fallback (e.g. demo mode / admin), or is a connected key required to generate reports?
2. is byok required for existing users immediately, or grandfathered until they reconnect?

**effort:** ~1–2 days build. no external approvals, no compliance process. risk is low; the encryption and rls patterns already exist in the codebase.

---

## 2. meta connect — replace manual token paste with oauth

### today

user manually generates a meta access token (graph api explorer or their own meta app) and pastes it into `/app/connections` (`src/app/app/connections/actions.ts`). we validate by listing ad accounts, encrypt, store. functional, but a non-starter for non-technical customers.

### the automated flow (what "few button clicks" looks like)

meta's product for this is **[facebook login for business](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business)** — the "log in with facebook" button, tuned for business-data apps:

1. user clicks "connect meta" in metis
2. meta popup: user logs in, sees exactly what we're asking for (read ads data), approves
3. meta redirects back with a one-time code; our server swaps it for an access token
4. we encrypt + store it — same pipeline the pasted token uses today

the flow is configured with a **configuration id** in the meta app dashboard (declares which token type and permissions to request), and the only permission metis needs is **`ads_read`** — read-only insights. we never ask for write access, which keeps review simpler.

### the compliance ladder (the real answer to "how tough is it")

| step | what | cost | time |
|---|---|---|---|
| 1 | meta developer account + business-type app | free | ~1 hour |
| 2 | build oauth flow — works immediately in dev mode for you + invited testers | free | 2–4 days |
| 3 | privacy policy page + data-deletion instructions url (review prerequisites) | free | ~half a day |
| 4 | app review for `ads_read` advanced access | free | ~1–2 weeks |
| 5 | business verification | free | days–weeks |

**step 4 — app review.** meta reviews how the app uses each permission. good news, per [meta's own update effective may 4, 2026](https://developers.meta.com/blog/updates-to-ads-management-standard-access-feature/): screen recordings are **no longer required**, requirements now show directly in the app dashboard, and the tiers got renamed ("standard access" → limited access, "advanced access" → full access, feature renamed "marketing api access tier"). the usage bar to qualify for the full tier also dropped: **500+ marketing api calls in the past 15 days with <15% error rate** (was 1,500). your own dev-mode usage counts toward this — the chicken-and-egg is solvable by just using the product yourself.

**step 5 — business verification.** this is the one genuinely "tough" step for an indie: meta verifies you as a **legal business entity** — business registration certificate, vat/tax number, or utility bill at the business address, varying by country. an individual with no entity at all will get stuck here ([long-standing indie pain point](https://github.com/facebook/facebook-android-sdk/issues/1246)); a sole proprietorship or any registered company works. if there's a real entity behind amplify.xyz, this is the entity to verify.

### what works before approval (important)

with **standard/limited access — granted automatically, no review** — the oauth flow fully works for:
- ad accounts you own or manage
- anyone you add to the meta app with a role (admin / developer / tester)

so early customers can be onboarded as testers while review is pending. per [meta's authorization docs](https://developers.facebook.com/docs/marketing-api/get-started/authorization), dev mode allows unlimited ad accounts at development rate limits.

### token lifetimes (decides whether users must reconnect)

- regular oauth user tokens: short-lived (~1–2 h), exchangeable for **long-lived (~60 days)**, no auto-refresh → users would reconnect every ~2 months.
- facebook login for business also offers **business integration system user (bisu) tokens: "defaults to never expire"** — built exactly for server-side automation like scheduled reports. **recommendation: configure for bisu tokens** so a connection is a one-time act.

### verdict

**feasible for an indie, commonly done, $0 in fees.** realistic end-to-end: ~2–4 weeks, most of it waiting on meta. the de-risked rollout:

- **phase 1 (no meta approval needed):** ship the oauth flow in dev mode; you + testers use it; keep manual token paste as the fallback path. this alone fixes the ux for early users **and** builds the api-call history needed for the access tier.
- **phase 2:** privacy policy + data-deletion url, submit app review + business verification in parallel.
- **phase 3:** approval lands → flip app live → any meta user can connect → retire (or hide) manual paste.

### gotchas

- tokens die if the user changes their facebook password or revokes the app — handle 401s from meta with a "reconnect" prompt, don't crash the report.
- dev-mode api calls are rate-limited harder than live mode.
- app review wants to see the working flow on a live url — production (`metis-ai-nine.vercel.app`) already exists, which helps.

---

---

## 3. current "agent" structure + langchain / langgraph question

### what the reporting engine actually does today (plain english)

metis today is **not a chatbot agent**. it's a **pipeline** — a fixed sequence of steps where the ai plays specific, small roles. one report = one run of the pipeline. the file `src/lib/metis/reporting.ts` (function `runReportingWorkflow`) is the whole conductor.

the steps, in order:

1. **pull the numbers.** call meta ads api → get insights (spend, ctr, cpc, etc.) for the date range. no ai.
2. **pull the campaign changes.** call meta again for the activity log (what the operator paused, edited, launched). no ai.
3. **executive summary (ai call #1).** send the numbers to the llm → structured json back: what happened, what changed, risks, next actions.
4. **tone profile (ai call #2).** send the operator's past writing samples → llm extracts their voice (sentence length, vocabulary, do they use emojis, do they mention "changes", etc.).
5. **compose the client message (ai call #3).** llm rewrites the summary in the operator's voice, referencing the actual campaign changes.
6. **two judges run in parallel:**
   - **voice-judge (ai call #4):** llm compares the new message vs the writing samples → gives a match score, flags mismatches.
   - **fact-judge (ai call #5):** llm compares the new message vs the source numbers → catches hallucinated claims.
7. **deterministic fact-check.** pure code (no ai) scans for direction flips — e.g. if the campaign was paused but the message says "we're pushing it harder", that's a hard fail.
8. **regenerate if needed (ai call #6, optional).** if either judge or the deterministic check complains, re-run compose with the critique attached.
9. **ship it.** save to supabase, optionally post to slack.

so the "agent" shape is: **directed pipeline with two quality judges and one conditional retry loop**. it's smart and rigorous — most llm apps do zero of the checking that metis does — but the *control flow* is fixed. the llm never chooses what step to run next; it just fills specific slots. this matters for the framework question below.

### is this an "agent"?

the industry currently splits llm apps into two shapes:
- **workflow / pipeline** — fixed steps decided by the developer, llm fills slots. easy to test, cheap to run, predictable. **metis is this.**
- **agent** — llm decides at each step what tool to call next, loops until "done". powerful but expensive, harder to reason about, prone to going off the rails.

metis being a pipeline is not a weakness — for a reporting product where correctness matters and cost per run must be predictable, pipeline is the right shape. anthropic's own guidance (["building effective agents"](https://www.anthropic.com/research/building-effective-agents)) is: use workflows unless you can prove you need a full agent.

### will langchain or langgraph make the product stand out?

**short version: no on langchain, and only conditionally yes on langgraph. neither is a "stand out" feature to non-technical audiences — nobody buying a meta ads reporting tool cares what orchestration library is inside. what will actually make you stand out is the sophistication of the *ai product features*, not the framework. more on that below.**

#### langchain — my recommendation: don't touch it

langchain is being **actively removed from production codebases in 2026** by senior teams. the criticism has consolidated:
- ~280 transitive dependencies pulled in on install
- heavy abstractions that hide bugs — stack traces go through 8–15 wrapper layers
- rapid api changes force rewrites
- debugging often requires paying for their separate tracing product (langsmith)

adopting langchain here would be a step backward. **skip.**

#### langgraph — the more respected sibling. plausible fit, but only under specific conditions

langgraph is a different beast: a **state-machine framework**. you declare nodes (steps) and edges (which node runs next, conditionally). it has real strengths that langchain lacks:
- **checkpoints** — a run can pause, be saved, and resumed later
- **human-in-the-loop** — you can pause the graph for a human to approve before continuing
- **time-travel debugging** — replay any past run from any node
- **used in production** at replit, uber, linkedin, gitlab

but three concerns for **this** codebase:

1. **the current pipeline isn't complex enough to earn langgraph.** it's a mostly-linear flow with one conditional loop. rewriting the working typescript in `reporting.ts` into a langgraph node/edge declaration would add complexity and gain almost nothing today.
2. **langgraph.js is downstream of langgraph python** — new features arrive 4–8 weeks late. metis is typescript.
3. **in the typescript world, mastra is now the more idiomatic choice** for this shape of workflow. even replit's flagship agent 3 switched off langgraph to mastra last cycle. if we ever adopt a framework, mastra is the safer bet.

#### when langgraph *would* earn its place — the "capabilities that show sophistication" list

these are the features that would **genuinely differentiate** metis to a technical or business audience — some of which the current pipeline can't cleanly support but langgraph (or mastra) makes easy:

| capability | why it wows | needs a framework? |
|---|---|---|
| **evals dashboard** — track voice-judge + fact-judge scores across every run, show trend lines | proves you're not vibes-driven. rare in this category. | no — already have the data, needs a ui |
| **human-in-the-loop approve** — for the highest-stakes reports, pause and slack a preview to the operator before sending to the client | huge trust unlock, huge sales talking point | **yes** — langgraph/mastra shine here |
| **"agent mode"** — an autonomous version that decides which cuts to analyze (by campaign? by audience? by creative?) instead of a fixed template | this IS a genuine agent, and would be sold as such | **yes** — needs a real agent loop |
| **cross-run memory** — "compared to last week, ctr dropped 8%" without the operator uploading history | operators love it; competitors don't have it | partly — langgraph has memory primitives, but a supabase table also works |
| **live trace ui** for a run (like langsmith / langfuse but built-in) | screenshots of this are gold in demos | no — the `/admin/runs` view already exists; polish it |
| **replay a past run with tweaked prompts** | powerful for support + prompt engineering | **yes** — langgraph's time-travel makes this near-free |

### the honest CTO answer

adopting a framework "to make the product stand out" is **backwards**. the framework is invisible to buyers. what stands out is the AI *product surface* — visible quality gates, human-approvable messages, cross-week memory, live traces. metis already has more of these than most competitors (the two judges + the deterministic direction check are unusually rigorous).

**recommended order (my strong opinion):**

1. **ship byok and meta oauth first.** these are the actual blockers to launch, they're visible ("we don't burn your credits, and connecting is one click"), and they remove hard "no"s from prospective users.
2. **build an evals dashboard on the existing run data.** no framework. one week. it's the highest-leverage "look how serious we are" screenshot for demos.
3. **add human-in-the-loop approval** as an opt-in per connection. **this is the point at which langgraph or mastra actually earns its keep** — because the pipeline needs to pause, wait for a webhook back from slack, and resume. writing durable resume logic by hand is where the current architecture starts to hurt.
4. **only then** consider a "true agent mode" as a paid tier.

so: langchain — no. langgraph/mastra — yes eventually, but as a **means to a specific capability** (human-in-the-loop, then agent mode), not as a badge. and when the day comes, **prefer mastra over langgraph** for a typescript codebase.

---

## sources

- [meta marketing api — authorization (access levels, dev mode)](https://developers.facebook.com/docs/marketing-api/get-started/authorization)
- [meta blog — marketing api access tier changes, may 4 2026](https://developers.meta.com/blog/updates-to-ads-management-standard-access-feature/)
- [facebook login for business (config ids, bisu tokens)](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business)
- [manual oauth login flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/)
- [indie-dev business verification pain (github issue)](https://github.com/facebook/facebook-android-sdk/issues/1246)
- [openrouter oauth pkce guide](https://openrouter.ai/docs/guides/overview/auth/oauth)
- [openrouter code-for-key exchange endpoint](https://openrouter.ai/docs/api/api-reference/o-auth/exchange-auth-code-for-api-key)
- [anthropic — building effective agents (workflow vs agent framing)](https://www.anthropic.com/research/building-effective-agents)
- [langchain — best ai agent frameworks 2026](https://www.langchain.com/resources/ai-agent-frameworks)
- [particula — mastra vs langgraph vs vercel ai sdk (typescript, 2026)](https://particula.tech/blog/mastra-vs-langgraph-vs-vercel-ai-sdk-typescript-agents)
- [langchain criticism + alternatives 2026 (lindy)](https://www.lindy.ai/blog/langchain-alternatives)
- [reactify — langgraph as state machines, not chatbots (2026)](https://www.reactify-solutions.com/articles/langgraph-production-agents-2026)
- [dev.to — replit switch: langgraph → mastra typescript agents](https://dev.to/jim_l_efc70c3a738e9f4baa7/i-switched-from-langgraph-to-mastra-for-my-typescript-agents-18-hours-vs-41-nah)

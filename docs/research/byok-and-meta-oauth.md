# research: bring-your-own-key llm calls + meta oauth connect

**date:** 2026-07-09 · **branch:** `feat/byok-and-meta-oauth` (off `origin/main` @ `ba10f6a`) · **status:** research only, no code changed

two production-readiness gaps, researched together because they share one solution shape: per-user credentials, encrypted at rest, connected with as few clicks as possible.

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

## sources

- [meta marketing api — authorization (access levels, dev mode)](https://developers.facebook.com/docs/marketing-api/get-started/authorization)
- [meta blog — marketing api access tier changes, may 4 2026](https://developers.meta.com/blog/updates-to-ads-management-standard-access-feature/)
- [facebook login for business (config ids, bisu tokens)](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business)
- [manual oauth login flow](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/)
- [indie-dev business verification pain (github issue)](https://github.com/facebook/facebook-android-sdk/issues/1246)
- [openrouter oauth pkce guide](https://openrouter.ai/docs/guides/overview/auth/oauth)
- [openrouter code-for-key exchange endpoint](https://openrouter.ai/docs/api/api-reference/o-auth/exchange-auth-code-for-api-key)

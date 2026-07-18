# BYOK (Bring Your Own AI Key) Implementation Plan

> **For agentic workers:** This plan is fully self-contained — you do not need any prior conversation. Execute task-by-task in order; steps use checkbox (`- [ ]`) syntax; every task ends in a commit. If the superpowers execution skills (`subagent-driven-development` / `executing-plans`) are installed, use them; otherwise execute inline.

**Goal:** Each signed-in user connects their own AI API key (OpenRouter one-click OAuth, or OpenAI pasted key); authed report runs use *their* key instead of the app owner's shared `OPENROUTER_API_KEY`.

**Architecture:** New RLS-scoped `llm_keys` table stores one encrypted key per user (existing AES-256-GCM helper). At request time the API route decrypts the key and wraps the reporting workflow in an `AsyncLocalStorage` context; the two low-level LLM modules read the context and fall back to the env var when absent — so the off-limits reporting brain (`src/lib/metis/*`) needs **zero changes** and the public demo path behaves exactly as before. OpenRouter and OpenAI both speak the OpenAI-compatible chat API, so one code path serves both (different base URL + model-id mapping).

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), `node:async_hooks` (AsyncLocalStorage), `node:crypto` (PKCE), Vitest.

**Decision already made by the user:** own key **required** for authed runs — no key, no report (friendly CTA instead). The public `/reporting` demo page keeps using the app's env key for now (it's the marketing demo; revisit at launch).

**Definition of done (user's words):** works inside the app — connect key → generate report on that key → remove key → blocked with CTA.

---

## Read this first (zero-context engineer)

- Repo: `iamaditya-gaur/metis-ai`. Branch from `origin/main` — **local `main` on this machine is a stale POC lineage; never branch from it.** If the branch `feat/byok-and-meta-oauth` exists, decide with the user whether to stack on it or branch fresh; do not assume.
- Production: https://metis-ai-nine.vercel.app.
- **Hard constraints (user-stated, non-negotiable):**
  - Do NOT modify `src/lib/metis/*` (the reporting brain). This plan touches `scripts/pocs/lib/llm.mjs` and `scripts/pocs/lib/reporting.mjs` instead — the engine's low-level modules. **The user approved this specific seam by approving this plan**; keep those edits exactly as scoped here, nothing more.
  - No long-lived `next dev` / Chromium sessions (a previous session ate 60+ GB RAM). QA = `npm run build`, curl against deployed URLs, one-shot screenshots (`preview_start → screenshot → preview_stop` same turn), Supabase MCP for SQL.
  - Local envs are empty strings for secrets (`vercel env pull` quirk) → end-to-end testing happens on deployed URLs only.
  - Confirm with the user before: deploys, `git push`, DB migrations, anything externally visible.
- How LLM calls flow today (verified by reading the code):
  - `src/lib/metis/reporting.ts` → `runReportingWorkflow()` orchestrates a report run. It calls:
    - `generateOpenRouterReportSummary()` in `scripts/pocs/lib/reporting.mjs` (inline `fetch`, reads `OPENROUTER_API_KEY` at line ~328);
    - four tone/judge functions in `src/lib/metis/tone.ts`, all of which funnel through `requestOpenRouterJson()` in `scripts/pocs/lib/llm.mjs` (reads `OPENROUTER_API_KEY` at line ~71).
  - So **every** LLM call goes through exactly two functions in two `.mjs` files. That's the whole seam.
  - Default model: `openai/gpt-5.4-mini` (env `OPENROUTER_MODEL` overrides). OpenRouter-style ids are `vendor/model`; OpenAI-direct wants the bare id (strip `openai/`).
  - The API route that triggers runs: `src/app/api/metis/reporting/route.ts` (already resolves the user + decrypts the saved Meta token; mirrors what we do for LLM keys).
  - Builder surfaces (`src/app/api/metis/builder/*`, calls via `scripts/pocs/lib/builder.mjs` → same `requestOpenRouterJson` funnel) are legacy/secondary: leave them on the env key in this plan; note it in the handoff doc.
- Reusable pieces:
  - `src/lib/crypto/token-encryption.ts` — `encryptSecretToBase64()` / `decryptSecretFromBase64()`; key in `METIS_TOKEN_ENCRYPTION_KEY` (already set in Vercel).
  - `src/lib/supabase/server.ts` — `createClient()` (user-scoped, RLS applies).
  - Settings page exists: `src/app/app/settings/` (`page.tsx`, `actions.ts`, `profile-form.tsx`, `password-form.tsx`) — the key UI slots in here.
  - Migration style: copy the RLS-policy shape of `supabase/0004_meta_connections.sql`; secret columns are base64 `text` (see `0007_meta_connections_text_columns.sql`).
- **No new env vars are needed for this feature.** OpenRouter PKCE requires no app registration; the callback URL is derived from the request origin.

## Where the user is required

| Gate | What | Time |
|---|---|---|
| G1 | One-word approval to apply migration `llm_keys` | seconds |
| G2 | One-word approval per deploy / push | seconds |
| G3 | Click-test once on the deployed URL: connect their real OpenRouter account via the button, generate a report, delete key, see the CTA. (Agent must never handle a plaintext key in chat.) | ~4 min |

## Known roadblocks, pre-answered

1. **Off-limits boundary.** `src/lib/metis/*` untouched; the two `.mjs` edits are additive (context lookup with env fallback). When no context is set, byte-for-byte identical behavior — the public demo path proves it.
2. **Concurrent requests sharing a process.** Never smuggle the key via `process.env` mutation — two overlapping requests would cross keys. `AsyncLocalStorage` isolates per request; it flows through `Promise.allSettled` (the parallel judges) automatically.
3. **Runtime.** ALS needs the Node runtime. Next.js route handlers default to Node — do not add `export const runtime = "edge"` anywhere in touched routes.
4. **`.mjs` can't import `.ts`.** The context module must be a `.mjs` file so both the engine modules and (bundled) TS routes can import it. It lives at `scripts/pocs/lib/llm-context.mjs`.
5. **Model availability per provider.** OpenAI-direct can only run `openai/*` models. If the configured model isn't `openai/*` and the user's provider is `openai`, fail fast with a clear message rather than sending a garbage model id.
6. **OpenRouter PKCE specifics.** Auth URL is `https://openrouter.ai/auth?callback_url=...&code_challenge=...&code_challenge_method=S256`; exchange is `POST https://openrouter.ai/api/v1/auth/keys` with `{code, code_verifier, code_challenge_method}` → `{key}`. Verifier travels in a short-lived httpOnly cookie. No client id/secret exists for this flow.
7. **Never log or echo keys.** Store ciphertext + `last_four` only; UI shows `···· abcd`. The OpenRouter callback receives the key server-side; it must never appear in a response body, log line, or chat message.
8. **401 mid-run.** `llm.mjs` already throws a clean `OPENROUTER_AUTH_FAILED` error on 401 — but its message tells the *operator* to fix Vercel env. Task 4 rewords it contextually for BYOK ("your connected key was rejected — reconnect it in Settings").
9. **Migration numbering.** Use the next free `supabase/00NN_*.sql` number at execution time (the Meta OAuth plan may have taken `0009`). SQL below assumes `0010`; renumber if needed.

---

### Task 1: Vitest setup (skip if `vitest.config.ts` already exists)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install and wire**

```bash
npm install -D vitest
```

`package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.mjs"],
  },
});
```

- [ ] **Step 3: Verify**

Run: `npx vitest run --passWithNoTests` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for pure-helper unit tests"
```

### Task 2: Migration — `llm_keys` table

**Files:**
- Create: `supabase/0010_llm_keys.sql` (renumber to next free if 0010 is taken)

- [ ] **Step 1: Write the migration**

```sql
-- Per-user encrypted LLM API keys (BYOK). One key per user (unique user_id);
-- provider says which API it belongs to. Plaintext never stored: AES-256-GCM
-- via METIS_TOKEN_ENCRYPTION_KEY, base64 text columns (same pattern as
-- meta_connections after 0007). last_four is display-only.

create table if not exists public.llm_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openrouter', 'openai')),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  last_four text not null,
  last_validated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id)
);

alter table public.llm_keys enable row level security;

drop policy if exists "llm_keys_select_own" on public.llm_keys;
create policy "llm_keys_select_own" on public.llm_keys
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "llm_keys_insert_own" on public.llm_keys;
create policy "llm_keys_insert_own" on public.llm_keys
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "llm_keys_update_own" on public.llm_keys;
create policy "llm_keys_update_own" on public.llm_keys
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "llm_keys_delete_own" on public.llm_keys;
create policy "llm_keys_delete_own" on public.llm_keys
  for delete to authenticated using (auth.uid() = user_id);

comment on table public.llm_keys is
  'Per-user encrypted BYOK LLM API keys. AES-256-GCM; key in METIS_TOKEN_ENCRYPTION_KEY.';
```

- [ ] **Step 2: ASK THE USER (gate G1), then apply via Supabase MCP `apply_migration`.**

- [ ] **Step 3: Commit**

```bash
git add supabase/0010_llm_keys.sql
git commit -m "feat(db): llm_keys table for BYOK"
```

### Task 3: LLM context module + tests (the seam, part 1)

**Files:**
- Create: `scripts/pocs/lib/llm-context.mjs`
- Test: `tests/llm-context.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it } from "vitest";

import {
  getLlmCallConfig,
  runWithLlmKey,
} from "../scripts/pocs/lib/llm-context.mjs";

describe("getLlmCallConfig", () => {
  it("falls back to env + openrouter when no context", () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    const config = getLlmCallConfig();
    expect(config.provider).toBe("openrouter");
    expect(config.apiKey).toBe("env-key");
    expect(config.endpoint).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(config.mapModel("openai/gpt-5.4-mini")).toBe("openai/gpt-5.4-mini");
  });

  it("uses the per-request key inside runWithLlmKey", () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    runWithLlmKey({ provider: "openai", apiKey: "user-key" }, () => {
      const config = getLlmCallConfig();
      expect(config.provider).toBe("openai");
      expect(config.apiKey).toBe("user-key");
      expect(config.endpoint).toBe("https://api.openai.com/v1/chat/completions");
      expect(config.mapModel("openai/gpt-5.4-mini")).toBe("gpt-5.4-mini");
    });
  });

  it("openai provider rejects non-openai models", () => {
    runWithLlmKey({ provider: "openai", apiKey: "user-key" }, () => {
      const config = getLlmCallConfig();
      expect(() => config.mapModel("anthropic/claude-sonnet-5")).toThrow();
    });
  });

  it("context survives async boundaries", async () => {
    await runWithLlmKey({ provider: "openrouter", apiKey: "ctx-key" }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const [a, b] = await Promise.allSettled([
        Promise.resolve().then(() => getLlmCallConfig().apiKey),
        Promise.resolve().then(() => getLlmCallConfig().apiKey),
      ]);
      expect(a.value).toBe("ctx-key");
      expect(b.value).toBe("ctx-key");
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/llm-context.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/pocs/lib/llm-context.mjs`**

```js
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request LLM credential context (BYOK). API routes wrap workflow calls
 * in runWithLlmKey(...) so the low-level LLM modules pick up the signed-in
 * user's own key. When no context is set (public demo path, POC scripts),
 * everything falls back to OPENROUTER_API_KEY exactly as before.
 *
 * AsyncLocalStorage — not process.env mutation — because two overlapping
 * requests in one serverless process must never see each other's keys.
 */

const storage = new AsyncLocalStorage();

/**
 * @param {{ provider: "openrouter" | "openai"; apiKey: string }} context
 * @param {() => any} fn
 */
export function runWithLlmKey(context, fn) {
  return storage.run(context, fn);
}

const PROVIDERS = {
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    extraHeaders: {
      "HTTP-Referer": "https://metis-ai-nine.vercel.app",
      "X-OpenRouter-Title": "Metis AI",
    },
    mapModel: (model) => model,
  },
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    extraHeaders: {},
    mapModel: (model) => {
      if (!model.startsWith("openai/")) {
        throw new Error(
          `Model "${model}" is not available on a direct OpenAI key. Connect an OpenRouter key instead.`,
        );
      }
      return model.slice("openai/".length);
    },
  },
};

export function getLlmCallConfig() {
  const context = storage.getStore() ?? null;
  const provider = context?.provider ?? "openrouter";
  const apiKey = context?.apiKey?.trim() || process.env.OPENROUTER_API_KEY?.trim() || "";
  const { endpoint, extraHeaders, mapModel } = PROVIDERS[provider];
  return { provider, apiKey, endpoint, extraHeaders, mapModel, isUserKey: Boolean(context) };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/llm-context.test.mjs` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/pocs/lib/llm-context.mjs tests/llm-context.test.mjs
git commit -m "feat(llm): AsyncLocalStorage per-request key context with env fallback"
```

### Task 4: Wire the context into the two engine modules (the seam, part 2 — approved boundary edit)

**Files:**
- Modify: `scripts/pocs/lib/llm.mjs` (function `requestOpenRouterJson`, key/fetch section ~lines 71–116, and the 401 message ~line 151)
- Modify: `scripts/pocs/lib/reporting.mjs` (function `generateOpenRouterReportSummary`, ~lines 327–345, and its 401 message)

Keep the edits exactly this size. Everything else in both files stays untouched.

- [ ] **Step 1: `llm.mjs`.** Add the import at the top:

```js
import { getLlmCallConfig } from "./llm-context.mjs";
```

Replace (inside `requestOpenRouterJson`):

```js
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }
```

with:

```js
  const llmConfig = getLlmCallConfig();
  const apiKey = llmConfig.apiKey;

  if (!apiKey) {
    throw new Error(
      llmConfig.isUserKey
        ? "Your connected AI key could not be read. Reconnect it in Settings."
        : "Missing OPENROUTER_API_KEY.",
    );
  }
```

Replace the fetch call's URL and headers:

```js
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://metis-ai-nine.vercel.app",
          "X-OpenRouter-Title": "Metis AI",
        },
```

with:

```js
      response = await fetch(llmConfig.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...llmConfig.extraHeaders,
        },
```

And in the same request body, model becomes `model: llmConfig.mapModel(candidateModel),` (wrap in the existing try/catch structure: a `mapModel` throw should surface as a normal error attempt — simplest is to call it once before the fetch: `const wireModel = llmConfig.mapModel(candidateModel);` inside the existing `try` and use `model: wireModel`).

Replace the 401 error message string:

```js
        const err = new Error(
          llmConfig.isUserKey
            ? "Your connected AI key was rejected (invalid, revoked, or out of credits). Reconnect or replace it in Settings → AI key."
            : "OpenRouter API key is invalid, expired, or revoked. Update OPENROUTER_API_KEY in Vercel (Project Settings → Environment Variables) for both Preview and Production, then redeploy.",
        );
```

(keep the existing `err.code = "OPENROUTER_AUTH_FAILED"` lines unchanged).

- [ ] **Step 2: `reporting.mjs`.** Add the same import (path `./llm-context.mjs`). In `generateOpenRouterReportSummary`, apply the same three substitutions: key resolution block, fetch endpoint/headers, 401 message. The model line becomes:

```js
  const model = llmConfig.mapModel(
    process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-5.4-mini",
  );
```

- [ ] **Step 3: Prove no behavioral drift without context**

Run: `npx vitest run && npm run build && npm run lint`
Expected: all pass. (No context set at module load → env fallback path → identical requests to before.)

- [ ] **Step 4: Commit**

```bash
git add scripts/pocs/lib/llm.mjs scripts/pocs/lib/reporting.mjs
git commit -m "feat(llm): engine modules read per-request BYOK context (env fallback intact)"
```

### Task 5: Key storage helpers + PKCE + tests

**Files:**
- Create: `src/lib/llm-keys/pkce.ts`
- Create: `src/lib/llm-keys/store.ts`
- Test: `tests/llm-keys.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createPkcePair } from "../src/lib/llm-keys/pkce";

describe("createPkcePair", () => {
  it("challenge is base64url sha256 of verifier", () => {
    const { verifier, challenge } = createPkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("pairs are unique per call", () => {
    expect(createPkcePair().verifier).not.toBe(createPkcePair().verifier);
  });
});
```

- [ ] **Step 2: Run → FAIL (module not found).**

- [ ] **Step 3: Implement `pkce.ts`**

```ts
import { createHash, randomBytes } from "node:crypto";

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
```

- [ ] **Step 4: Implement `store.ts`** (server-only helpers; user-scoped client so RLS applies)

```ts
import { decryptSecretFromBase64, encryptSecretToBase64 } from "@/lib/crypto/token-encryption";
import { createClient } from "@/lib/supabase/server";

export type LlmProvider = "openrouter" | "openai";

export type LlmKeySummary = {
  provider: LlmProvider;
  lastFour: string;
  lastValidatedAt: string | null;
};

/** Validates the key against the provider before saving. Throws on rejection. */
export async function validateLlmKey(provider: LlmProvider, apiKey: string): Promise<void> {
  const probe =
    provider === "openrouter"
      ? "https://openrouter.ai/api/v1/key"
      : "https://api.openai.com/v1/models";
  const response = await fetch(probe, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(
      provider === "openrouter"
        ? "OpenRouter rejected this key."
        : "OpenAI rejected this key. Check it at platform.openai.com → API keys.",
    );
  }
}

export async function saveLlmKey(provider: LlmProvider, apiKey: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");

  await validateLlmKey(provider, apiKey);
  const parts = encryptSecretToBase64(apiKey);
  const { error } = await supabase.from("llm_keys").upsert(
    {
      user_id: user.id,
      provider,
      ciphertext: parts.ciphertext,
      iv: parts.iv,
      auth_tag: parts.authTag,
      last_four: apiKey.slice(-4),
      last_validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Couldn't save the key: ${error.message}`);
}

export async function getLlmKeySummary(): Promise<LlmKeySummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("llm_keys")
    .select("provider, last_four, last_validated_at")
    .maybeSingle();
  if (!data) return null;
  return {
    provider: data.provider as LlmProvider,
    lastFour: data.last_four,
    lastValidatedAt: data.last_validated_at,
  };
}

/** Decrypts the signed-in user's key for a run. Returns null when absent. */
export async function resolveLlmKeyForRun(): Promise<{
  provider: LlmProvider;
  apiKey: string;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("llm_keys")
    .select("provider, ciphertext, iv, auth_tag")
    .maybeSingle();
  if (!data) return null;
  return {
    provider: data.provider as LlmProvider,
    apiKey: decryptSecretFromBase64({
      ciphertext: data.ciphertext,
      iv: data.iv,
      authTag: data.auth_tag,
    }),
  };
}

export async function deleteLlmKey(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("llm_keys").delete().neq("provider", "");
  if (error) throw new Error(`Couldn't delete the key: ${error.message}`);
}
```

- [ ] **Step 5: Run tests → PASS. Build. Commit.**

```bash
npx vitest run && npm run build
git add src/lib/llm-keys/pkce.ts src/lib/llm-keys/store.ts tests/llm-keys.test.ts
git commit -m "feat(llm-keys): pkce + encrypted key store helpers"
```

### Task 6: OpenRouter one-click connect routes

**Files:**
- Create: `src/app/api/llm-keys/openrouter/start/route.ts`
- Create: `src/app/api/llm-keys/openrouter/callback/route.ts`

- [ ] **Step 1: Start route**

```ts
import { NextResponse } from "next/server";

import { createPkcePair } from "@/lib/llm-keys/pkce";
import { createClient } from "@/lib/supabase/server";

export const VERIFIER_COOKIE = "metis.orkey_verifier";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/settings", request.url));
  }

  const { verifier, challenge } = createPkcePair();
  const callbackUrl = new URL("/api/llm-keys/openrouter/callback", request.url);
  const authUrl = new URL("https://openrouter.ai/auth");
  authUrl.searchParams.set("callback_url", callbackUrl.toString());
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set(VERIFIER_COOKIE, verifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
```

- [ ] **Step 2: Callback route**

```ts
import { NextResponse } from "next/server";

import { saveLlmKey } from "@/lib/llm-keys/store";
import { createClient } from "@/lib/supabase/server";

import { VERIFIER_COOKIE } from "../start/route";

function settingsRedirect(request: Request, params: Record<string, string>) {
  const target = new URL("/app/settings", request.url);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/settings", request.url));
  }

  const code = new URL(request.url).searchParams.get("code");
  const cookieHeader = request.headers.get("cookie") ?? "";
  const verifier = cookieHeader
    .split(/;\s*/)
    .find((part) => part.startsWith(`${VERIFIER_COOKIE}=`))
    ?.slice(VERIFIER_COOKIE.length + 1);
  if (!code || !verifier) {
    return settingsRedirect(request, { llm_error: "flow_expired" });
  }

  let key: string;
  try {
    const exchange = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
        code_challenge_method: "S256",
      }),
    });
    const payload = (await exchange.json()) as { key?: string };
    if (!exchange.ok || typeof payload.key !== "string" || !payload.key) {
      return settingsRedirect(request, { llm_error: "exchange_failed" });
    }
    key = payload.key;
  } catch {
    return settingsRedirect(request, { llm_error: "exchange_failed" });
  }

  try {
    await saveLlmKey("openrouter", key);
  } catch {
    return settingsRedirect(request, { llm_error: "save_failed" });
  }

  const response = settingsRedirect(request, { llm_saved: "1" });
  response.cookies.set(VERIFIER_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
```

- [ ] **Step 3: Build, commit**

```bash
npm run build
git add src/app/api/llm-keys/openrouter/
git commit -m "feat(llm-keys): one-click OpenRouter PKCE connect"
```

### Task 7: Settings UI — AI key section

**Files:**
- Create: `src/components/llm-key-card.tsx`
- Modify: `src/app/app/settings/actions.ts` (add two server actions)
- Modify: `src/app/app/settings/page.tsx` (render the section)

- [ ] **Step 1: Server actions.** Append to `src/app/app/settings/actions.ts` (match the existing action style in that file — read it first):

```ts
export type LlmKeyFormResult = { status: "idle" } | { status: "error"; message: string };

export async function saveOpenAiKeyAction(
  _prev: LlmKeyFormResult,
  formData: FormData,
): Promise<LlmKeyFormResult> {
  const raw = formData.get("apiKey");
  const apiKey = typeof raw === "string" ? raw.trim() : "";
  if (!apiKey || apiKey.length > 300) {
    return { status: "error", message: "Paste a valid OpenAI API key." };
  }
  try {
    await saveLlmKey("openai", apiKey);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Couldn't save the key.",
    };
  }
  revalidatePath("/app/settings");
  redirect("/app/settings?llm_saved=1");
}

export async function deleteLlmKeyAction(): Promise<void> {
  try {
    await deleteLlmKey();
  } catch (error) {
    console.error("delete llm key failed", error);
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/reports");
}
```

(add imports: `saveLlmKey`, `deleteLlmKey` from `@/lib/llm-keys/store`; `revalidatePath` / `redirect` are already imported in that file if the existing actions use them — check.)

- [ ] **Step 2: The card component** (`"use client"`; follow the form patterns in `password-form.tsx` — `useActionState` for the OpenAI form):

```tsx
"use client";

import { useActionState } from "react";

import type { LlmKeySummary } from "@/lib/llm-keys/store";
import {
  deleteLlmKeyAction,
  saveOpenAiKeyAction,
  type LlmKeyFormResult,
} from "@/app/app/settings/actions";

const initialState: LlmKeyFormResult = { status: "idle" };

type Props = { summary: LlmKeySummary | null; savedFlash: boolean; errorFlash: string | null };

export function LlmKeyCard({ summary, savedFlash, errorFlash }: Props) {
  const [state, formAction, pending] = useActionState(saveOpenAiKeyAction, initialState);

  if (summary) {
    return (
      <div className="llm-key-card">
        {savedFlash ? <p role="status">AI key connected.</p> : null}
        <p>
          <strong>{summary.provider === "openrouter" ? "OpenRouter" : "OpenAI"}</strong>{" "}
          key ending in <code>···· {summary.lastFour}</code>
          {summary.lastValidatedAt
            ? ` · verified ${new Date(summary.lastValidatedAt).toLocaleDateString()}`
            : null}
        </p>
        <form action={deleteLlmKeyAction}>
          <button type="submit" className="link-button">
            Remove key
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="llm-key-card">
      {errorFlash ? <p className="form-error" role="alert">{errorFlash}</p> : null}
      <p>Reports run on your own AI account. Connect one of:</p>
      <a className="product-button" href="/api/llm-keys/openrouter/start">
        Connect OpenRouter (one click)
      </a>
      <form action={formAction}>
        <label htmlFor="openai-key">Or paste an OpenAI API key</label>
        <input
          id="openai-key"
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder="sk-..."
        />
        <button type="submit" disabled={pending}>
          {pending ? "Checking…" : "Save OpenAI key"}
        </button>
        {state.status === "error" ? (
          <p className="form-error" role="alert">{state.message}</p>
        ) : null}
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Render in settings page.** In `src/app/app/settings/page.tsx`, fetch `const summary = await getLlmKeySummary();`, read `llm_saved` / `llm_error` from searchParams (map slugs: `flow_expired` → "The connect flow expired — try again.", `exchange_failed` → "OpenRouter didn't complete the handoff — try again.", `save_failed` → "Connected but saving failed — try again."), and render `<LlmKeyCard …/>` in a new section titled "AI key" above the existing profile/password sections, following the page's existing section markup.

- [ ] **Step 4: Build + lint, commit**

```bash
npm run build && npm run lint
git add src/components/llm-key-card.tsx src/app/app/settings/
git commit -m "feat(settings): AI key section — OpenRouter 1-click + OpenAI paste"
```

### Task 8: Enforce BYOK on authed runs

**Files:**
- Modify: `src/app/api/metis/reporting/route.ts`
- Modify: `src/app/app/reports/page.tsx` (no-key banner)

- [ ] **Step 1: Route enforcement + context wrap.** In `src/app/api/metis/reporting/route.ts`:

Add imports:

```ts
import { runWithLlmKey } from "../../../../../scripts/pocs/lib/llm-context.mjs";
import { resolveLlmKeyForRun } from "@/lib/llm-keys/store";
```

(fix the relative depth of the `.mjs` import to match the file's location — `src/app/api/metis/reporting/route.ts` → five levels up; TypeScript may need `// @ts-expect-error untyped mjs` on that line, same pattern as `src/lib/metis/reporting.ts` uses for its `.mjs` imports — check how that file handles it and copy the idiom.)

Replace:

```ts
  try {
    const result = await runReportingWorkflow(payload);
    return NextResponse.json(result);
```

with:

```ts
  // BYOK policy (user decision, 2026-07-17): signed-in runs must use the
  // user's own AI key. The anonymous /reporting demo keeps the env key.
  let llmKey: Awaited<ReturnType<typeof resolveLlmKeyForRun>> = null;
  if (payload.userId) {
    llmKey = await resolveLlmKeyForRun();
    if (!llmKey) {
      return NextResponse.json(
        {
          code: "LLM_KEY_REQUIRED",
          message:
            "Connect your AI key in Settings before generating reports. Reports run on your own OpenRouter or OpenAI account.",
        },
        { status: 402 },
      );
    }
  }

  try {
    const result = llmKey
      ? await runWithLlmKey(llmKey, () => runReportingWorkflow(payload))
      : await runReportingWorkflow(payload);
    return NextResponse.json(result);
```

- [ ] **Step 2: Reports page banner.** In `src/app/app/reports/page.tsx` (read it first; it's a server component), fetch `const llmKeySummary = await getLlmKeySummary();` and when null render a dismissable-free banner above the studio:

```tsx
{!llmKeySummary ? (
  <div className="llm-key-banner">
    <p>
      <strong>One thing before your first report:</strong> connect your AI key.
      Reports run on your own OpenRouter or OpenAI account — we never bill your
      usage to a shared key.
    </p>
    <a className="product-button" href="/app/settings">
      Connect AI key
    </a>
  </div>
) : null}
```

Also make sure the studio's error rendering shows the `message` from a non-2xx response (it already renders API error messages for failed runs — verify by reading `src/components/authed-reporting-studio.tsx`, and if it special-cases statuses, let 402 fall through to the generic message path).

- [ ] **Step 3: Build + lint, commit**

```bash
npm run build && npm run lint
git add src/app/api/metis/reporting/route.ts src/app/app/reports/page.tsx
git commit -m "feat(reports): require user AI key on authed runs; no-key CTA banner"
```

### Task 9: Deploy + verification

- [ ] **Step 1: Full local check:** `npx vitest run && npm run build && npm run lint` — all green.
- [ ] **Step 2: ASK THE USER (gate G2)**, then push + deploy.
- [ ] **Step 3: Curl sweep:**

```bash
BASE=https://metis-ai-nine.vercel.app
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/llm-keys/openrouter/start"   # 307 → /login
curl -s "$BASE/api/health" | jq                                                  # unchanged booleans
# Authed no-key run returns 402 LLM_KEY_REQUIRED — verify via the app, or with
# a session cookie if the user provides one; otherwise covered by G3.
```

- [ ] **Step 4: One-shot screenshot** of `/app/settings` (preview_start → screenshot → preview_stop, same turn).
- [ ] **Step 5: User click-test (gate G3):** connect real OpenRouter via button → generate a report → Settings shows `···· last4` → Remove key → Reports shows the banner and a run returns the friendly 402 message.
- [ ] **Step 6: Docs wrap-up:** update `docs/handoff/HANDOFF.md` ("what shipped": BYOK live, builder still on env key, demo path on env key by decision) + `CHANGELOG.md`. Commit. **Done per the user's definition: BYOK works inside the app.**

---

## Coordination with the Meta OAuth plan (`docs/plans/2026-07-17-meta-oauth-connect.md`)

- Independent: no shared files except `package.json`/`vitest.config.ts` (Task 1 is identical + idempotent in both plans — skip if present) and the docs wrap-ups (merge conflicts there are trivial).
- Migration numbering: Meta plan takes `0009`; this plan assumes `0010` — always use the next free number at execution time.
- Both branch from `origin/main`. If executed in parallel on separate branches, merge order doesn't matter.

## Self-review notes

- User decision (own key required) implemented in Task 8; demo-path exception recorded in code comment + handoff note.
- Type/name consistency: `runWithLlmKey` + `getLlmCallConfig` defined in Task 3, consumed in Tasks 4 and 8; `saveLlmKey`/`deleteLlmKey`/`getLlmKeySummary`/`resolveLlmKeyForRun` defined in Task 5, consumed in Tasks 6–8; `VERIFIER_COOKIE` exported once.
- Files flagged "read before editing" (settings actions/page, reports page, studio error path, `.mjs` import idiom) are called out inline instead of guessed.
- No plaintext key ever crosses chat, logs, or response bodies; agent never types a real key (G3 is the user).

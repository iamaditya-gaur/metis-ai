# Meta OAuth Connect Implementation Plan

> **For agentic workers:** Execute task-by-task in order. Steps use checkbox (`- [ ]`) syntax for tracking. Every task ends in a commit. If the superpowers execution skills (`subagent-driven-development` / `executing-plans`) are installed, use them; otherwise execute inline.

**Goal:** Replace manual Meta access-token pasting with a "Connect with Meta" OAuth button, plus everything Meta's App Review + Business Verification needs — so a customer connects their ad account in a few clicks.

**Architecture:** Server-side OAuth code flow (Facebook Login for Business). A start route redirects to Meta's consent dialog; a callback route exchanges the code for a long-lived (~60-day) token, validates it against the Ads API, encrypts it with the existing AES-256-GCM helper, and stores it in the existing `meta_connections` table with new `auth_method`/`token_expires_at` columns. No client-side SDK, no `NEXT_PUBLIC_*` vars (avoids the build-time bake trap). Manual paste stays as a fallback path.

**Tech Stack:** Next.js 16 App Router route handlers, Supabase (Postgres + RLS), `node:crypto`, Vitest (new, for pure helpers only), Meta Graph API v25.0 (matches `scripts/pocs/lib/meta-client.mjs`).

**Definition of shipped (user's words):** everything on our side is done and we are only waiting on Meta for approval/clearance.

---

## Read this first (zero-context engineer)

- Repo: `iamaditya-gaur/metis-ai`. Branch from `origin/main` — **local `main` on the user's machine is stale; never use it.** Work on `feat/byok-and-meta-oauth` unless told otherwise.
- Production: https://metis-ai-nine.vercel.app (Vercel project, single Supabase project).
- **Hard constraints (user-stated, non-negotiable):**
  - Do NOT modify `src/lib/metis/*` (reporting brain). This plan never touches it.
  - No long-lived `next dev` / Chromium sessions. QA = `npm run build`, curl against deployed URLs, one-shot screenshots, Supabase MCP for SQL.
  - `vercel env pull` writes empty strings for sensitive vars locally → OAuth is only testable on deployed URLs.
  - Confirm with the user before: deploys, `git push`, DB migrations, anything externally visible.
- Existing pieces you will reuse:
  - `src/lib/crypto/token-encryption.ts` — `encryptSecretToBase64()` / `decryptSecretFromBase64()` (AES-256-GCM, key in `METIS_TOKEN_ENCRYPTION_KEY`).
  - `src/lib/metis/accounts.ts` — `getAccessibleAccounts({ accessToken })` (validates a token by listing ad accounts). Import it; don't modify it.
  - `src/app/app/connections/actions.ts` — the manual-paste flow; the callback route mirrors its validate→encrypt→insert→redirect sequence.
  - `src/lib/supabase/server.ts` (`createClient`), `src/lib/supabase/admin.ts` (service-role client).
  - Table `meta_connections` (see `supabase/0004_meta_connections.sql`; columns became base64 text in `0007_meta_connections_text_columns.sql`).
  - Graph version pattern: `process.env.META_GRAPH_API_VERSION?.trim() || "v25.0"` (same as `meta-client.mjs`).

## Where the user is required (everything else is agent work)

| Gate | What | When | Time |
|---|---|---|---|
| G1 | Create the Meta app in developers.facebook.com (logged into their FB account), following `docs/meta-app-setup.md` (Task 10). Agent cannot log in or accept platform terms. | after Task 10 | ~30–45 min |
| G2 | Paste `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI`, `META_LOGIN_CONFIG_ID` into Vercel env (Production + Preview + Development). Secrets must not pass through chat. | after G1 | ~5 min |
| G3 | One-word approval to apply migration `0009` | Task 2 | seconds |
| G4 | One-word approval per deploy / push | Tasks 11–12 | seconds |
| G5 | Click-test the OAuth happy path once on production (their FB login) | Task 12 | ~3 min |
| G6 | Submit App Review + Business Verification (upload GST docs into Meta's dashboard directly — never through chat) using the pre-drafted text from Task 10 | last | ~30–45 min |

## Known roadblocks and how this plan handles them

1. **Business-type apps may require `config_id` instead of `scope`.** Meta pushes business apps to Facebook Login for Business "configurations". The dialog URL builder supports both: uses `META_LOGIN_CONFIG_ID` when set, falls back to `scope=ads_read`. If the dialog errors with "app not allowed" on scope, create a configuration (covered in the setup guide).
2. **Redirect URI must match the allowlist exactly.** We register exactly: `https://metis-ai-nine.vercel.app/api/meta/oauth/callback` (+ optionally the stable branch alias). The env var `META_OAUTH_REDIRECT_URI` holds the exact registered value; we never derive it from request headers.
3. **Dev-mode restriction.** Until App Review passes, only users with a role on the Meta app (admin/developer/tester) can complete OAuth. That's fine: the user + invited testers cover pre-approval usage; everyone else still has manual paste.
4. **Long-lived exchange quirks.** The `fb_exchange_token` response sometimes omits `expires_in` or returns `0` (means "no scheduled expiry"). Treat missing/0 as `token_expires_at = null`.
5. **Tokens die early** if the FB user changes password or revokes the app. The connections list shows expiry state and a Reconnect button; a dead token just means clicking Connect again (upsert by `fb_user_id`).
6. **Review rejections** are usually: broken privacy-policy URL, no data-deletion mechanism, vague use-case text. Tasks 6–8 make all three real; Task 10 pre-drafts the use-case text.
7. **Local testing is impossible** (empty local envs — existing project constraint). All testing on deployed URLs; unit tests cover only pure helpers.
8. **BV name mismatch.** The GST-registered legal name must match the Meta Business portfolio name exactly. Called out in the setup guide.

---

### Task 1: Vitest setup (skip if `vitest.config.ts` already exists)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install and wire vitest**

```bash
npm install -D vitest
```

Add to `package.json` scripts:

```json
"test": "vitest run"
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Verify it runs (no tests yet → passes with "no test files" is fine, use --passWithNoTests)**

Run: `npx vitest run --passWithNoTests`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for pure-helper unit tests"
```

### Task 2: Migration 0009 — OAuth columns on meta_connections

**Files:**
- Create: `supabase/0009_meta_connections_oauth.sql`

- [ ] **Step 1: Write the migration**

```sql
-- OAuth support for meta_connections. Existing rows are manual paste
-- (auth_method backfills to 'manual' via the column default).
-- token_expires_at: long-lived token expiry (~60d) for oauth rows; null for
-- manual rows and for tokens Meta reports as non-expiring (expires_in 0).
-- fb_user_id: the Facebook user who granted access — used for reconnect
-- upserts and for Meta's data-deletion callback.

alter table public.meta_connections
  add column if not exists auth_method text not null default 'manual',
  add column if not exists token_expires_at timestamptz,
  add column if not exists fb_user_id text,
  add column if not exists granted_scopes text;

alter table public.meta_connections
  drop constraint if exists meta_connections_auth_method_check;
alter table public.meta_connections
  add constraint meta_connections_auth_method_check
  check (auth_method in ('manual', 'oauth'));

create index if not exists meta_connections_fb_user_idx
  on public.meta_connections (fb_user_id);
```

- [ ] **Step 2: ASK THE USER (gate G3), then apply via Supabase MCP `apply_migration`**

Expected: success; `list_tables` shows the new columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/0009_meta_connections_oauth.sql
git commit -m "feat(db): oauth columns on meta_connections"
```

### Task 3: OAuth helper library + tests

**Files:**
- Create: `src/lib/meta/oauth.ts`
- Test: `tests/meta-oauth.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

import { buildAuthDialogUrl, parseSignedRequest } from "../src/lib/meta/oauth";

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

describe("buildAuthDialogUrl", () => {
  beforeEach(() => {
    process.env.META_APP_ID = "123456";
    process.env.META_APP_SECRET = "shh";
    process.env.META_OAUTH_REDIRECT_URI =
      "https://metis-ai-nine.vercel.app/api/meta/oauth/callback";
    delete process.env.META_LOGIN_CONFIG_ID;
    delete process.env.META_GRAPH_API_VERSION;
  });

  it("uses scope=ads_read when no config id is set", () => {
    const url = new URL(buildAuthDialogUrl({ state: "abc" }));
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toBe("/v25.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("123456");
    expect(url.searchParams.get("state")).toBe("abc");
    expect(url.searchParams.get("scope")).toBe("ads_read");
    expect(url.searchParams.get("config_id")).toBeNull();
  });

  it("uses config_id when META_LOGIN_CONFIG_ID is set", () => {
    process.env.META_LOGIN_CONFIG_ID = "789";
    const url = new URL(buildAuthDialogUrl({ state: "abc" }));
    expect(url.searchParams.get("config_id")).toBe("789");
    expect(url.searchParams.get("scope")).toBeNull();
  });
});

describe("parseSignedRequest", () => {
  const secret = "test-secret";

  it("verifies and decodes a well-signed payload", () => {
    const payload = b64url(JSON.stringify({ user_id: "fb-1", algorithm: "HMAC-SHA256" }));
    const sig = createHmac("sha256", secret).update(payload).digest("base64url");
    const parsed = parseSignedRequest(`${sig}.${payload}`, secret);
    expect(parsed.user_id).toBe("fb-1");
  });

  it("rejects a tampered payload", () => {
    const payload = b64url(JSON.stringify({ user_id: "fb-1" }));
    const sig = createHmac("sha256", secret).update(payload).digest("base64url");
    const evil = b64url(JSON.stringify({ user_id: "fb-2" }));
    expect(() => parseSignedRequest(`${sig}.${evil}`, secret)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/meta-oauth.test.ts`
Expected: FAIL — module `src/lib/meta/oauth` not found.

- [ ] **Step 3: Implement `src/lib/meta/oauth.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-side helpers for the Meta OAuth code flow (Facebook Login for
 * Business). All env access is server-only — no NEXT_PUBLIC_* vars, so
 * nothing bakes at build time.
 */

const GRAPH_BASE = "https://graph.facebook.com";
const DIALOG_BASE = "https://www.facebook.com";

export function getMetaOAuthEnv() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI?.trim();
  const configId = process.env.META_LOGIN_CONFIG_ID?.trim() || null;
  const version = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
  if (!appId) throw new Error("META_APP_ID is not set.");
  if (!appSecret) throw new Error("META_APP_SECRET is not set.");
  if (!redirectUri) throw new Error("META_OAUTH_REDIRECT_URI is not set.");
  return { appId, appSecret, redirectUri, configId, version };
}

export function buildAuthDialogUrl({ state }: { state: string }) {
  const { appId, redirectUri, configId, version } = getMetaOAuthEnv();
  const url = new URL(`${DIALOG_BASE}/${version}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  if (configId) {
    url.searchParams.set("config_id", configId);
  } else {
    url.searchParams.set("scope", "ads_read");
  }
  return url.toString();
}

type TokenResponse = { accessToken: string; expiresInSeconds: number | null };

async function graphGetJson(url: URL): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const err = (payload?.error ?? {}) as { message?: string; code?: number };
    throw new Error(
      `Meta OAuth error ${err.code ?? response.status}: ${err.message ?? "unknown error"}`,
    );
  }
  return payload;
}

function toTokenResponse(payload: Record<string, unknown>): TokenResponse {
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  if (!accessToken) throw new Error("Meta returned no access_token.");
  const raw = payload.expires_in;
  const expiresInSeconds =
    typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
  return { accessToken, expiresInSeconds };
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const { appId, appSecret, redirectUri, version } = getMetaOAuthEnv();
  const url = new URL(`${GRAPH_BASE}/${version}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);
  return toTokenResponse(await graphGetJson(url));
}

export async function exchangeForLongLivedToken(shortToken: string): Promise<TokenResponse> {
  const { appId, appSecret, version } = getMetaOAuthEnv();
  const url = new URL(`${GRAPH_BASE}/${version}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  return toTokenResponse(await graphGetJson(url));
}

export async function fetchMetaProfile(
  accessToken: string,
): Promise<{ id: string; name: string }> {
  const { version } = getMetaOAuthEnv();
  const url = new URL(`${GRAPH_BASE}/${version}/me`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", accessToken);
  const payload = await graphGetJson(url);
  return {
    id: String(payload.id ?? ""),
    name: String(payload.name ?? "Meta user"),
  };
}

/**
 * Verifies + decodes Meta's `signed_request` (used by the data-deletion
 * callback). Format: `<base64url hmac-sha256 sig>.<base64url json payload>`.
 */
export function parseSignedRequest(
  signedRequest: string,
  appSecret: string,
): Record<string, unknown> {
  const dot = signedRequest.indexOf(".");
  if (dot <= 0) throw new Error("Malformed signed_request.");
  const encodedSig = signedRequest.slice(0, dot);
  const encodedPayload = signedRequest.slice(dot + 1);
  const sig = Buffer.from(encodedSig, "base64url");
  const expected = createHmac("sha256", appSecret).update(encodedPayload).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    throw new Error("signed_request signature mismatch.");
  }
  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Record<
    string,
    unknown
  >;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/meta-oauth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/meta/oauth.ts tests/meta-oauth.test.ts
git commit -m "feat(meta): oauth helpers — dialog url, token exchange, signed_request"
```

### Task 4: OAuth start route

**Files:**
- Create: `src/app/api/meta/oauth/start/route.ts`

- [ ] **Step 1: Implement the route**

```ts
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { buildAuthDialogUrl } from "@/lib/meta/oauth";
import { createClient } from "@/lib/supabase/server";

export const STATE_COOKIE = "metis.meta_oauth_state";

/**
 * Kicks off the Meta OAuth flow. Requires a signed-in Metis user (the
 * callback needs someone to attach the connection to). The random `state`
 * goes both to Meta and into a short-lived httpOnly cookie; the callback
 * rejects any response where the two don't match (CSRF protection).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/connections", request.url));
  }

  let dialogUrl: string;
  const state = randomUUID();
  try {
    dialogUrl = buildAuthDialogUrl({ state });
  } catch {
    const target = new URL("/app/connections", request.url);
    target.searchParams.set("oauth_error", "not_configured");
    return NextResponse.redirect(target);
  }

  const response = NextResponse.redirect(dialogUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: clean build, route listed as `ƒ /api/meta/oauth/start`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/meta/oauth/start/route.ts
git commit -m "feat(meta): oauth start route with CSRF state cookie"
```

### Task 5: OAuth callback route

**Files:**
- Create: `src/app/api/meta/oauth/callback/route.ts`

Error contract: on any failure, redirect to `/app/connections?oauth_error=<slug>`. Slugs (UI maps them to friendly copy in Task 9): `denied`, `state_mismatch`, `exchange_failed`, `no_accounts`, `save_failed`, `not_configured`.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";

import { encryptSecretToBase64 } from "@/lib/crypto/token-encryption";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchMetaProfile,
} from "@/lib/meta/oauth";
import { getAccessibleAccounts } from "@/lib/metis/accounts";
import { createClient } from "@/lib/supabase/server";

import { STATE_COOKIE } from "../start/route";

function errorRedirect(request: Request, slug: string) {
  const target = new URL("/app/connections", request.url);
  target.searchParams.set("oauth_error", slug);
  return NextResponse.redirect(target);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/app/connections", request.url));
  }

  const url = new URL(request.url);
  // User pressed Cancel on the Meta dialog.
  if (url.searchParams.get("error") === "access_denied") {
    return errorRedirect(request, "denied");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieHeader = request.headers.get("cookie") ?? "";
  const stateCookie = cookieHeader
    .split(/;\s*/)
    .find((part) => part.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return errorRedirect(request, "state_mismatch");
  }

  let accessToken: string;
  let expiresInSeconds: number | null;
  let fbUserId: string;
  let fbName: string;
  try {
    const short = await exchangeCodeForToken(code);
    const long = await exchangeForLongLivedToken(short.accessToken);
    accessToken = long.accessToken;
    expiresInSeconds = long.expiresInSeconds;
    const profile = await fetchMetaProfile(accessToken);
    fbUserId = profile.id;
    fbName = profile.name;
  } catch {
    return errorRedirect(request, "exchange_failed");
  }

  let accountCount = 0;
  try {
    const accounts = await getAccessibleAccounts({ accessToken });
    accountCount = accounts.length;
  } catch {
    accountCount = 0;
  }
  if (accountCount === 0) {
    return errorRedirect(request, "no_accounts");
  }

  const parts = encryptSecretToBase64(accessToken);
  const row = {
    user_id: user.id,
    label: `Meta · ${fbName}`,
    ciphertext: parts.ciphertext,
    iv: parts.iv,
    auth_tag: parts.authTag,
    account_count: accountCount,
    last_synced_at: new Date().toISOString(),
    auth_method: "oauth",
    fb_user_id: fbUserId,
    granted_scopes: "ads_read",
    token_expires_at: expiresInSeconds
      ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
      : null,
  };

  // Reconnect = replace: one oauth row per (metis user, fb identity).
  const { data: existing } = await supabase
    .from("meta_connections")
    .select("id")
    .eq("fb_user_id", fbUserId)
    .eq("auth_method", "oauth")
    .maybeSingle();

  const query = existing
    ? supabase.from("meta_connections").update(row).eq("id", existing.id).select("id").single()
    : supabase.from("meta_connections").insert(row).select("id").single();
  const { data: saved, error } = await query;
  if (error || !saved) {
    return errorRedirect(request, "save_failed");
  }

  const target = new URL("/app/reports", request.url);
  target.searchParams.set("connection", saved.id);
  target.searchParams.set("saved", "1");
  const response = NextResponse.redirect(target);
  response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: clean. (RLS note: inserts/updates run as the signed-in user via `createClient` — policies from `0004` already allow own-row writes.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/meta/oauth/callback/route.ts
git commit -m "feat(meta): oauth callback — exchange, validate, encrypt, upsert"
```

### Task 6: Data-deletion callback + status page

Meta requires a Data Deletion Request URL for review. When a user deletes the app from their FB settings, Meta POSTs a `signed_request`; we delete every stored connection for that FB identity and answer with a confirmation code + status URL.

**Files:**
- Create: `src/app/api/meta/data-deletion/route.ts`
- Create: `src/app/data-deletion/page.tsx`

- [ ] **Step 1: Implement the callback route**

```ts
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { getMetaOAuthEnv, parseSignedRequest } from "@/lib/meta/oauth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let signedRequest: string | null = null;
  try {
    const form = await request.formData();
    const value = form.get("signed_request");
    signedRequest = typeof value === "string" ? value : null;
  } catch {
    signedRequest = null;
  }
  if (!signedRequest) {
    return NextResponse.json({ message: "signed_request required." }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    const { appSecret } = getMetaOAuthEnv();
    payload = parseSignedRequest(signedRequest, appSecret);
  } catch {
    return NextResponse.json({ message: "Invalid signed_request." }, { status: 400 });
  }

  const fbUserId = String(payload.user_id ?? "").trim();
  if (fbUserId) {
    // Service role: this deletion must span all Metis users who connected
    // this FB identity, which user-scoped RLS can't reach.
    const admin = createAdminClient();
    await admin.from("meta_connections").delete().eq("fb_user_id", fbUserId);
  }

  const confirmationCode = randomUUID();
  const statusUrl = new URL(`/data-deletion?code=${confirmationCode}`, request.url);
  return NextResponse.json({ url: statusUrl.toString(), confirmation_code: confirmationCode });
}
```

Note: check the actual export name in `src/lib/supabase/admin.ts` before writing the import — if it exports e.g. `createAdminClient` under a different name, match it.

- [ ] **Step 2: Implement the status page**

```tsx
type PageProps = { searchParams: Promise<{ code?: string }> };

export const metadata = { title: "Data deletion — Metis AI" };

export default async function DataDeletionPage({ searchParams }: PageProps) {
  const { code } = await searchParams;
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1>Data deletion</h1>
      <p>
        Deletion requests from Meta are processed immediately: every stored
        Meta access token tied to the requesting Facebook account is deleted
        at the moment the request arrives. There is no queue and no retention
        period for tokens.
      </p>
      {code ? (
        <p>
          Your confirmation code: <code>{code}</code>. The deletion tied to
          this code has already completed.
        </p>
      ) : null}
      <p>
        To also delete your Metis account and report history, email{" "}
        <a href="mailto:support@metis-ai.app">support@metis-ai.app</a> from
        your account email.
      </p>
    </main>
  );
}
```

(Adjust the support email to whatever the user actually wants during G6 prep; ask in the same message as the deploy confirmation — do not block on it.)

- [ ] **Step 3: Build, commit**

```bash
npm run build
git add src/app/api/meta/data-deletion/route.ts src/app/data-deletion/page.tsx
git commit -m "feat(meta): data-deletion callback + status page"
```

### Task 7: Privacy policy + terms pages

**Files:**
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/terms/page.tsx`
- Modify: `src/components/final-cta.tsx` (footer links)

- [ ] **Step 1: Privacy page — real content, plain language**

```tsx
export const metadata = { title: "Privacy policy — Metis AI" };

const UPDATED = "July 17, 2026";

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem", lineHeight: 1.7 }}>
      <h1>Privacy policy</h1>
      <p>Last updated: {UPDATED}</p>

      <h2>What Metis AI does</h2>
      <p>
        Metis AI generates plain-language performance reports from Meta ad
        accounts that you explicitly connect. We only ever request read-only
        access (<code>ads_read</code>). We cannot create, edit, pause, or
        spend on your campaigns.
      </p>

      <h2>Data we store</h2>
      <ul>
        <li>Your account email and login credentials (managed by Supabase Auth).</li>
        <li>
          Meta access tokens you grant us, encrypted at rest with AES-256-GCM.
          Plaintext tokens are never written to the database or to logs.
        </li>
        <li>
          Report runs: the metrics snapshot, the generated report text, and
          quality-check scores, linked to your account.
        </li>
        <li>Writing samples you upload to teach the tool your tone.</li>
      </ul>

      <h2>Data we do not store</h2>
      <ul>
        <li>We do not store your Facebook password — the connection uses Meta's own login.</li>
        <li>We do not sell or share any data with third parties.</li>
        <li>Ad metrics are fetched on demand for each report and are not warehoused beyond the run record.</li>
      </ul>

      <h2>Deleting your data</h2>
      <p>
        Removing a connection in the app deletes its stored token immediately.
        Removing the Metis AI app from your Facebook settings triggers Meta's
        data-deletion callback, which deletes every token tied to your
        Facebook account immediately. For full account deletion, email{" "}
        <a href="mailto:support@metis-ai.app">support@metis-ai.app</a>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:support@metis-ai.app">support@metis-ai.app</a>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Terms page (short, honest)**

```tsx
export const metadata = { title: "Terms of service — Metis AI" };

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem", lineHeight: 1.7 }}>
      <h1>Terms of service</h1>
      <p>Last updated: July 17, 2026</p>
      <ul>
        <li>Metis AI provides reporting on ad accounts you connect. You must have the right to access those accounts.</li>
        <li>Reports are AI-generated summaries of your data. Verify numbers before sharing externally; you are responsible for what you send to your clients.</li>
        <li>We may suspend accounts that abuse the service or Meta's platform terms.</li>
        <li>The service is provided as-is, without warranty. Liability is limited to the amount you paid us in the last 12 months.</li>
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Footer links.** Open `src/components/final-cta.tsx`, find the bottom-most container of the rendered footer/CTA block, and append (match surrounding class style):

```tsx
<p className="landing-footer-legal">
  <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/data-deletion">Data deletion</a>
</p>
```

If `final-cta.tsx` has no obvious footer area, add the links to `src/app/page.tsx` after the `<FinalCta />` usage instead. Style minimally; don't redesign.

- [ ] **Step 4: Build, commit**

```bash
npm run build
git add src/app/privacy/page.tsx src/app/terms/page.tsx src/components/final-cta.tsx
git commit -m "feat: privacy, terms, and data-deletion legal pages"
```

### Task 8: Health probe knows about OAuth env

**Files:**
- Modify: `src/app/api/health/route.ts`

- [ ] **Step 1: Add the four vars.** Open the file; it contains a list of required env names (around line 20, where `"OPENROUTER_API_KEY"` appears). Add, following the exact existing pattern:

```ts
"META_APP_ID",
"META_APP_SECRET",
"META_OAUTH_REDIRECT_URI",
```

Note: deliberately NOT adding `META_LOGIN_CONFIG_ID` — it's optional (scope fallback exists), and health should not fail on an optional var. If the file distinguishes required vs optional lists, put the config id in optional.

- [ ] **Step 2: Build, commit**

```bash
npm run build
git add src/app/api/health/route.ts
git commit -m "feat(health): probe Meta OAuth env vars"
```

### Task 9: Connections UI — Connect button, error copy, expiry state

**Files:**
- Create: `src/components/meta-connect-button.tsx`
- Modify: `src/app/app/connections/page.tsx`
- Modify: `src/components/connections-manager.tsx`
- Modify: `src/components/connections-list.tsx`

- [ ] **Step 1: The button component**

```tsx
export function MetaConnectButton({ label = "Connect with Meta" }: { label?: string }) {
  // Plain anchor: the whole flow is server-side redirects; no JS needed.
  return (
    <a className="product-button" href="/api/meta/oauth/start">
      {label}
    </a>
  );
}
```

- [ ] **Step 2: Error-slug copy map + page wiring.** In `src/app/app/connections/page.tsx`:
  - Extend `PageProps` searchParams to `{ firstrun?: string; oauth_error?: string }`.
  - Add above the component:

```ts
const OAUTH_ERROR_COPY: Record<string, string> = {
  denied: "You cancelled the Meta connect flow. Nothing was saved.",
  state_mismatch: "The connect flow expired or was tampered with. Try again.",
  exchange_failed: "Meta rejected the sign-in exchange. Try again in a minute.",
  no_accounts:
    "Your Meta login worked, but it can't see any ad accounts. Make sure the Facebook user has ad-account access.",
  save_failed: "Connected to Meta but saving failed on our side. Try again.",
  not_configured: "Meta connect isn't configured on this deployment yet.",
};
```

  - Resolve `const oauthError = params.oauth_error ? OAUTH_ERROR_COPY[params.oauth_error] ?? "Meta connect failed. Try again." : null;` and pass `oauthError` into `<ConnectionsManager />`.
  - Extend the `ConnectionRow` type and the select to include the new columns:

```ts
export type ConnectionRow = {
  id: string;
  label: string;
  account_count: number | null;
  last_synced_at: string | null;
  created_at: string;
  auth_method: "manual" | "oauth";
  token_expires_at: string | null;
};
```

```ts
.select("id, label, account_count, last_synced_at, created_at, auth_method, token_expires_at")
```

- [ ] **Step 3: Manager layout.** In `src/components/connections-manager.tsx`:
  - Add prop `oauthError: string | null` to `Props` and render an inline alert at the top when set (reuse whatever inline-error style `add-connection-form.tsx` uses — check it first):

```tsx
{oauthError ? <p className="form-error" role="alert">{oauthError}</p> : null}
```

  - Restructure the "add" panel so OAuth is primary and paste is demoted. Inside the `isFormOpen` GlassPanel, above the existing `<AddConnectionForm />`, insert:

```tsx
<div className="connect-oauth-block">
  <MetaConnectButton />
  <p className="connect-oauth-hint">
    Recommended: one click, read-only access, no token copying. You approve
    it on Meta's own screen.
  </p>
</div>
{manualOpen ? (
  <AddConnectionForm /* keep existing props exactly as they are */ />
) : (
  <button type="button" className="link-button" onClick={() => setManualOpen(true)}>
    Prefer to paste a token manually?
  </button>
)}
```

  with `const [manualOpen, setManualOpen] = useState(false);`. Import `MetaConnectButton`. Keep every existing prop and behavior of `AddConnectionForm` unchanged.

- [ ] **Step 4: Row expiry state.** In `src/components/connections-list.tsx`, inside each row's metadata area, add:

```tsx
{row.auth_method === "oauth" ? (
  <span className="connection-badge">
    {expiryLabel(row.token_expires_at)}
  </span>
) : null}
{row.auth_method === "oauth" && isExpiringSoon(row.token_expires_at) ? (
  <a className="link-button" href="/api/meta/oauth/start">Reconnect</a>
) : null}
```

with these helpers at the top of the file:

```ts
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function isExpiringSoon(iso: string | null): boolean {
  const d = daysUntil(iso);
  return d !== null && d <= 7;
}

function expiryLabel(iso: string | null): string {
  const d = daysUntil(iso);
  if (d === null) return "Connected via Meta";
  if (d < 0) return "Meta link expired";
  if (d <= 7) return `Meta link expires in ${d}d`;
  return "Connected via Meta";
}
```

- [ ] **Step 5: Build + lint, commit**

```bash
npm run build && npm run lint
git add src/components/meta-connect-button.tsx src/app/app/connections/page.tsx src/components/connections-manager.tsx src/components/connections-list.tsx
git commit -m "feat(connections): Connect-with-Meta primary flow, expiry badges, error copy"
```

### Task 10: The user's runbook — `docs/meta-app-setup.md`

**Files:**
- Create: `docs/meta-app-setup.md`

- [ ] **Step 1: Write the runbook.** It must contain, fully written out (no placeholders):
  1. **Create the app**: developers.facebook.com → My Apps → Create App → use case "Other" → type **Business** → name "Metis AI". 
  2. **Add Facebook Login for Business** product → Settings: Client OAuth Login ON, Web OAuth Login ON, Enforce HTTPS ON, Valid OAuth Redirect URIs = `https://metis-ai-nine.vercel.app/api/meta/oauth/callback`.
  3. **Create a Configuration** (Facebook Login for Business → Configurations → Create): token type **User access token**, permission `ads_read` → copy the Configuration ID.
  4. **App settings → Basic**: App Domains `metis-ai-nine.vercel.app`; Privacy Policy URL `https://metis-ai-nine.vercel.app/privacy`; Terms `https://metis-ai-nine.vercel.app/terms`; User data deletion → Data deletion callback URL `https://metis-ai-nine.vercel.app/api/meta/data-deletion`; Category "Business and pages".
  5. **Env table** (which value → which Vercel env, all three environments):

  | Vercel env var | Value | Where in dashboard |
  |---|---|---|
  | `META_APP_ID` | App ID | Settings → Basic |
  | `META_APP_SECRET` | App Secret (Show) | Settings → Basic |
  | `META_OAUTH_REDIRECT_URI` | `https://metis-ai-nine.vercel.app/api/meta/oauth/callback` | (fixed) |
  | `META_LOGIN_CONFIG_ID` | Configuration ID | FB Login for Business → Configurations |

  6. **Testers**: App Roles → add testers by FB username so pre-approval users can OAuth.
  7. **App Review submission text** — pre-drafted `ads_read` use-case paragraph (the agent writes the full paragraph in this doc: what Metis does, that access is read-only, exact steps a reviewer follows to test on the production URL with a test login the user provides).
  8. **Business Verification (India / GST) checklist**: business.facebook.com → Security Centre → Start Verification; legal name must exactly match the GST certificate; acceptable docs for India: GST registration certificate, plus utility bill or bank statement if asked; expect 2 days–2 weeks. **Reminder in bold: enter all documents directly into Meta's dashboard — never share them in chat or store them in the repo.**
  9. **What "waiting on Meta" looks like**: review status page, common rejection reasons and the fix for each.

- [ ] **Step 2: Commit**

```bash
git add docs/meta-app-setup.md
git commit -m "docs: meta app setup + review + business verification runbook"
```

### Task 11: Deploy + curl verification (gate G4)

- [ ] **Step 1: ASK THE USER** for deploy approval, then push the branch and deploy a preview (or straight to production if the user prefers — their call).
- [ ] **Step 2: Curl sweep against the deployed URL:**

```bash
BASE=https://metis-ai-nine.vercel.app
curl -s $BASE/api/health | jq            # meta env booleans true (after G2)
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "$BASE/api/meta/oauth/start"
# expect 307 → /login?next=/app/connections (no session)
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/privacy"        # 200
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/terms"          # 200
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/data-deletion"  # 200
curl -s -X POST "$BASE/api/meta/data-deletion" | jq             # 400 signed_request required
```

- [ ] **Step 3: One-shot screenshot** of `/app/connections` (preview_start → screenshot → preview_stop in the same turn) to confirm the Connect button renders.

### Task 12: User click-test (gate G5) + wrap-up

- [ ] **Step 1: Hand the user this exact 3-minute script:** sign in → Connections → Connect with Meta → approve on Meta's screen → expect to land on Reports with the new connection pre-selected and a "saved" toast → generate one report → check the connection row shows "Connected via Meta".
- [ ] **Step 2: Fix anything that surfaced; re-verify with the Task 11 curl sweep.**
- [ ] **Step 3: Docs wrap-up:** update `docs/handoff/HANDOFF.md` (what shipped) + `CHANGELOG.md` entry. Commit.
- [ ] **Step 4: Gate G6 — user submits App Review + Business Verification** using `docs/meta-app-setup.md` §7–8. Once submitted, this plan's definition of shipped is met: everything on our side done, waiting on Meta.

---

## Self-review notes

- Spec coverage: OAuth flow (T3–5), review prerequisites (T6–7), env probing (T8), UX (T9), user runbook + review text (T10), verification (T11–12). Compliance ladder fully covered.
- `STATE_COOKIE` exported from start route and imported in callback — one definition.
- `ConnectionRow` extension in T9 matches migration columns in T2 (`auth_method`, `token_expires_at`).
- Two spots require reading the real file before editing (admin client export name in T6; footer location in T7; inline-error class in T9) — flagged inline rather than guessed.

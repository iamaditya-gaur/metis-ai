import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-side helpers for the Meta OAuth code flow (Facebook Login for
 * Business). All env access is server-only — no NEXT_PUBLIC_* vars, so
 * nothing bakes at build time.
 *
 * Flow: /api/meta/oauth/start redirects to the dialog URL built here;
 * Meta redirects back with a one-time code; /api/meta/oauth/callback
 * exchanges it (short-lived → long-lived, ~60 days) and stores the token
 * encrypted in meta_connections.
 */

const GRAPH_BASE = "https://graph.facebook.com";
const DIALOG_BASE = "https://www.facebook.com";

/**
 * CSRF state cookie shared by the start + callback routes. Lives here (not
 * in a route file) because Next.js route modules may only export handlers.
 */
export const META_OAUTH_STATE_COOKIE = "metis.meta_oauth_state";

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
  // Business-type apps use a Facebook Login for Business configuration when
  // one exists; plain scope is the fallback so the flow still works before
  // the configuration is created in the Meta dashboard.
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
  // expires_in of 0 (or absent) means "no scheduled expiry" — store null.
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
  return JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { encryptSecretToBase64 } from "@/lib/crypto/token-encryption";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchMetaProfile,
  META_OAUTH_STATE_COOKIE,
} from "@/lib/meta/oauth";
import { getAccessibleAccounts } from "@/lib/metis/accounts";
import { createClient } from "@/lib/supabase/server";

function errorRedirect(request: Request, slug: string) {
  const target = new URL("/app/connections", request.url);
  target.searchParams.set("oauth_error", slug);
  return NextResponse.redirect(target);
}

/**
 * Lands here after the user approves (or cancels) on Meta's screen.
 * Mirrors the manual-paste flow in src/app/app/connections/actions.ts:
 * validate the token by listing ad accounts → encrypt → store → land on
 * /app/reports with the connection pre-selected and the "saved" toast.
 */
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
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(META_OAUTH_STATE_COOKIE)?.value;
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

  let parts: ReturnType<typeof encryptSecretToBase64>;
  try {
    parts = encryptSecretToBase64(accessToken);
  } catch {
    return errorRedirect(request, "save_failed");
  }

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

  // Reconnect = replace: one oauth row per (metis user, fb identity). RLS
  // scopes the lookup to the signed-in user automatically.
  const { data: existing } = await supabase
    .from("meta_connections")
    .select("id")
    .eq("fb_user_id", fbUserId)
    .eq("auth_method", "oauth")
    .maybeSingle();

  const query = existing
    ? supabase
        .from("meta_connections")
        .update(row)
        .eq("id", existing.id)
        .select("id")
        .single()
    : supabase.from("meta_connections").insert(row).select("id").single();
  const { data: saved, error } = await query;
  if (error || !saved) {
    return errorRedirect(request, "save_failed");
  }

  const target = new URL("/app/reports", request.url);
  target.searchParams.set("connection", saved.id);
  target.searchParams.set("saved", "1");
  const response = NextResponse.redirect(target);
  response.cookies.set(META_OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

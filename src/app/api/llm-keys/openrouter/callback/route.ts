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

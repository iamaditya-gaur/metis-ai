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

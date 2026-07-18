import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { buildAuthDialogUrl, META_OAUTH_STATE_COOKIE } from "@/lib/meta/oauth";
import { createClient } from "@/lib/supabase/server";

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
  response.cookies.set(META_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}

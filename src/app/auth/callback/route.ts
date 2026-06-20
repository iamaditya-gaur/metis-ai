import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Supabase email confirmation + magic link handler. Supabase redirects users
 * here after they click the confirm-email link with a `code` query param. We
 * exchange the code for a session, then forward them into the product.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/app/reports";

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const failure = new URL("/login", request.url);
    failure.searchParams.set("error", "confirmation-failed");
    return NextResponse.redirect(failure);
  }

  return NextResponse.redirect(new URL(next, request.url));
}

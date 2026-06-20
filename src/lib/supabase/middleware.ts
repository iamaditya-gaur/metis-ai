import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { readSupabaseEnvSafely } from "@/lib/supabase/env";

let warnedMissingEnv = false;

/**
 * Refreshes the Supabase auth session on every request that passes through
 * the Next.js middleware. Returns the current user (or null) plus the
 * NextResponse with refreshed cookies that the middleware must return.
 *
 * Callers decide what to do with `user === null` (redirect to login, allow,
 * etc.) — this helper does not enforce policy on its own.
 *
 * If env is missing we don't throw (would break every /app/* request) — we
 * return null user and log once so the operator sees the misconfiguration
 * in Vercel function logs instead of silent redirect loops.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = readSupabaseEnvSafely("anon");
  if (!env) {
    if (!warnedMissingEnv) {
      console.error(
        "[middleware] Supabase env vars missing. /app/* will redirect every request to /login. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in this environment.",
      );
      warnedMissingEnv = true;
    }
    return { response, user: null as null };
  }

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

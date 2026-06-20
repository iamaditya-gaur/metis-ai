/**
 * Single source of truth for required Supabase env vars.
 *
 * `vercel env pull` writes sensitive vars as empty strings locally, and a
 * silently empty value would otherwise pass `!url` checks. The trimmed-length
 * check below catches that case and the error message names the missing var
 * so future deploys fail loudly instead of producing opaque Next.js digests.
 */

export type SupabaseEnvKind = "anon" | "service-role";

export function requireSupabaseEnv(kind: SupabaseEnvKind): {
  url: string;
  key: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (url.length === 0) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL. Set it in Vercel for this environment and redeploy.",
    );
  }

  if (kind === "anon") {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
    if (key.length === 0) {
      throw new Error(
        "Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY. Set it in Vercel for this environment and redeploy.",
      );
    }
    return { url, key };
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (key.length === 0) {
    throw new Error(
      "Missing env: SUPABASE_SERVICE_ROLE_KEY. Set it in Vercel for this environment and redeploy.",
    );
  }
  return { url, key };
}

export function readSupabaseEnvSafely(kind: SupabaseEnvKind): {
  url: string;
  key: string;
} | null {
  try {
    return requireSupabaseEnv(kind);
  } catch {
    return null;
  }
}

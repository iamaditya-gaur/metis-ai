import { NextResponse } from "next/server";

/**
 * Cheap server-side readiness probe. Public callers receive one aggregate
 * boolean only; individual environment names and platform metadata stay
 * private.
 *
 * Usage: `curl https://<deploy>/api/health` and check `ok` is true.
 */
export const dynamic = "force-dynamic";

const REQUIRED_VARS = [
  // Supabase auth + DB
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  // App secrets
  "METIS_TOKEN_ENCRYPTION_KEY",
  // OpenRouter for reporting runs
  "OPENROUTER_API_KEY",
  // Admin gate for /admin/*
  "METIS_ADMIN_PASSWORD",
  "METIS_ADMIN_COOKIE_SECRET",
  // Origin for auth redirects
  "NEXT_PUBLIC_SITE_URL",
] as const;

function isPresent(name: string): boolean {
  const raw = process.env[name];
  return typeof raw === "string" && raw.trim().length > 0;
}

export async function GET() {
  const env: Record<string, boolean> = {};
  for (const name of REQUIRED_VARS) {
    env[name] = isPresent(name);
  }
  const allPresent = Object.values(env).every(Boolean);
  return NextResponse.json(
    { ok: allPresent },
    { status: allPresent ? 200 : 503 },
  );
}

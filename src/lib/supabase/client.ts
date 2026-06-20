import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseEnv } from "@/lib/supabase/env";

/**
 * Browser Supabase client. Reads anon key from public env and stores the
 * session in cookies so server components and route handlers can see it.
 *
 * Use this from "use client" components only.
 */
export function createClient() {
  const { url, key } = requireSupabaseEnv("anon");
  return createBrowserClient(url, key);
}

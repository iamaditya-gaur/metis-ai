import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Reads anon key from public env and stores the
 * session in cookies so server components and route handlers can see it.
 *
 * Use this from "use client" components only.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase public environment variables.");
  }

  return createBrowserClient(url, anonKey);
}

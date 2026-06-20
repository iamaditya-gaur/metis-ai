import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { requireSupabaseEnv } from "@/lib/supabase/env";

/**
 * Server Supabase client tied to the current request's cookie jar. Use this
 * inside server components, route handlers, and server actions to read the
 * signed-in user's session and run RLS-scoped queries on their behalf.
 *
 * Do NOT use this for service-role operations — use createAdminClient for
 * those (it bypasses RLS).
 */
export async function createClient() {
  const { url, key } = requireSupabaseEnv("anon");
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a server component where cookies cannot be mutated.
          // The session refresh will happen on the next middleware pass.
        }
      },
    },
  });
}

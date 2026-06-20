import { createClient } from "@supabase/supabase-js";

import { requireSupabaseEnv } from "@/lib/supabase/env";

export function createAdminClient() {
  const { url, key } = requireSupabaseEnv("service-role");
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

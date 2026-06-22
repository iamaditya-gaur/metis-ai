"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * Deletes a run from `metis_runs`. RLS scopes the delete to rows owned by
 * the signed-in user — the delete silently no-ops on rows the user can't
 * see. Revalidates the history list so the row disappears immediately.
 */
export async function deleteRunAction(formData: FormData): Promise<void> {
  const runId = String(formData.get("runId") ?? "").trim();
  if (!runId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("metis_runs").delete().eq("run_id", runId);
  revalidatePath("/app/history");
}

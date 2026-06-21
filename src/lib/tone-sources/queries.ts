import type { SupabaseClient } from "@supabase/supabase-js";

export type ToneSource = {
  id: string;
  label: string;
  content: string;
  charCount: number;
  lastUsedAt: string | null;
  createdAt: string;
};

type ToneSourceRow = {
  id: string;
  label: string;
  content: string;
  char_count: number;
  last_used_at: string | null;
  created_at: string;
};

function toToneSource(row: ToneSourceRow): ToneSource {
  return {
    id: row.id,
    label: row.label,
    content: row.content,
    charCount: row.char_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

export async function listToneSources(
  supabase: SupabaseClient,
  limit = 12,
): Promise<ToneSource[]> {
  const { data, error } = await supabase
    .from("meta_tone_sources")
    .select("id, label, content, char_count, last_used_at, created_at")
    .order("last_used_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(toToneSource);
}

export async function createToneSource(
  supabase: SupabaseClient,
  userId: string,
  input: { label: string; content: string },
): Promise<ToneSource> {
  const label = input.label.trim();
  const content = input.content.trim();
  if (!label) throw new Error("Tone source needs a label.");
  if (!content) throw new Error("Tone source needs content.");

  const { data, error } = await supabase
    .from("meta_tone_sources")
    .insert({
      user_id: userId,
      label,
      content,
      char_count: content.length,
    })
    .select("id, label, content, char_count, last_used_at, created_at")
    .single();

  if (error) throw error;
  return toToneSource(data as ToneSourceRow);
}

export async function touchToneSource(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("meta_tone_sources")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteToneSource(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("meta_tone_sources")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

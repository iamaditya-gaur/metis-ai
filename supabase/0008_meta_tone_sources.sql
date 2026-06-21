-- Reusable tone-context sources per user. A "tone source" is a past client
-- update, team message, or report snippet the user wants Metis to mirror in
-- the final client-style message — pasted into the studio or uploaded from
-- a .txt / .md file.
--
-- Stored in plaintext: the content is the user's own writing, not a secret.
-- The encryption boundary only applies to Meta access tokens (see
-- 0004_meta_connections.sql).
--
-- RLS scopes every row to its owning user. The service role bypasses RLS
-- for server-to-server reads when assembling the reporting payload.

create table if not exists public.meta_tone_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  content text not null,
  char_count integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz
);

-- Recent-first listing for the studio dropdown ("Use preset").
create index if not exists meta_tone_sources_user_recent_idx
  on public.meta_tone_sources (user_id, last_used_at desc nulls last, created_at desc);

alter table public.meta_tone_sources enable row level security;

drop policy if exists "meta_tone_sources_select_own" on public.meta_tone_sources;
create policy "meta_tone_sources_select_own" on public.meta_tone_sources
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "meta_tone_sources_insert_own" on public.meta_tone_sources;
create policy "meta_tone_sources_insert_own" on public.meta_tone_sources
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "meta_tone_sources_update_own" on public.meta_tone_sources;
create policy "meta_tone_sources_update_own" on public.meta_tone_sources
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "meta_tone_sources_delete_own" on public.meta_tone_sources;
create policy "meta_tone_sources_delete_own" on public.meta_tone_sources
  for delete to authenticated
  using (auth.uid() = user_id);

comment on table public.meta_tone_sources is
  'Per-user reusable tone-context sources. Plaintext (user-authored). Surfaced in the reporting studio via the "Use preset" dropdown.';

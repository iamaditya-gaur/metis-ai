-- Per-user saved Meta access tokens. The plaintext token never lives in the
-- database — the application encrypts it with AES-256-GCM using a server-only
-- key (METIS_TOKEN_ENCRYPTION_KEY) before insert and decrypts on read.
--
-- A user can have multiple connections (e.g. one per agency client). label
-- is whatever the user chose to call this connection; account_count and
-- last_synced_at are cached display data refreshed after each Meta API call.
--
-- RLS keeps every row strictly scoped to its owning user. The service role
-- bypasses RLS for server-to-server use (token decryption + reporting runs).

create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  ciphertext bytea not null,
  iv bytea not null,
  auth_tag bytea not null,
  account_count integer,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists meta_connections_user_idx
  on public.meta_connections (user_id, created_at desc);

alter table public.meta_connections enable row level security;

drop policy if exists "meta_connections_select_own" on public.meta_connections;
create policy "meta_connections_select_own" on public.meta_connections
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "meta_connections_insert_own" on public.meta_connections;
create policy "meta_connections_insert_own" on public.meta_connections
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "meta_connections_update_own" on public.meta_connections;
create policy "meta_connections_update_own" on public.meta_connections
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "meta_connections_delete_own" on public.meta_connections;
create policy "meta_connections_delete_own" on public.meta_connections
  for delete to authenticated
  using (auth.uid() = user_id);

comment on table public.meta_connections is
  'Per-user encrypted Meta access tokens. Plaintext never stored; AES-256-GCM ciphertext/iv/auth_tag with key in METIS_TOKEN_ENCRYPTION_KEY env.';

-- Per-user encrypted LLM API keys (BYOK). One key per user (unique user_id);
-- provider says which API it belongs to. Plaintext never stored: AES-256-GCM
-- via METIS_TOKEN_ENCRYPTION_KEY, base64 text columns (same pattern as
-- meta_connections after 0007). last_four is display-only.

create table if not exists public.llm_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('openrouter', 'openai')),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  last_four text not null,
  last_validated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id)
);

alter table public.llm_keys enable row level security;

drop policy if exists "llm_keys_select_own" on public.llm_keys;
create policy "llm_keys_select_own" on public.llm_keys
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "llm_keys_insert_own" on public.llm_keys;
create policy "llm_keys_insert_own" on public.llm_keys
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "llm_keys_update_own" on public.llm_keys;
create policy "llm_keys_update_own" on public.llm_keys
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "llm_keys_delete_own" on public.llm_keys;
create policy "llm_keys_delete_own" on public.llm_keys
  for delete to authenticated using (auth.uid() = user_id);

comment on table public.llm_keys is
  'Per-user encrypted BYOK LLM API keys. AES-256-GCM; key in METIS_TOKEN_ENCRYPTION_KEY.';

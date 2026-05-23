-- Adds the nullable user_id column to public.metis_runs so the schema is
-- ready to scope runs per authenticated user once Supabase Auth lands.
-- Null today; populated when the auth flow ships. Admin observability view
-- continues to see every row regardless of user_id.
--
-- Safe to re-apply (uses `if not exists`). Already applied to the live
-- project; this file exists for reproducibility on fresh Supabase setups.

alter table public.metis_runs
  add column if not exists user_id text;

create index if not exists metis_runs_user_started_idx
  on public.metis_runs (user_id, started_at desc);

comment on column public.metis_runs.user_id is
  'Future user-scoping. Null today; populated once Supabase Auth is wired.';

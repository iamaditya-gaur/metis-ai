-- The metis_runs.user_id column was reserved in 0002 for this moment. Now
-- that Supabase Auth is wired, let signed-in users SELECT their own runs.
-- INSERT continues to happen exclusively via the service role (server-side
-- reporting workflow), so no insert/update/delete policies for end users.
--
-- The column type is text (not uuid) for legacy reasons — cast auth.uid()
-- to text in the policy. New rows written after this migration should set
-- user_id = auth.uid()::text for owned runs, or leave null for the public
-- /reporting demo flow.

drop policy if exists "metis_runs_select_own" on public.metis_runs;
create policy "metis_runs_select_own" on public.metis_runs
  for select to authenticated
  using (user_id is not null and user_id = auth.uid()::text);

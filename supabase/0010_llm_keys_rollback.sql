-- Rollback for 0010_llm_keys.sql. BYOK is additive and reversible: dropping the
-- table removes all stored (encrypted) user keys and its RLS policies. After
-- this runs, authed report runs fall back to the friendly "connect a key" CTA
-- only if the app code is also reverted; with BYOK code still deployed, no key
-- rows means every authed run returns the 402 CTA. Run this ONLY when fully
-- backing BYOK out.

drop table if exists public.llm_keys cascade;

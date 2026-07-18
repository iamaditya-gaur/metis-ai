-- ROLLBACK for 0009_meta_connections_oauth.sql.
-- Only run this if we decide to abandon Meta OAuth entirely and want the
-- schema back exactly as it was. It is NOT part of normal cleanup: the four
-- columns are the permanent OAuth feature schema and should stay once OAuth
-- ships. Dropping them is safe because the manual-paste flow never used them.
--
-- This does NOT touch any manual-paste connection rows — those live in the
-- original columns (label, ciphertext, iv, auth_tag) and are untouched here.

drop index if exists public.meta_connections_fb_user_idx;

alter table public.meta_connections
  drop constraint if exists meta_connections_auth_method_check;

alter table public.meta_connections
  drop column if exists granted_scopes,
  drop column if exists fb_user_id,
  drop column if exists token_expires_at,
  drop column if exists auth_method;

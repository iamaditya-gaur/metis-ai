-- OAuth support for meta_connections. Existing rows are manual paste
-- (auth_method backfills to 'manual' via the column default).
-- token_expires_at: long-lived token expiry (~60d) for oauth rows; null for
-- manual rows and for tokens Meta reports as non-expiring (expires_in 0).
-- fb_user_id: the Facebook user who granted access — used for reconnect
-- upserts and for Meta's data-deletion callback.

alter table public.meta_connections
  add column if not exists auth_method text not null default 'manual',
  add column if not exists token_expires_at timestamptz,
  add column if not exists fb_user_id text,
  add column if not exists granted_scopes text;

alter table public.meta_connections
  drop constraint if exists meta_connections_auth_method_check;
alter table public.meta_connections
  add constraint meta_connections_auth_method_check
  check (auth_method in ('manual', 'oauth'));

create index if not exists meta_connections_fb_user_idx
  on public.meta_connections (fb_user_id);

comment on column public.meta_connections.token_expires_at is
  'Long-lived token expiry (oauth connections only; ~60 days from issue; null = no scheduled expiry).';

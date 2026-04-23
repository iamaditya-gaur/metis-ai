create table if not exists public.waitlist_signups (
  id bigint generated always as identity primary key,
  email text not null,
  source text not null default 'landing-page',
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists waitlist_signups_email_unique
  on public.waitlist_signups (lower(email));

alter table public.waitlist_signups enable row level security;

comment on table public.waitlist_signups is
  'Stores waitlist signups submitted from the Meta Ads Agent landing page.';

-- Run in BOH-DEV first. Chunk 1 of 4: investor request table/schema.
alter table public.cellar_investor_access
  drop constraint if exists cellar_investor_access_access_status_check;

alter table public.cellar_investor_access
  add constraint cellar_investor_access_access_status_check
  check (access_status in (
    'guest',
    'verification_pending',
    'verified',
    'appendix_requested',
    'appendix_granted',
    'paused',
    'revoked'
  ));

create table if not exists public.cellar_investor_profiles (
  id uuid primary key default gen_random_uuid(),
  investor_access_id uuid not null references public.cellar_investor_access(id) on delete cascade,
  patron_person_id uuid,
  auth_user_id uuid references auth.users(id) on delete set null,
  email text not null,
  first_name text not null,
  last_name text not null,
  investor_category text not null check (investor_category in ('individual', 'angel', 'fund', 'family_office', 'strategic', 'advisor', 'other')),
  title text,
  company text,
  profile_status text not null default 'verification_pending' check (profile_status in ('verification_pending', 'verified', 'needs_more_info', 'rejected', 'archived')),
  consent_metadata jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_boh_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cellar_investor_profiles_email_not_blank check (position('@' in email) > 1),
  constraint cellar_investor_profiles_first_name_not_blank check (length(trim(first_name)) > 0),
  constraint cellar_investor_profiles_last_name_not_blank check (length(trim(last_name)) > 0)
);

comment on table public.cellar_investor_profiles is
  'CELLAR investor-specific profile/intake data. Auth user identity and access entitlements stay separate.';
comment on column public.cellar_investor_profiles.investor_access_id is
  'Links profile details to the CELLAR access entitlement record.';
comment on column public.cellar_investor_profiles.profile_status is
  'Profile review state; email OTP alone should leave this at verification_pending.';

do $$
begin
  if to_regclass('public.patron_person') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'cellar_investor_profiles_patron_person_id_fkey'
        and conrelid = 'public.cellar_investor_profiles'::regclass
    )
  then
    alter table public.cellar_investor_profiles
      add constraint cellar_investor_profiles_patron_person_id_fkey
      foreign key (patron_person_id)
      references public.patron_person(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists cellar_investor_profiles_access_id_idx
  on public.cellar_investor_profiles (investor_access_id);
create index if not exists cellar_investor_profiles_auth_user_id_idx
  on public.cellar_investor_profiles (auth_user_id);
create index if not exists cellar_investor_profiles_email_lower_idx
  on public.cellar_investor_profiles (lower(email));
create index if not exists cellar_investor_profiles_status_idx
  on public.cellar_investor_profiles (profile_status, submitted_at desc);

drop trigger if exists cellar_investor_profiles_touch_updated_at on public.cellar_investor_profiles;
create trigger cellar_investor_profiles_touch_updated_at
  before update on public.cellar_investor_profiles
  for each row execute function public.cellar_touch_updated_at();

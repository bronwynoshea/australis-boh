-- External Patron access bridge for BOH-owned Loft.
-- Enables Talent/JOBZCAFE® server-to-server APIs to authorize external users
-- through Patron identity without granting broad BOH browser access.

begin;

alter table public.loft_video_session
  add column if not exists host_patron_person_id uuid references public.patron_person(id) on delete set null;

comment on column public.loft_video_session.host_patron_person_id is
  'External Patron person acting as session host, for Talent recruiters/coaches who are not BOH auth users. BOH users should continue using host_boh_user_id.';

comment on column public.loft_video_session.patron_person_id is
  'Primary external participant Patron person, typically job seeker/candidate/coachee.';

create index if not exists loft_video_session_host_patron_person_idx
  on public.loft_video_session(host_patron_person_id)
  where host_patron_person_id is not null;

create table if not exists public.loft_external_profile_link (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  patron_person_id uuid not null references public.patron_person(id) on delete cascade,
  patron_organisation_id uuid references public.patron_organisation(id) on delete set null,

  profile_id uuid not null references public.profile(id) on delete cascade,

  app_context text not null check (app_context in ('cafe', 'talent', 'journey', 'coach')),
  persona text not null check (persona in ('job_seeker', 'recruiter', 'coach', 'staff', 'guest')),

  external_auth_user_id text,
  external_profile_id text,
  primary_email text,
  display_name text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, patron_person_id, app_context)
);

comment on table public.loft_external_profile_link is
  'BOH-owned bridge from Patron Person identities to Loft compatibility profile rows for external JOBZCAFE®/Talent users.';

create unique index if not exists loft_external_profile_link_profile_uidx
  on public.loft_external_profile_link(profile_id);

create index if not exists loft_external_profile_link_patron_person_idx
  on public.loft_external_profile_link(patron_person_id);

create index if not exists loft_external_profile_link_external_auth_idx
  on public.loft_external_profile_link(app_context, external_auth_user_id)
  where external_auth_user_id is not null;

create or replace function public.set_loft_external_profile_link_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_loft_external_profile_link_updated_at
  on public.loft_external_profile_link;

create trigger trg_loft_external_profile_link_updated_at
before update on public.loft_external_profile_link
for each row
execute function public.set_loft_external_profile_link_updated_at();

alter table public.loft_external_profile_link enable row level security;

revoke all on public.loft_external_profile_link from anon;
revoke all on public.loft_external_profile_link from authenticated;

commit;

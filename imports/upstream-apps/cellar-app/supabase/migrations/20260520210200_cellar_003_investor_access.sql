-- CELLAR investor/patron linkage placeholders. Supabase Auth is authentication only.
create table if not exists public.cellar_investor_access (
  id uuid primary key default gen_random_uuid(),
  patron_crm_id text,
  auth_user_id uuid references auth.users(id) on delete set null,
  email text not null,
  full_name text,
  company text,
  title text,
  source_access_code_id uuid references public.cellar_guest_access_codes(id) on delete set null,
  access_status text not null default 'guest' check (access_status in ('guest', 'verified', 'appendix_requested', 'appendix_granted', 'paused', 'revoked')),
  pipeline_status text not null default 'guest_reviewing',
  investor_segment text,
  verified_at timestamptz,
  last_seen_at timestamptz,
  consent_metadata jsonb not null default '{}'::jsonb,
  assigned_boh_user_id text,
  created_by_boh_user_id text,
  updated_by_boh_user_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cellar_investor_access_email_not_blank check (length(trim(email)) > 0)
);

comment on table public.cellar_investor_access is
  'CELLAR investor/patron access linkage. Authorization lives here and in BOH records, not in Supabase Auth users.';
comment on column public.cellar_investor_access.patron_crm_id is
  'Nullable text placeholder for JOBZCAFE® patron CRM id; add typed FK after BOH-DEV confirms table/key.';
comment on column public.cellar_investor_access.assigned_boh_user_id is
  'Stores public.boh_user.id for assigned staff contact; add typed FK after BOH-DEV confirms id type.';

create unique index if not exists cellar_investor_access_email_lower_idx
  on public.cellar_investor_access (lower(email));
create index if not exists cellar_investor_access_auth_user_id_idx
  on public.cellar_investor_access (auth_user_id);
create index if not exists cellar_investor_access_patron_crm_id_idx
  on public.cellar_investor_access (patron_crm_id);
create index if not exists cellar_investor_access_status_idx
  on public.cellar_investor_access (access_status, pipeline_status);

drop trigger if exists cellar_investor_access_touch_updated_at on public.cellar_investor_access;
create trigger cellar_investor_access_touch_updated_at
  before update on public.cellar_investor_access
  for each row execute function public.cellar_touch_updated_at();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cellar_investor_sessions_access_fkey') then
    alter table public.cellar_investor_sessions
      add constraint cellar_investor_sessions_access_fkey
      foreign key (investor_access_id) references public.cellar_investor_access(id) on delete set null;
  end if;
end $$;

create or replace function public.cellar_is_verified_investor(p_investor_access_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cellar_investor_access as cia
    where cia.id = p_investor_access_id
      and cia.auth_user_id = auth.uid()
      and cia.access_status in ('verified', 'appendix_requested', 'appendix_granted')
  )
$$;

create or replace function public.cellar_current_investor_access_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cia.access_status
  from public.cellar_investor_access as cia
  where cia.auth_user_id = auth.uid()
    and cia.access_status in ('verified', 'appendix_requested', 'appendix_granted')
  order by cia.verified_at desc nulls last, cia.created_at desc
  limit 1
$$;

create or replace function public.cellar_has_verified_investor_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.cellar_current_investor_access_status() is not null
$$;

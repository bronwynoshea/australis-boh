-- Loft BOH-dev additive schema and app registry bridge.
--
-- This migration intentionally keeps the existing Loft Edge Functions on their
-- legacy public.profile ownership model as a transition boundary. BOH app data
-- should move to public.boh_user ownership in a later reviewed migration once
-- the canonical Loft schema/source repo is confirmed.

begin;

-- Legacy profile columns referenced by the existing BOH Loft functions.
alter table if exists public.profile
  add column if not exists personal_room_id uuid,
  add column if not exists can_use_personal_room boolean not null default false,
  add column if not exists personal_room_slug text,
  add column if not exists personal_room_public boolean not null default false,
  add column if not exists can_host_loft boolean not null default false,
  add column if not exists is_loft_admin boolean not null default false,
  add column if not exists loft_orientation_completed_at timestamptz,
  add column if not exists background_mode text;

create unique index if not exists profile_personal_room_slug_idx
  on public.profile (lower(personal_room_slug))
  where personal_room_slug is not null;

create table if not exists public.loft_room (
  id uuid primary key default gen_random_uuid(),
  app_context text not null default 'boh',
  host_profile_id uuid references public.profile(id) on delete set null,
  title text not null,
  description text,
  visibility text not null default 'unlisted' check (visibility in ('public', 'unlisted', 'private')),
  is_recorded boolean not null default true,
  tags text[] not null default '{}'::text[],
  daily_room_name text not null unique,
  invite_code text unique,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'deleted')),
  is_open boolean not null default false,
  opened_at timestamptz,
  started_at timestamptz,
  scheduled_start_at timestamptz,
  scheduled_tz text not null default 'UTC',
  max_participants integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loft_room_host_profile_id_idx on public.loft_room(host_profile_id);
create index if not exists loft_room_status_idx on public.loft_room(status);
create index if not exists loft_room_invite_code_idx on public.loft_room(invite_code);

do $$
begin
  if to_regclass('public.profile') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'profile_personal_room_id_fkey'
         and conrelid = 'public.profile'::regclass
     ) then
    alter table public.profile
      add constraint profile_personal_room_id_fkey
      foreign key (personal_room_id) references public.loft_room(id)
      on delete set null
      not valid;
  end if;

  begin
    alter table public.profile validate constraint profile_personal_room_id_fkey;
  exception
    when undefined_table or undefined_object then
      null;
    when others then
      raise notice 'profile_personal_room_id_fkey left not valid for BOH-dev cleanup: %', sqlerrm;
  end;
end $$;

create table if not exists public.loft_room_member (
  id uuid primary key default gen_random_uuid(),
  loft_room_id uuid not null references public.loft_room(id) on delete cascade,
  profile_id uuid not null references public.profile(id) on delete cascade,
  role text not null default 'listener' check (role in ('host', 'speaker', 'listener', 'moderator')),
  is_hand_raised boolean not null default false,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (loft_room_id, profile_id)
);

create index if not exists loft_room_member_profile_id_idx on public.loft_room_member(profile_id);

create table if not exists public.loft_room_waitlist (
  id uuid primary key default gen_random_uuid(),
  loft_room_id uuid not null references public.loft_room(id) on delete cascade,
  guest_name text not null,
  guest_email text,
  guest_avatar_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profile(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  unique (loft_room_id, guest_email)
);

create index if not exists loft_room_waitlist_room_status_idx
  on public.loft_room_waitlist(loft_room_id, status);

create table if not exists public.loft_room_join_logs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.loft_room(id) on delete set null,
  join_type text not null,
  guest_name text,
  slug_used text,
  ip_address text,
  user_agent text,
  joined_at timestamptz not null default now()
);

create index if not exists loft_room_join_logs_room_id_idx on public.loft_room_join_logs(room_id);
create index if not exists loft_room_join_logs_joined_at_idx on public.loft_room_join_logs(joined_at desc);

create table if not exists public.loft_room_rsvp (
  id uuid primary key default gen_random_uuid(),
  loft_room_id uuid not null references public.loft_room(id) on delete cascade,
  profile_id uuid not null references public.profile(id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'interested', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loft_room_id, profile_id)
);

create table if not exists public.loft_question (
  id uuid primary key default gen_random_uuid(),
  app_context text not null default 'boh',
  loft_room_id uuid references public.loft_room(id) on delete cascade,
  asker_profile_id uuid references public.profile(id) on delete set null,
  is_anonymous boolean not null default false,
  source text not null default 'loft',
  question_text text not null,
  status text not null default 'submitted' check (status in ('submitted', 'answered', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lock Loft into BOH's internal app registry in BOH-dev.
insert into public.boh_app (
  id,
  name,
  slug,
  description,
  route,
  external_url,
  primary_color,
  type,
  is_active,
  app_context,
  created_at
)
values (
  gen_random_uuid(),
  'Loft',
  'loft',
  'Meetings, Personal Rooms, guest waitlists, and video collaboration.',
  '/loft',
  null,
  null,
  'internal_tool',
  true,
  'boh',
  now()
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    route = excluded.route,
    external_url = null,
    type = 'internal_tool',
    is_active = true,
    app_context = 'boh';

commit;

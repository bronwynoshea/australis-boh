-- Complete Loft BOH-dev parity for Personal Rooms plus Clubhouse-style group sessions.
-- Additive migration: extends the transitional public.profile-owned Loft schema
-- used by the imported Loft app and Edge Functions.

begin;

-- Group sessions: recurrence, ending/cleanup, public access metadata.
alter table if exists public.loft_room
  add column if not exists recurrence_type text,
  add column if not exists recurrence_end_date timestamptz,
  add column if not exists recurrence_parent_id uuid references public.loft_room(id) on delete set null,
  add column if not exists ended_at timestamptz,
  add column if not exists scheduled_delete_at timestamptz,
  add column if not exists access_mode text not null default 'host_approval',
  add column if not exists scheduled_open_at timestamptz,
  add column if not exists scheduled_close_at timestamptz,
  add column if not exists public_join_enabled boolean not null default false,
  add column if not exists recording_url text,
  add column if not exists participant_count integer not null default 0;

create index if not exists loft_room_scheduled_start_at_idx on public.loft_room(scheduled_start_at);
create index if not exists loft_room_ended_at_idx on public.loft_room(ended_at);
create index if not exists loft_room_recurrence_parent_id_idx on public.loft_room(recurrence_parent_id);

do $$
begin
  if to_regclass('public.loft_room') is not null then
    alter table public.loft_room drop constraint if exists loft_room_status_check;
    alter table public.loft_room
      add constraint loft_room_status_check
      check (status in ('scheduled', 'live', 'ended', 'deleted'));

    alter table public.loft_room drop constraint if exists loft_room_visibility_check;
    alter table public.loft_room
      add constraint loft_room_visibility_check
      check (visibility in ('public', 'unlisted', 'private'));
  end if;
end $$;

-- Clubhouse controls: stage roles, active membership, hand-raise queue.
alter table if exists public.loft_room_member
  add column if not exists hand_raised_at timestamptz,
  add column if not exists is_active boolean not null default true,
  add column if not exists left_at timestamptz;

create index if not exists loft_room_member_room_active_idx on public.loft_room_member(loft_room_id, is_active);
create index if not exists loft_room_member_hand_raised_idx on public.loft_room_member(loft_room_id, hand_raised_at) where hand_raised_at is not null;

do $$
begin
  if to_regclass('public.loft_room_member') is not null then
    alter table public.loft_room_member drop constraint if exists loft_room_member_role_check;
    alter table public.loft_room_member
      add constraint loft_room_member_role_check
      check (role in ('host', 'cohost', 'speaker', 'listener', 'moderator'));
  end if;
end $$;

-- Personal-room guest waitlist compatibility.
alter table if exists public.loft_room_waitlist
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists user_id uuid,
  add column if not exists background_mode text;

create index if not exists loft_room_waitlist_user_id_idx on public.loft_room_waitlist(user_id);
create index if not exists loft_room_waitlist_room_user_idx on public.loft_room_waitlist(loft_room_id, user_id);
create index if not exists loft_room_waitlist_room_guest_name_idx on public.loft_room_waitlist(loft_room_id, lower(guest_name));

create or replace function public.update_waitlist_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_waitlist_updated_at on public.loft_room_waitlist;
create trigger update_waitlist_updated_at
  before update on public.loft_room_waitlist
  for each row
  execute function public.update_waitlist_updated_at();

-- RSVP question compatibility: imported loft-rsvp inserts status = 'pending'.
do $$
begin
  if to_regclass('public.loft_question') is not null then
    alter table public.loft_question drop constraint if exists loft_question_status_check;
    alter table public.loft_question
      add constraint loft_question_status_check
      check (status in ('pending', 'submitted', 'answered', 'dismissed'));
  end if;
end $$;

-- Host application workflow for non-host users to request group-session hosting.
create table if not exists public.host_application (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  application_reason text,
  experience_description text,
  topics_to_host text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profile(id) on delete set null,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists host_application_profile_id_idx on public.host_application(profile_id);
create index if not exists host_application_status_idx on public.host_application(status);
create unique index if not exists host_application_one_pending_per_profile_idx
  on public.host_application(profile_id)
  where status = 'pending';

create or replace function public.update_host_application_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_host_application_updated_at on public.host_application;
create trigger update_host_application_updated_at
  before update on public.host_application
  for each row
  execute function public.update_host_application_updated_at();

-- RPC used by the imported Loft shell to decide whether to show the host-application CTA.
create or replace function public.get_my_host_application_status()
returns table (
  id uuid,
  status text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  admin_notes text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid;
begin
  select p.id into current_profile_id
  from public.profile p
  where p.user_id = auth.uid()
  limit 1;

  if current_profile_id is null then
    return;
  end if;

  return query
  select h.id, h.status, h.submitted_at, h.reviewed_at, h.admin_notes
  from public.host_application h
  where h.profile_id = current_profile_id
  order by h.submitted_at desc
  limit 1;
end;
$$;

-- RPC used by the imported admin review UI.
create or replace function public.get_host_applications(filter_status text default 'all')
returns table (
  id uuid,
  profile_id uuid,
  status text,
  application_reason text,
  experience_description text,
  topics_to_host text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_notes text,
  profile jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_is_admin boolean := false;
begin
  select coalesce(p.is_loft_admin, false) or coalesce(p.user_type_id = 5, false)
  into requester_is_admin
  from public.profile p
  where p.user_id = auth.uid()
  limit 1;

  if not coalesce(requester_is_admin, false) then
    return;
  end if;

  return query
  select
    h.id,
    h.profile_id,
    h.status,
    h.application_reason,
    h.experience_description,
    h.topics_to_host,
    h.submitted_at,
    h.reviewed_at,
    h.reviewed_by,
    h.admin_notes,
    jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'full_name', p.full_name,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'email', p.email,
      'avatar_url', p.avatar_url
    ) as profile
  from public.host_application h
  join public.profile p on p.id = h.profile_id
  where filter_status is null
     or lower(filter_status) in ('all', '')
     or h.status = lower(filter_status)
  order by h.submitted_at desc;
end;
$$;

grant execute on function public.get_my_host_application_status() to authenticated;
grant execute on function public.get_host_applications(text) to authenticated;

-- Compatibility RPCs used by older Personal Room code paths. Edge Functions are
-- still the primary BOH integration surface, but these keep the imported app whole.
create or replace function public.request_personal_room_access(
  p_slug text,
  p_guest_name text,
  p_guest_email text default null,
  p_background_mode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
  inserted_id uuid;
begin
  select lr.id into target_room_id
  from public.profile p
  join public.loft_room lr on lr.id = p.personal_room_id
  where lower(p.personal_room_slug) = lower(p_slug)
     or lower(lr.invite_code) = lower(p_slug)
  limit 1;

  if target_room_id is null then
    return jsonb_build_object('success', false, 'error', 'room_not_found');
  end if;

  insert into public.loft_room_waitlist (loft_room_id, guest_name, guest_email, background_mode, status)
  values (target_room_id, p_guest_name, p_guest_email, p_background_mode, 'pending')
  on conflict do nothing
  returning id into inserted_id;

  return jsonb_build_object('success', true, 'roomId', target_room_id, 'waitlistEntryId', inserted_id);
end;
$$;

create or replace function public.check_guest_waitlist_status(
  p_slug text,
  p_guest_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
  waitlist_row public.loft_room_waitlist%rowtype;
begin
  select lr.id into target_room_id
  from public.profile p
  join public.loft_room lr on lr.id = p.personal_room_id
  where lower(p.personal_room_slug) = lower(p_slug)
     or lower(lr.invite_code) = lower(p_slug)
  limit 1;

  if target_room_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into waitlist_row
  from public.loft_room_waitlist w
  where w.loft_room_id = target_room_id
    and lower(w.guest_name) = lower(p_guest_name)
  order by w.requested_at desc
  limit 1;

  if waitlist_row.id is null then
    return jsonb_build_object('status', 'none', 'roomId', target_room_id);
  end if;

  return jsonb_build_object('status', waitlist_row.status, 'roomId', target_room_id, 'waitlistEntryId', waitlist_row.id);
end;
$$;

grant execute on function public.request_personal_room_access(text, text, text, text) to anon, authenticated;
grant execute on function public.check_guest_waitlist_status(text, text) to anon, authenticated;

commit;

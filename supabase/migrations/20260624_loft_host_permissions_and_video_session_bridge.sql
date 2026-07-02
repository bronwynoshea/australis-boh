-- Loft host-room permissions and JOBZCAFE® business video-session bridge.
--
-- Product rules captured from the Loft/JOBZCAFE architecture discussion:
-- - Staff/recruiters may have reusable Personal Rooms when explicitly granted.
-- - Job seekers/community users may apply to host Clubhouse-style rooms, but they
--   do not receive Personal Rooms from that host approval alone.
-- - Business tracking for interviews/appointments/coaching belongs in BOH/Talent,
--   not in loft_room.

begin;

-- Host applications are the moderation/eligibility flow for user-generated
-- Clubhouse-style rooms. Keep the original columns, but add enough metadata for
-- reviewers to distinguish recruiter/job-seeker/community host intent.
alter table if exists public.host_application
  add column if not exists applicant_persona text,
  add column if not exists requested_host_scope text not null default 'user_generated',
  add column if not exists requested_audience text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if to_regclass('public.host_application') is not null then
    alter table public.host_application drop constraint if exists host_application_requested_host_scope_check;
    alter table public.host_application
      add constraint host_application_requested_host_scope_check
      check (requested_host_scope in ('user_generated', 'official_business', 'personal_room'));
  end if;
end $$;

comment on column public.host_application.requested_host_scope is
  'Requested host permission scope. user_generated means Clubhouse-style room creation; personal_room is reviewed separately and should be limited to staff/recruiters.';

-- Optional room-origin metadata for future moderation/reporting. Existing rows
-- remain compatible. Personal rooms are marked by function code/tags and can be
-- backfilled later if needed.
alter table if exists public.loft_room
  add column if not exists room_origin text not null default 'user_generated',
  add column if not exists business_context text;

do $$
begin
  if to_regclass('public.loft_room') is not null then
    alter table public.loft_room drop constraint if exists loft_room_room_origin_check;
    alter table public.loft_room
      add constraint loft_room_room_origin_check
      check (room_origin in ('official', 'business', 'user_generated', 'personal'));
  end if;
end $$;

create index if not exists loft_room_room_origin_idx on public.loft_room(room_origin);

-- Keep host application review RPC aligned with the added moderation metadata.
drop function if exists public.get_host_applications(text);
create function public.get_host_applications(filter_status text default 'all')
returns table (
  id uuid,
  profile_id uuid,
  status text,
  application_reason text,
  experience_description text,
  topics_to_host text,
  applicant_persona text,
  requested_host_scope text,
  requested_audience text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_notes text,
  applicant_name text,
  applicant_email text,
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
    h.applicant_persona,
    h.requested_host_scope,
    h.requested_audience,
    h.submitted_at,
    h.reviewed_at,
    h.reviewed_by,
    h.admin_notes,
    coalesce(p.display_name, p.full_name, trim(concat_ws(' ', p.first_name, p.last_name)), p.email, 'Unknown User') as applicant_name,
    p.email as applicant_email,
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

grant execute on function public.get_host_applications(text) to authenticated;

-- JOBZCAFE®/BOH/Talent bridge for business video sessions that use Loft.
create table if not exists public.loft_video_session (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  app_context text not null default 'boh',
  source_app text,

  loft_room_id uuid references public.loft_room(id) on delete set null,

  business_context text not null,
  business_record_table text,
  business_record_id uuid,

  host_boh_user_id uuid references public.boh_user(id) on delete set null,
  patron_person_id uuid references public.patron_person(id) on delete set null,
  patron_organisation_id uuid references public.patron_organisation(id) on delete set null,

  participant_name text,
  participant_email text,

  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,

  join_url text,
  invite_code text,

  message_status text not null default 'not_sent',
  status text not null default 'scheduled',
  outcome text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,

  link_sent_at timestamptz,
  first_joined_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  no_show_marked_at timestamptz,

  created_by uuid references public.boh_user(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint loft_video_session_business_context_check
    check (business_context in ('interview', 'coaching', 'onboarding', 'appointment', 'group_session', 'internal_meeting', 'other')),
  constraint loft_video_session_message_status_check
    check (message_status in ('not_sent', 'queued', 'sent', 'failed', 'cancelled')),
  constraint loft_video_session_status_check
    check (status in ('scheduled', 'link_sent', 'waiting', 'joined', 'completed', 'cancelled', 'no_show'))
);

comment on table public.loft_video_session is
  'BOH/Talent-owned business bridge for interviews, appointments, coaching, onboarding, and other JOBZCAFE® workflows that use Loft rooms.';

create index if not exists loft_video_session_tenant_status_idx
  on public.loft_video_session(tenant_id, status);
create index if not exists loft_video_session_loft_room_id_idx
  on public.loft_video_session(loft_room_id);
create index if not exists loft_video_session_host_idx
  on public.loft_video_session(host_boh_user_id);
create index if not exists loft_video_session_patron_person_idx
  on public.loft_video_session(patron_person_id);
create index if not exists loft_video_session_business_record_idx
  on public.loft_video_session(tenant_id, business_context, business_record_table, business_record_id);
create index if not exists loft_video_session_scheduled_start_idx
  on public.loft_video_session(tenant_id, scheduled_start_at desc);

create or replace function public.update_loft_video_session_updated_at()
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

drop trigger if exists update_loft_video_session_updated_at on public.loft_video_session;
create trigger update_loft_video_session_updated_at
  before update on public.loft_video_session
  for each row
  execute function public.update_loft_video_session_updated_at();

grant select on public.loft_video_session to authenticated;

alter table public.loft_video_session enable row level security;

drop policy if exists "loft_video_session_select_current_tenant" on public.loft_video_session;
create policy "loft_video_session_select_current_tenant"
  on public.loft_video_session
  for select
  to authenticated
  using (
    tenant_id = public.current_boh_tenant_id()
    or public.is_boh_super_admin()
  );

-- Conservative first pass: writes are intentionally service-role only via Edge
-- Functions until the exact Talent/Slotz UI flows are implemented.

commit;

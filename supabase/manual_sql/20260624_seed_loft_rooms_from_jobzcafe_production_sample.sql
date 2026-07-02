-- Seed BOH-DEV with selected Loft production room rows provided by user.
-- Maps production Dr. Bron/Boshea profile 0114cf91-e6d7-499e-923b-586bf292459b
-- to the BOH-DEV compatibility profile for boshea@jobzcafe.com.
-- Intended for BOH-DEV testing only.

begin;

-- Production Loft columns not present in the first BOH compatibility pass.
alter table public.loft_room
  add column if not exists summary text,
  add column if not exists active_speakers jsonb not null default '[]'::jsonb,
  add column if not exists scheduled_local_date date,
  add column if not exists scheduled_local_time time,
  add column if not exists last_refresh_at timestamptz,
  add column if not exists public_join_token uuid;

-- Keep boshea enabled for end-to-end Loft testing.
update public.profile
set can_use_personal_room = true,
    can_host_loft = true,
    is_loft_admin = true,
    personal_room_public = true,
    personal_room_slug = coalesce(personal_room_slug, 'boshea'),
    updated_at = now()
where lower(email) = 'boshea@jobzcafe.com';

-- Minimal placeholder compatibility profiles for production hosts/users referenced
-- by the supplied sample. boshea's real BOH-DEV profile is used below instead of
-- creating the production 0114 profile id.
insert into public.profile (id, display_name, full_name, email, can_use_personal_room, can_host_loft, personal_room_slug, personal_room_public)
values
  ('2d0df43d-88ba-4d90-8e5c-cc46228bded8', 'Bron Loomis', 'Bron Loomis', 'bron-loomis+loft-seed@jobzcafe.local', true, true, 'bron-loomis', true),
  ('4cbe9cf8-57a6-4229-a544-154beeb62286', 'L John Loomis', 'L John Loomis', 'l-john-loomis+loft-seed@jobzcafe.local', true, true, 'l-john-loomis', true),
  ('8fabe86c-5e8b-41f6-bbcc-389289a2a58a', 'Loft RSVP Guest', 'Loft RSVP Guest', 'loft-rsvp-guest+seed@jobzcafe.local', false, false, null, false)
on conflict (id) do update
set display_name = excluded.display_name,
    full_name = excluded.full_name,
    email = excluded.email,
    can_use_personal_room = excluded.can_use_personal_room,
    can_host_loft = excluded.can_host_loft,
    personal_room_slug = excluded.personal_room_slug,
    personal_room_public = excluded.personal_room_public,
    updated_at = now();

with boshea as (
  select id as profile_id
  from public.profile
  where lower(email) = 'boshea@jobzcafe.com'
  limit 1
), rows as (
  select * from (values
    ('03bfce0f-36ee-4fe9-ab14-140c6666dd10'::uuid, 'cafe', '0114cf91-e6d7-499e-923b-586bf292459b'::uuid, 'Onboarding Session', 'This is a friendly welcome session designed to help you feel at home in JOBZ CAFE®.

You’ll get a guided overview of how sessions work, what to expect when joining live rooms, and how to engage at your own pace.

You can listen, ask questions, or take the stage when invited.', 'scheduled', 'public', '2026-05-26 01:15:00+00'::timestamptz, null::timestamptz, null::timestamptz, 'loft-cafe-b9b3ab09-9009-4259-870a-6ecd8c8db744', 1, '2026-01-14 01:20:28.691019+00'::timestamptz, '2026-05-05 06:31:20.710547+00'::timestamptz, null::text, null::text, false, array['Onboarding','Getting Started','Live Walkthrough','Beginner-Friendly','Q&A Welcome']::text[], 30, '[]'::jsonb, 'UTC', '2026-05-26'::date, '01:15:00'::time, null::text, false, null::timestamptz, '2026-01-14 01:20:28.691019+00'::timestamptz, null::text, null::timestamptz, '82e328af-0d52-42e0-b929-125f7b3e9a51'::uuid, '5867c39d-61e6-4fad-a926-a15c9a1f7d9e'::uuid, true, 'host-approval', null::timestamptz),
    ('05d16c70-9ce1-49f2-a2fe-c901b363e723'::uuid, 'cafe', '0114cf91-e6d7-499e-923b-586bf292459b'::uuid, 'Onboarding Session', 'Discuss the platform and what the next steps are', 'live', 'public', '2026-05-05 01:15:00+00'::timestamptz, '2025-12-29 21:44:25.192+00'::timestamptz, '2026-01-17 21:15:54.079+00'::timestamptz, 'loft-cafe-77c3e854-7d8f-47e3-a85a-27d5d22f5d91', 3, '2025-12-29 21:44:21.101137+00'::timestamptz, '2026-05-05 06:31:20.710547+00'::timestamptz, null::text, null::text, false, array['onboarding']::text[], 30, '[]'::jsonb, 'UTC', '2026-05-05'::date, '01:15:00'::time, null::text, true, '2026-01-15 06:21:46.558+00'::timestamptz, '2026-01-16 00:57:30.21+00'::timestamptz, null::text, null::timestamptz, null::uuid, 'e3a999f7-7ec9-4584-b159-24fc9187b4ef'::uuid, true, 'host-approval', null::timestamptz),
    ('3e1cf848-06f5-486a-92f8-3f570c7b48ed'::uuid, 'cafe', '2d0df43d-88ba-4d90-8e5c-cc46228bded8'::uuid, 'Bron Loomis''s Personal Room', 'Personal meeting room - always available', 'live', 'unlisted', '2026-02-01 03:11:22+00'::timestamptz, '2026-02-01 03:11:22+00'::timestamptz, null::timestamptz, 'loft-personal-2d0df43d-88ba-4d90-8e5c-cc46228bded8', 1, '2026-02-01 03:11:22.014473+00'::timestamptz, '2026-02-01 03:35:15.844996+00'::timestamptz, null::text, null::text, false, array['personal-room']::text[], 10, '[]'::jsonb, 'UTC', '2026-02-01'::date, '03:11:22'::time, 'CBZWL2JN', true, '2026-02-01 03:11:27.845+00'::timestamptz, '2026-02-01 03:11:22.014473+00'::timestamptz, null::text, null::timestamptz, null::uuid, 'c5004af6-5f6b-4013-ae70-e8b09b7fd693'::uuid, true, 'host-approval', null::timestamptz),
    ('7b32c09c-d581-41ee-8f5b-db369114475c'::uuid, 'cafe', '0114cf91-e6d7-499e-923b-586bf292459b'::uuid, 'Onboarding Session', 'This is a friendly welcome session designed to help you feel at home in JOBZ CAFE®.

You’ll get a guided overview of how sessions work, what to expect when joining live rooms, and how to engage at your own pace.

You can listen, ask questions, or take the stage when invited.', 'scheduled', 'public', '2026-06-02 01:15:00+00'::timestamptz, null::timestamptz, null::timestamptz, 'loft-cafe-6d730a37-ff86-49a7-9163-f5d2c15b12f9', 3, '2026-01-14 01:20:28.691019+00'::timestamptz, '2026-05-31 12:29:18.847972+00'::timestamptz, null::text, null::text, false, array['Onboarding','Getting Started','Live Walkthrough','Beginner-Friendly','Q&A Welcome']::text[], 30, '[]'::jsonb, 'UTC', '2026-06-02'::date, '01:15:00'::time, null::text, false, null::timestamptz, '2026-01-14 01:20:28.691019+00'::timestamptz, null::text, null::timestamptz, '82e328af-0d52-42e0-b929-125f7b3e9a51'::uuid, 'e13ce8c4-e334-4dbd-8fb3-aa88948c93c5'::uuid, true, 'host-approval', null::timestamptz),
    ('82e328af-0d52-42e0-b929-125f7b3e9a51'::uuid, 'cafe', '0114cf91-e6d7-499e-923b-586bf292459b'::uuid, 'Onboarding Session', 'This is a friendly welcome session designed to help you feel at home in JOBZ CAFE®.

You’ll get a guided overview of how sessions work, what to expect when joining live rooms, and how to engage at your own pace.

You can listen, ask questions, or take the stage when invited.', 'scheduled', 'public', '2026-05-12 01:15:00+00'::timestamptz, null::timestamptz, null::timestamptz, 'loft-cafe-585d4649-2b0b-4bb3-887d-869404ecbbe1', 2, '2026-01-14 01:20:28.195906+00'::timestamptz, '2026-05-05 06:31:20.710547+00'::timestamptz, null::text, null::text, false, array['Onboarding','Getting Started','Live Walkthrough','Beginner-Friendly','Q&A Welcome']::text[], 30, '[]'::jsonb, 'UTC', '2026-05-12'::date, '01:15:00'::time, null::text, false, null::timestamptz, '2026-01-19 01:40:02.488+00'::timestamptz, null::text, null::timestamptz, null::uuid, '235ed1cd-4ee5-47ee-ba5a-850d546b95c0'::uuid, true, 'host-approval', null::timestamptz),
    ('864ded7e-fc04-401c-ab92-5cf6c8d4fe5a'::uuid, 'cafe', '0114cf91-e6d7-499e-923b-586bf292459b'::uuid, 'Onboarding Session', 'This is a friendly welcome session designed to help you feel at home in JOBZ CAFE®.

You’ll get a guided overview of how sessions work, what to expect when joining live rooms, and how to engage at your own pace.

You can listen, ask questions, or take the stage when invited.', 'scheduled', 'public', '2026-06-09 01:15:00+00'::timestamptz, null::timestamptz, null::timestamptz, 'loft-cafe-533e8ad5-bb12-45f4-99ef-00cfdc96d940', 1, '2026-01-14 01:20:28.691019+00'::timestamptz, '2026-05-05 06:31:20.710547+00'::timestamptz, null::text, null::text, false, array['Onboarding','Getting Started','Live Walkthrough','Beginner-Friendly','Q&A Welcome']::text[], 30, '[]'::jsonb, 'UTC', '2026-06-09'::date, '01:15:00'::time, null::text, false, null::timestamptz, '2026-01-14 01:20:28.691019+00'::timestamptz, null::text, null::timestamptz, '82e328af-0d52-42e0-b929-125f7b3e9a51'::uuid, '19067cfb-3eee-4a56-9dec-dfc402db01c8'::uuid, true, 'host-approval', null::timestamptz),
    ('86867e85-2aea-4957-a5e4-6153ad43a203'::uuid, 'cafe', '0114cf91-e6d7-499e-923b-586bf292459b'::uuid, 'Onboarding Session', 'This is a friendly welcome session designed to help you feel at home in JOBZ CAFE®.

You’ll get a guided overview of how sessions work, what to expect when joining live rooms, and how to engage at your own pace.

You can listen, ask questions, or take the stage when invited.', 'ended', 'public', '2026-06-16 01:15:00+00'::timestamptz, '2026-05-06 09:34:28.844+00'::timestamptz, '2026-05-07 21:59:43.344+00'::timestamptz, 'loft-cafe-e2d0fed6-5f60-41d7-9af2-307a9fd98d5f', 1, '2026-01-14 01:20:28.691019+00'::timestamptz, '2026-05-07 21:59:43.448198+00'::timestamptz, null::text, null::text, false, array['Onboarding','Getting Started','Live Walkthrough','Beginner-Friendly','Q&A Welcome']::text[], 30, '[]'::jsonb, 'UTC', '2026-06-16'::date, '01:15:00'::time, null::text, false, '2026-05-06 09:34:28.844+00'::timestamptz, '2026-01-14 01:20:28.691019+00'::timestamptz, null::text, null::timestamptz, '82e328af-0d52-42e0-b929-125f7b3e9a51'::uuid, 'f05ae00f-4999-421c-bf30-92463c93b1f1'::uuid, true, 'host-approval', null::timestamptz),
    ('b57fd711-656e-413a-8f1a-1db4af655c45'::uuid, 'cafe', '4cbe9cf8-57a6-4229-a544-154beeb62286'::uuid, 'L John Loomis''s Personal Room', 'Personal meeting room - always available', 'live', 'unlisted', '2026-02-01 04:02:23.674+00'::timestamptz, '2026-02-01 04:02:23.674+00'::timestamptz, null::timestamptz, 'loft-personal-4cbe9cf8-57a6-4229-a544-154beeb62286', 1, '2026-02-01 04:02:23.684015+00'::timestamptz, '2026-02-05 20:14:51.260555+00'::timestamptz, null::text, null::text, false, array['personal-room']::text[], 10, '[]'::jsonb, 'UTC', '2026-02-01'::date, '04:02:23.674'::time, '6A348JA9', true, '2026-02-01 04:02:58.175+00'::timestamptz, '2026-02-01 04:02:23.684015+00'::timestamptz, null::text, null::timestamptz, null::uuid, 'eae15388-c14a-4f0b-9015-47b308f67dbf'::uuid, true, 'host-approval', null::timestamptz),
    ('dc536573-db7f-4a3e-b822-7c57c7f423fa'::uuid, 'cafe', '0114cf91-e6d7-499e-923b-586bf292459b'::uuid, 'Onboarding Session', 'This is a friendly welcome session designed to help you feel at home in JOBZ CAFE®.

You’ll get a guided overview of how sessions work, what to expect when joining live rooms, and how to engage at your own pace.

You can listen, ask questions, or take the stage when invited.', 'scheduled', 'public', '2026-05-19 01:15:00+00'::timestamptz, null::timestamptz, null::timestamptz, 'loft-cafe-c12f74f3-921e-4d54-a177-412c8ddc00e2', 2, '2026-01-14 01:20:28.691019+00'::timestamptz, '2026-05-05 06:31:20.710547+00'::timestamptz, null::text, null::text, false, array['Onboarding','Getting Started','Live Walkthrough','Beginner-Friendly','Q&A Welcome']::text[], 30, '[]'::jsonb, 'UTC', '2026-05-19'::date, '01:15:00'::time, null::text, false, null::timestamptz, '2026-01-14 01:20:28.691019+00'::timestamptz, null::text, null::timestamptz, '82e328af-0d52-42e0-b929-125f7b3e9a51'::uuid, '737aeac4-bc2a-4cd5-9d63-9aba49193eff'::uuid, true, 'host-approval', null::timestamptz),
    ('f191bf4c-8c9d-4c99-a8b7-d659876184e8'::uuid, 'cafe', '0114cf91-e6d7-499e-923b-586bf292459b'::uuid, 'Dr. Bron OShea''s Personal Room', 'Personal meeting room - always available', 'live', 'unlisted', '2026-02-01 03:16:50.528+00'::timestamptz, '2026-02-01 03:16:50.528+00'::timestamptz, null::timestamptz, 'loft-personal-0114cf91-e6d7-499e-923b-586bf292459b', 1, '2026-02-01 03:16:50.542949+00'::timestamptz, '2026-06-21 23:58:56.323498+00'::timestamptz, null::text, null::text, false, array['personal-room']::text[], 10, '[]'::jsonb, 'UTC', '2026-02-01'::date, '03:16:50.528'::time, 'Z7H9L3CN', true, '2026-06-21 23:58:56.318+00'::timestamptz, '2026-02-01 03:16:50.542949+00'::timestamptz, null::text, null::timestamptz, null::uuid, '553fad65-0ee2-4ea8-92eb-be3e525dfc56'::uuid, true, 'host-approval', null::timestamptz)
  ) as v(id, app_context, host_profile_id, title, description, status, visibility, scheduled_start_at, started_at, ended_at, daily_room_name, participant_count, created_at, updated_at, summary, recording_url, is_recorded, tags, max_participants, active_speakers, scheduled_tz, scheduled_local_date, scheduled_local_time, invite_code, is_open, opened_at, last_refresh_at, recurrence_type, recurrence_end_date, recurrence_parent_id, public_join_token, public_join_enabled, access_mode, scheduled_delete_at)
)
insert into public.loft_room (
  id, app_context, host_profile_id, title, description, status, visibility,
  scheduled_start_at, started_at, ended_at, daily_room_name, participant_count,
  created_at, updated_at, summary, recording_url, is_recorded, tags,
  max_participants, active_speakers, scheduled_tz, scheduled_local_date,
  scheduled_local_time, invite_code, is_open, opened_at, last_refresh_at,
  recurrence_type, recurrence_end_date, recurrence_parent_id, public_join_token,
  public_join_enabled, access_mode, scheduled_delete_at
)
select
  r.id,
  r.app_context,
  case when r.host_profile_id = '0114cf91-e6d7-499e-923b-586bf292459b'::uuid then b.profile_id else r.host_profile_id end,
  r.title,
  r.description,
  r.status,
  r.visibility,
  r.scheduled_start_at,
  r.started_at,
  r.ended_at,
  case when r.daily_room_name = 'loft-personal-0114cf91-e6d7-499e-923b-586bf292459b' then 'loft-personal-' || b.profile_id::text else r.daily_room_name end,
  r.participant_count,
  r.created_at,
  r.updated_at,
  r.summary,
  r.recording_url,
  r.is_recorded,
  r.tags,
  r.max_participants,
  r.active_speakers,
  r.scheduled_tz,
  r.scheduled_local_date,
  r.scheduled_local_time,
  r.invite_code,
  r.is_open,
  r.opened_at,
  r.last_refresh_at,
  r.recurrence_type,
  r.recurrence_end_date,
  r.recurrence_parent_id,
  r.public_join_token,
  r.public_join_enabled,
  r.access_mode,
  r.scheduled_delete_at
from rows r
cross join boshea b
on conflict (id) do update
set app_context = excluded.app_context,
    host_profile_id = excluded.host_profile_id,
    title = excluded.title,
    description = excluded.description,
    status = excluded.status,
    visibility = excluded.visibility,
    scheduled_start_at = excluded.scheduled_start_at,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    daily_room_name = excluded.daily_room_name,
    participant_count = excluded.participant_count,
    updated_at = excluded.updated_at,
    summary = excluded.summary,
    recording_url = excluded.recording_url,
    is_recorded = excluded.is_recorded,
    tags = excluded.tags,
    max_participants = excluded.max_participants,
    active_speakers = excluded.active_speakers,
    scheduled_tz = excluded.scheduled_tz,
    scheduled_local_date = excluded.scheduled_local_date,
    scheduled_local_time = excluded.scheduled_local_time,
    invite_code = excluded.invite_code,
    is_open = excluded.is_open,
    opened_at = excluded.opened_at,
    last_refresh_at = excluded.last_refresh_at,
    recurrence_type = excluded.recurrence_type,
    recurrence_end_date = excluded.recurrence_end_date,
    recurrence_parent_id = excluded.recurrence_parent_id,
    public_join_token = excluded.public_join_token,
    public_join_enabled = excluded.public_join_enabled,
    access_mode = excluded.access_mode,
    scheduled_delete_at = excluded.scheduled_delete_at;

-- Update personal room ownership references for known seeded personal rooms.
update public.profile p
set personal_room_id = 'f191bf4c-8c9d-4c99-a8b7-d659876184e8'::uuid,
    personal_room_slug = coalesce(p.personal_room_slug, 'boshea'),
    personal_room_public = true,
    can_use_personal_room = true,
    can_host_loft = true,
    is_loft_admin = true,
    updated_at = now()
where lower(p.email) = 'boshea@jobzcafe.com';

update public.profile
set personal_room_id = '3e1cf848-06f5-486a-92f8-3f570c7b48ed'::uuid,
    updated_at = now()
where id = '2d0df43d-88ba-4d90-8e5c-cc46228bded8'::uuid;

update public.profile
set personal_room_id = 'b57fd711-656e-413a-8f1a-1db4af655c45'::uuid,
    updated_at = now()
where id = '4cbe9cf8-57a6-4229-a544-154beeb62286'::uuid;

-- Host memberships for every seeded room.
insert into public.loft_room_member (loft_room_id, profile_id, role, is_active, joined_at, created_at)
select lr.id, lr.host_profile_id, 'host', true, coalesce(lr.started_at, lr.created_at), lr.created_at
from public.loft_room lr
where lr.id in (
  '03bfce0f-36ee-4fe9-ab14-140c6666dd10','05d16c70-9ce1-49f2-a2fe-c901b363e723','3e1cf848-06f5-486a-92f8-3f570c7b48ed',
  '7b32c09c-d581-41ee-8f5b-db369114475c','82e328af-0d52-42e0-b929-125f7b3e9a51','864ded7e-fc04-401c-ab92-5cf6c8d4fe5a',
  '86867e85-2aea-4957-a5e4-6153ad43a203','b57fd711-656e-413a-8f1a-1db4af655c45','dc536573-db7f-4a3e-b822-7c57c7f423fa','f191bf4c-8c9d-4c99-a8b7-d659876184e8'
)
on conflict (loft_room_id, profile_id) do update
set role = excluded.role,
    is_active = excluded.is_active;

-- RSVP rows from the pasted sample that have matching seeded profiles.
insert into public.loft_room_rsvp (id, loft_room_id, profile_id, status, created_at, updated_at)
values
  ('440603e4-9eb7-4166-aa97-aa40c59317f9'::uuid, '7b32c09c-d581-41ee-8f5b-db369114475c'::uuid, '4cbe9cf8-57a6-4229-a544-154beeb62286'::uuid, 'going', '2026-02-05 21:17:48.957847+00'::timestamptz, '2026-02-05 21:17:48.957847+00'::timestamptz),
  ('44b85de3-67d1-4d47-8b35-3dc02b52afa5'::uuid, '7b32c09c-d581-41ee-8f5b-db369114475c'::uuid, '8fabe86c-5e8b-41f6-bbcc-389289a2a58a'::uuid, 'going', '2026-05-31 12:29:18.81838+00'::timestamptz, '2026-05-31 12:29:18.81838+00'::timestamptz),
  ('d6ab4ec0-ef0c-4e7d-9573-703ac6332b69'::uuid, 'dc536573-db7f-4a3e-b822-7c57c7f423fa'::uuid, '2d0df43d-88ba-4d90-8e5c-cc46228bded8'::uuid, 'going', '2026-01-14 20:39:24.679542+00'::timestamptz, '2026-01-14 20:39:24.679542+00'::timestamptz)
on conflict (loft_room_id, profile_id) do update
set status = excluded.status,
    updated_at = excluded.updated_at;

commit;

select 'profiles' as record_type, count(*) as count from public.profile where email like '%loft-seed%' or lower(email) = 'boshea@jobzcafe.com'
union all select 'loft_room_seeded', count(*) from public.loft_room
union all select 'loft_room_member_seeded', count(*) from public.loft_room_member
union all select 'loft_room_rsvp_seeded', count(*) from public.loft_room_rsvp;

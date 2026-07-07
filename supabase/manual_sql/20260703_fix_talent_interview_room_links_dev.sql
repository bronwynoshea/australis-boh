begin;

-- Keep existing Talent-created Loft video sessions on BOH-native recruiter interview room links.
update public.loft_video_session lvs
set join_url = '/t/' || bt.slug || '/loft/join/' || lower(lr.invite_code),
    updated_at = now()
from public.loft_room lr
join public.boh_tenant bt on bt.id = lr.tenant_id
where lvs.loft_room_id = lr.id
  and lvs.source_app = 'talent'
  and lr.invite_code is not null
  and coalesce(lvs.join_url, '') is distinct from ('/t/' || bt.slug || '/loft/join/' || lower(lr.invite_code));

-- Ensure Elena/hello has a Patron person in BOH-DEV for the current Talent demo interview.
insert into public.patron_person (
  tenant_id,
  email,
  first_name,
  last_name,
  display_name,
  source,
  app_context,
  external_app_context,
  person_type_key
)
select
  '98732b48-1d63-4851-8349-d24f50f5149c'::uuid,
  'hello@australis.cloud',
  'Elena',
  'Brooks',
  'Elena Brooks',
  'talent_interview_request',
  'patron',
  'talent',
  'job_seeker'
where not exists (
  select 1 from public.patron_person
  where tenant_id = '98732b48-1d63-4851-8349-d24f50f5149c'::uuid
    and email = 'hello@australis.cloud'
);

-- Create or reuse the Slotz booking that backs the Talent interview appointment.
with existing_booking as (
  select id
  from public.scheduling_bookings
  where tenant_id = '98732b48-1d63-4851-8349-d24f50f5149c'::uuid
    and staff_id = '979cc29d-b2c4-4bdc-854f-09ef44f61b29'::uuid
    and guest_email = 'hello@australis.cloud'
    and start_time = '2026-07-05T23:00:00Z'::timestamptz
  order by created_at desc
  limit 1
), inserted_booking as (
  insert into public.scheduling_bookings (
    tenant_id,
    staff_id,
    meeting_type_id,
    guest_name,
    guest_email,
    guest_timezone,
    start_time,
    end_time,
    status
  )
  select
    '98732b48-1d63-4851-8349-d24f50f5149c'::uuid,
    '979cc29d-b2c4-4bdc-854f-09ef44f61b29'::uuid,
    'e584791a-f993-4014-8909-ced8e4f7240e'::uuid,
    'Elena Brooks',
    'hello@australis.cloud',
    'Australia/Sydney',
    '2026-07-05T23:00:00Z'::timestamptz,
    '2026-07-05T23:30:00Z'::timestamptz,
    'confirmed'
  where not exists (select 1 from existing_booking)
  returning id
), booking as (
  select id from existing_booking
  union all
  select id from inserted_booking
  limit 1
), candidate as (
  select id from public.patron_person
  where tenant_id = '98732b48-1d63-4851-8349-d24f50f5149c'::uuid
    and email = 'hello@australis.cloud'
  limit 1
), session_upsert as (
  insert into public.loft_video_session (
    tenant_id,
    app_context,
    source_app,
    loft_room_id,
    business_context,
    business_record_table,
    business_record_id,
    host_patron_person_id,
    patron_person_id,
    participant_name,
    participant_email,
    scheduled_start_at,
    scheduled_end_at,
    join_url,
    status,
    message_status,
    metadata
  )
  select
    '98732b48-1d63-4851-8349-d24f50f5149c'::uuid,
    'talent',
    'talent',
    '7ae4ab82-e68e-4e57-8c8c-1877bba503bb'::uuid,
    'interview',
    'scheduling_bookings',
    booking.id,
    '567fe8a6-787d-47f0-96be-de176ea07cbb'::uuid,
    candidate.id,
    'Elena Brooks',
    'hello@australis.cloud',
    '2026-07-05T23:00:00Z'::timestamptz,
    '2026-07-05T23:30:00Z'::timestamptz,
    '/t/jobzcafe/loft/join/rynrsk3f',
    'scheduled',
    'not_sent',
    jsonb_build_object('talent', jsonb_build_object('sourceRecordId', '0a57e583-f7d9-4bc4-8e2a-0eb9bf0ad786', 'sourceRecordTable', 'talent_interview_request', 'sourceOfTruth', 'talent'))
  from booking, candidate
  where not exists (
    select 1 from public.loft_video_session
    where tenant_id = '98732b48-1d63-4851-8349-d24f50f5149c'::uuid
      and source_app = 'talent'
      and business_record_table = 'scheduling_bookings'
      and business_record_id = booking.id
  )
  returning id, business_record_id
), session_row as (
  select lvs.id, lvs.business_record_id
  from public.loft_video_session lvs
  join booking on booking.id = lvs.business_record_id
  where lvs.source_app = 'talent'
    and lvs.business_record_table = 'scheduling_bookings'
  union all
  select id, business_record_id from session_upsert
  limit 1
)
update public.loft_video_session lvs
set loft_room_id = '7ae4ab82-e68e-4e57-8c8c-1877bba503bb'::uuid,
    host_patron_person_id = '567fe8a6-787d-47f0-96be-de176ea07cbb'::uuid,
    participant_email = 'hello@australis.cloud',
    participant_name = 'Elena Brooks',
    join_url = '/t/jobzcafe/loft/join/rynrsk3f',
    updated_at = now()
from session_row
where lvs.id = session_row.id;

commit;

select
  column_name,
  data_type,
  column_default,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'scheduling_meeting_types'
  and column_name in (
    'loft_video_enabled',
    'loft_business_context',
    'loft_host_persona'
  )
order by column_name;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'loft_video_session'
  and indexname = 'loft_video_session_slotz_booking_uidx';

select
  conname,
  pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.scheduling_meeting_types'::regclass
  and conname in (
    'scheduling_meeting_types_loft_business_context_check',
    'scheduling_meeting_types_loft_host_persona_check'
  );

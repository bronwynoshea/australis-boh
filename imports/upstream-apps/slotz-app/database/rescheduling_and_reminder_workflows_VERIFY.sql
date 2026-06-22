-- Verify SLOTZ reschedule + reminder workflow migration.

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'scheduling_bookings'
  and column_name in (
    'rescheduled_at',
    'rescheduled_by',
    'reschedule_reason',
    'previous_start_time',
    'previous_end_time'
  )
order by column_name;

select
  to_regclass('public.scheduling_reminder_jobs') as reminder_jobs_table,
  to_regclass('public.scheduling_email_events') as email_events_table;

select
  trigger_name,
  event_manipulation,
  action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'scheduling_bookings'
  and trigger_name in (
    'scheduling_booking_enqueue_reminders',
    'scheduling_booking_enqueue_change_reminders'
  )
order by trigger_name, event_manipulation;

select
  jobname,
  schedule,
  active,
  command
from cron.job
where jobname in ('slotz-send-daily-guest-reminders', 'slotz-send-daily-staff-reminders')
order by jobname;

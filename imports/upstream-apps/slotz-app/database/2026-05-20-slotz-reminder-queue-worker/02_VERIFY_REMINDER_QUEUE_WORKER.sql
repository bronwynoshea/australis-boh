-- Verify SLOTZ reminder queue worker crons and reminder queue state.

select
  jobname,
  schedule,
  active,
  command
from cron.job
where jobname in (
  'slotz-send-daily-guest-reminders',
  'slotz-send-daily-staff-reminders'
)
order by jobname;

select
  status,
  job_type,
  recipient_type,
  count(*) as job_count
from public.scheduling_reminder_jobs
group by status, job_type, recipient_type
order by status, job_type, recipient_type;

select
  id,
  booking_id,
  job_type,
  recipient_type,
  scheduled_for,
  status,
  attempts,
  last_error,
  sent_at
from public.scheduling_reminder_jobs
where job_type in ('reminder_24h', 'reminder_1h')
order by scheduled_for desc
limit 20;

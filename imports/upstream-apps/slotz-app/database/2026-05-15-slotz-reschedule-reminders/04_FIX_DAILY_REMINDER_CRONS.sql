-- Fix daily reminder cron URLs.
-- Safe to run more than once.
-- Before running in prod, change edge_functions_base_url to the prod functions URL.

do $block$
declare
  edge_functions_base_url text := 'https://lczzeiqmnegyjrwtgmsj.supabase.co/functions/v1';
  job record;
begin
  if edge_functions_base_url is null
     or edge_functions_base_url = ''
     or edge_functions_base_url like '%your-project-ref%' then
    raise exception 'Set edge_functions_base_url before scheduling reminder cron jobs.';
  end if;

  for job in
    select jobid
    from cron.job
    where jobname in (
      'send-guest-daily-reminders',
      'send-staff-daily-reminders',
      'send-daily-guest-reminders',
      'send-daily-staff-reminders',
      'slotz-send-daily-guest-reminders',
      'slotz-send-daily-staff-reminders'
    )
  loop
    perform cron.unschedule(job.jobid);
  end loop;

  perform cron.schedule(
    'slotz-send-daily-guest-reminders',
    '0 3 * * *',
    format(
      $cron$
      select net.http_post(
        url := %L,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      );
      $cron$,
      edge_functions_base_url || '/slotz-send-daily-guest-reminders'
    )
  );

  perform cron.schedule(
    'slotz-send-daily-staff-reminders',
    '0 3 * * *',
    format(
      $cron$
      select net.http_post(
        url := %L,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      );
      $cron$,
      edge_functions_base_url || '/slotz-send-daily-staff-reminders'
    )
  );
end;
$block$;

select jobname, schedule, active, command
from cron.job
where jobname in ('slotz-send-daily-guest-reminders', 'slotz-send-daily-staff-reminders')
order by jobname;

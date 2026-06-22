-- Fix SLOTZ reminder queue worker crons for BOH-dev.
-- Safe to run more than once.

do $block$
declare
  edge_functions_base_url text := 'https://lczzeiqmnegyjrwtgmsj.supabase.co/functions/v1';
  job record;
begin
  for job in
    select jobid
    from cron.job
    where jobname in (
      'slotz-send-daily-guest-reminders',
      'slotz-send-daily-staff-reminders'
    )
  loop
    perform cron.unschedule(job.jobid);
  end loop;

  perform cron.schedule(
    'slotz-send-daily-guest-reminders',
    '*/5 * * * *',
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
    '*/5 * * * *',
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

-- Setup cron jobs for daily reminder system
-- Both run at 3:00 AM daily (as requested to avoid conflicts with existing 2:00 AM cron)

-- Cron job for guest daily reminders
SELECT cron.schedule(
  'slotz-send-daily-guest-reminders',
  '0 3 * * *',  -- 3:00 AM every day
  $$
  SELECT net.http_post(
    url := 'https://gsidwiptqkyciexqdbyw.supabase.co/functions/v1/slotz-send-daily-guest-reminders',
    headers := '{"Content-Type": "application/json"}',
    body := '{}'
  );
  $$,
  enabled => true
);

-- Cron job for staff daily reminders
SELECT cron.schedule(
  'slotz-send-daily-staff-reminders',
  '0 3 * * *',  -- 3:00 AM every day
  $$
  SELECT net.http_post(
    url := 'https://gsidwiptqkyciexqdbyw.supabase.co/functions/v1/slotz-send-daily-staff-reminders',
    headers := '{"Content-Type": "application/json"}',
    body := '{}'
  );
  $$,
  enabled => true
);

-- Verify cron jobs are scheduled
SELECT * FROM cron.job WHERE job_name IN ('slotz-send-daily-guest-reminders', 'slotz-send-daily-staff-reminders');

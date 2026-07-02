-- Add daily reminder cron jobs to existing cron system
-- Check existing cron jobs first
SELECT * FROM pg_cron.schedule;

-- Add guest daily reminders cron job (3:00 AM daily)
SELECT cron.schedule(
  'slotz-send-daily-guest-reminders',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gsidwiptqkyciexqdbyw.supabase.co/functions/v1/slotz-send-daily-guest-reminders',
    headers := '{"Content-Type": "application/json"}',
    body := '{}'
  );
  $$,
  enabled => true
);

-- Add staff daily reminders cron job (3:00 AM daily)
SELECT cron.schedule(
  'slotz-send-daily-staff-reminders',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gsidwiptqkyciexqdbyw.supabase.co/functions/v1/slotz-send-daily-staff-reminders',
    headers := '{"Content-Type": "application/json"}',
    body := '{}'
  );
  $$,
  enabled => true
);

-- Verify the new cron jobs were added
SELECT * FROM pg_cron.schedule WHERE jobname IN ('slotz-send-daily-guest-reminders', 'slotz-send-daily-staff-reminders');

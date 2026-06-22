-- Step 1: Install pg_cron extension (if not already installed)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Install pg_net extension for HTTP calls (if not already installed)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 3: Verify extensions are installed
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

-- Step 4: Create the daily reminder cron jobs
-- Guest daily reminders (3:00 AM daily)
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

-- Staff daily reminders (3:00 AM daily)
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

-- Step 5: Verify cron jobs were created
SELECT * FROM pg_cron.schedule WHERE jobname IN ('slotz-send-daily-guest-reminders', 'slotz-send-daily-staff-reminders');

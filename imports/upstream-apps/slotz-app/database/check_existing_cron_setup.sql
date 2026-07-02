-- Check what cron system you're currently using
-- This will help us understand your setup

-- Check pg_cron extension
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check existing cron jobs (if pg_cron is installed)
SELECT * FROM pg_cron.schedule;

-- Check pg_net extension (for HTTP calls)
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Alternative: Check if you're using a different cron method
-- Look for any cron-related tables or functions
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_name LIKE '%cron%' 
   OR table_name LIKE '%schedule%'
   OR table_name LIKE '%job%';

-- Check what functions exist for HTTP calls
SELECT proname, pronargs 
FROM pg_proc 
WHERE proname LIKE '%http%' 
   OR proname LIKE '%net%'
   OR proname LIKE '%request%'
ORDER BY proname;

-- Check if pg_cron extension is installed
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- If not installed, install it (run this first)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Check what cron functions are available
SELECT proname FROM pg_proc WHERE proname LIKE '%cron%' ORDER BY proname;

-- Check current cron jobs (if any)
SELECT * FROM pg_cron.schedule;

-- Alternative approach: Use pg_cron.schedule function if available
-- Try this simpler version first
SELECT cron.schedule('test-job', '0 3 * * *', 'SELECT 1;');

-- If pg_cron doesn't work, we'll need to use Supabase's cron system
-- Check if pg_net extension is available for HTTP calls
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- If pg_net is not installed, install it
-- CREATE EXTENSION IF NOT EXISTS pg_net;

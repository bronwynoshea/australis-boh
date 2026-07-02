-- Fix RLS for scheduling_reminders table
-- Option 1: Enable RLS on existing table
ALTER TABLE public.scheduling_reminders ENABLE ROW LEVEL SECURITY;

-- Option 2: If table doesn't exist or isn't needed, drop it
-- DROP TABLE IF EXISTS public.scheduling_reminders;

-- Note: Our daily reminder system doesn't use a separate reminders table
-- It queries bookings directly for better performance

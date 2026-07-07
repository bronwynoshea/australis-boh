-- Reduce remaining SECURITY DEFINER advisor warnings for app-called host application RPCs that can run as invoker.
-- These functions keep authenticated EXECUTE but no longer bypass RLS/table privileges.

alter function public.get_host_applications(text) security invoker;
alter function public.get_my_host_application_status() security invoker;

-- Keep search paths explicit after changing execution mode.
alter function public.get_host_applications(text) set search_path = public, pg_temp;
alter function public.get_my_host_application_status() set search_path = public, pg_temp;

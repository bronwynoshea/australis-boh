-- Run in BOH-DEV fifth. Allows authenticated staff RLS checks to call the BOH user resolver.
grant execute on function public.cellar_current_boh_user_id() to authenticated, service_role;

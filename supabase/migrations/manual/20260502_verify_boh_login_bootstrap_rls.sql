-- Read-only verification for the BOH login bootstrap RLS fix.
-- This does not change the database.

select
  'table select grants' as check_name,
  has_table_privilege('authenticated', 'public.boh_user', 'select') as boh_user,
  has_table_privilege('authenticated', 'public.boh_role', 'select') as boh_role,
  has_table_privilege('authenticated', 'public.boh_app', 'select') as boh_app,
  has_table_privilege('authenticated', 'public.boh_user_role', 'select') as boh_user_role,
  has_table_privilege('authenticated', 'public.boh_user_app', 'select') as boh_user_app;

select
  'helper execute grants' as check_name,
  has_function_privilege(
    'authenticated',
    'public.current_boh_user_id()',
    'execute'
  ) as current_boh_user_id,
  has_function_privilege(
    'authenticated',
    'public.is_boh_super_admin()',
    'execute'
  ) as is_boh_super_admin;

select
  'is_boh_user execute grants' as check_name,
  p.oid::regprocedure::text as function_signature,
  has_function_privilege(
    'authenticated',
    p.oid,
    'execute'
  ) as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_boh_user'
order by function_signature;

select
  'bootstrap policies' as check_name,
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and policyname in (
    'boh_user_select_login_bootstrap',
    'boh_user_link_invited_auth_user',
    'boh_role_select_authenticated',
    'boh_app_select_active_bootstrap',
    'boh_user_role_select_bootstrap',
    'boh_user_app_select_bootstrap'
  )
order by tablename, policyname;

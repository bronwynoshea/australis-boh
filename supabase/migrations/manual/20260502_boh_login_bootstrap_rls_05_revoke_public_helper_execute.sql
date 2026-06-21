-- BOH login bootstrap RLS fix, part 05.
-- Run if the linter still reports public.current_boh_user_id() executable.

revoke execute on function public.current_boh_user_id() from public;
revoke execute on function public.current_boh_user_id() from anon;
revoke execute on function public.current_boh_user_id() from authenticated;

revoke execute on function public.is_boh_super_admin() from public;
revoke execute on function public.is_boh_super_admin() from anon;
revoke execute on function public.is_boh_super_admin() from authenticated;

revoke execute on function public.is_boh_user() from public;
revoke execute on function public.is_boh_user() from anon;
revoke execute on function public.is_boh_user() from authenticated;

revoke execute on function public.is_boh_user(uuid) from public;
revoke execute on function public.is_boh_user(uuid) from anon;
revoke execute on function public.is_boh_user(uuid) from authenticated;

select
  'public helper execute check' as check_name,
  has_function_privilege(
    'anon',
    'public.current_boh_user_id()',
    'execute'
  ) as anon_can_execute_current_boh_user_id,
  has_function_privilege(
    'authenticated',
    'public.current_boh_user_id()',
    'execute'
  ) as authenticated_can_execute_current_boh_user_id;

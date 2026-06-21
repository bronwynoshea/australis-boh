grant execute on function public.is_boh_user() to authenticated;
grant execute on function public.is_boh_user(uuid) to authenticated;
grant execute on function public.current_boh_user_id() to authenticated;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_boh_user', 'current_boh_user_id')
order by p.proname, args;

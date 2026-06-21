begin;

alter function public.current_boh_user_id()
  security invoker
  set search_path = public, pg_temp;

alter function public.is_boh_super_admin()
  security invoker
  set search_path = public, pg_temp;

alter function public.is_boh_super_admin(uuid)
  security invoker
  set search_path = public, pg_temp;

alter function public.is_boh_user()
  security invoker
  set search_path = public, pg_temp;

alter function public.is_boh_user(uuid)
  security invoker
  set search_path = public, pg_temp;

commit;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('current_boh_user_id', 'is_boh_super_admin', 'is_boh_user')
order by p.proname, args;

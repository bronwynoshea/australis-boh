-- Scope BOH helper predicates to the current tenant.
--
-- Tenant columns and RLS existed before full isolation, but these helper
-- functions were still effectively global. Policies that use
-- `... OR is_boh_super_admin()` must only bypass owner checks inside the
-- authenticated user's current tenant.

create or replace function public.is_boh_staff()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.boh_user bu
    where bu.auth_user_id = (select auth.uid())
      and bu.app_context = 'boh'
      and bu.status = 'active'
      and bu.tenant_id = public.current_boh_tenant_id()
  );
$function$;

create or replace function public.is_boh_super_admin()
returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.boh_user_role bur
    join public.boh_role br on br.id = bur.role_id
    join public.boh_user bu on bu.id = bur.user_id
    where bu.auth_user_id = (select auth.uid())
      and bu.app_context = 'boh'
      and bu.status = 'active'
      and bur.app_context = 'boh'
      and bur.tenant_id = bu.tenant_id
      and bu.tenant_id = public.current_boh_tenant_id()
      and br.code = 'super_admin'
  );
$function$;

grant execute on function public.is_boh_staff() to authenticated;
grant execute on function public.is_boh_super_admin() to authenticated;

-- Restore the BOH super-admin helper as a SECURITY DEFINER predicate.
--
-- The tenant-scoping migration recreated this helper without SECURITY DEFINER.
-- The BOH user login policy calls the helper, while the helper queries boh_user;
-- under caller RLS that forms a recursive policy cycle and raises SQLSTATE 54001.
-- The helper derives identity and tenant exclusively from auth.uid(), uses a fixed
-- search path, and returns only a boolean authorization decision.

create or replace function public.is_boh_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
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

revoke all on function public.is_boh_super_admin() from public, anon;
grant execute on function public.is_boh_super_admin() to authenticated, service_role;

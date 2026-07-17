-- Remove the self-recursive BOH user SELECT policy introduced by the advisor
-- consolidation. Embedded BOH user relationships otherwise recurse through the
-- legacy BOH-user helper until PostgreSQL reaches its stack-depth limit.
--
-- BOH frontend access is tenant-exact: authenticated users may read only the
-- BOH users in the tenant resolved from their own authenticated BOH identity.

drop policy if exists "advisor_consolidated_select" on public.boh_user;
drop policy if exists "boh_user_select_same_tenant" on public.boh_user;

create policy "boh_user_select_same_tenant"
  on public.boh_user
  as permissive
  for select
  to authenticated
  using (tenant_id = public.current_boh_tenant_id());

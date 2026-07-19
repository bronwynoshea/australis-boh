-- BOH-DEV ONLY — DELIBERATE VAULT ENABLEMENT AND NAMED USER GRANT.
-- DO NOT AUTO-EXECUTE. This is data/entitlement SQL, not a schema migration.
--
-- Before an approved run, replace BOTH values below with the reviewed BOH user
-- display name and public.boh_user.id UUID. No role, email, or super-admin inference
-- is performed. Safety default is ROLLBACK.
begin;

do $$
declare
  target_tenant_slug constant text := 'australis';
  target_user_name constant text := 'REPLACE WITH REVIEWED BOH USER NAME';
  target_boh_user_id constant uuid := '00000000-0000-0000-0000-000000000000';
  target_tenant_id uuid;
  target_app_id uuid;
  grant_inserted integer;
begin
  if target_user_name like 'REPLACE %'
     or target_boh_user_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Replace the reviewed user name and BOH user UUID before execution.';
  end if;

  select id into strict target_tenant_id
  from public.boh_tenant
  where slug = target_tenant_slug and status = 'active';

  select id into strict target_app_id
  from public.boh_app
  where slug = 'vault' and app_context = 'boh' and is_active;

  if not exists (
    select 1
    from public.boh_user user_row
    join public.boh_tenant_member member
      on member.user_id = user_row.id and member.tenant_id = target_tenant_id
    where user_row.id = target_boh_user_id
      and user_row.status = 'active'
      and user_row.app_context = 'boh'
      and member.membership_status = 'active'
  ) then
    raise exception 'Named user % (%) is not an active BOH member of tenant %.',
      target_user_name, target_boh_user_id, target_tenant_slug;
  end if;

  insert into public.boh_tenant_app(
    tenant_id, app_id, status, app_kind, display_name, launch_route, external_url, metadata
  ) values (
    target_tenant_id, target_app_id, 'enabled', 'boh', 'Vault', '/vault', null,
    jsonb_build_object('enabled_for', 'boh-dev-security-review', 'enabled_manually', true)
  )
  on conflict (tenant_id, app_id) do update
  set status = 'enabled',
      app_kind = 'boh',
      display_name = 'Vault',
      launch_route = '/vault',
      external_url = null,
      metadata = public.boh_tenant_app.metadata || excluded.metadata,
      updated_at = now();

  insert into public.boh_vault_access_grants(
    tenant_id, boh_user_id, role, environment, status, granted_by
  ) values (
    target_tenant_id, target_boh_user_id, 'vault_admin', 'development', 'active', target_boh_user_id
  )
  on conflict do nothing;
  get diagnostics grant_inserted = row_count;

  if grant_inserted = 1 then
    insert into public.boh_vault_audit_events(
      tenant_id, actor_boh_user_id, service_identity, event_type, request_id,
      environment, subject_type, subject_id, metadata
    )
    select
      target_tenant_id,
      target_boh_user_id,
      'boh-dev-reviewed-bootstrap',
      'grant_created',
      'boh-dev-initial-vault-admin-' || target_boh_user_id::text,
      'development',
      'access_grant',
      grant_row.id,
      jsonb_build_object(
        'role', grant_row.role,
        'status', grant_row.status,
        'grantee_id', grant_row.boh_user_id,
        'bootstrap', true
      )
    from public.boh_vault_access_grants grant_row
    where grant_row.tenant_id = target_tenant_id
      and grant_row.boh_user_id = target_boh_user_id
      and grant_row.role = 'vault_admin'
      and grant_row.environment = 'development'
      and grant_row.status = 'active';
  end if;

  if not exists (
    select 1 from public.boh_vault_access_grants
    where tenant_id = target_tenant_id
      and boh_user_id = target_boh_user_id
      and role = 'vault_admin'
      and environment = 'development'
      and status = 'active'
  ) then
    raise exception 'The deliberate development Vault grant was not created for % (%).',
      target_user_name, target_boh_user_id;
  end if;

  raise notice 'REVIEW ONLY: enabled BOH-DEV Vault for tenant % and granted development vault_admin to % (%).',
    target_tenant_slug, target_user_name, target_boh_user_id;
end $$;

select tenant.slug as tenant_slug, tenant_app.status as vault_status
from public.boh_tenant_app tenant_app
join public.boh_tenant tenant on tenant.id = tenant_app.tenant_id
join public.boh_app app on app.id = tenant_app.app_id
where tenant.slug = 'australis' and app.slug = 'vault';

rollback; -- Change only to COMMIT during an explicitly approved BOH-DEV run.

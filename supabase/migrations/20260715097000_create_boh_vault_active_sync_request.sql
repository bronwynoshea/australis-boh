-- Resolve the exact active protected version server-side when a user requests
-- synchronization from the BOH Vault UI. Browsers never need key/version-table access.

create or replace function public.boh_vault_request_active_sync_run(
  requested_tenant_id uuid,
  requested_binding_id uuid,
  requested_actor_boh_user_id uuid,
  requested_service_identity text,
  requested_request_id text,
  requested_run_request_id text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  binding_row public.boh_vault_sync_bindings%rowtype;
  active_version_id uuid;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode = '42501';
  end if;

  select * into binding_row
  from public.boh_vault_sync_bindings
  where tenant_id = requested_tenant_id
    and id = requested_binding_id
    and state = 'ready'
  for update;
  if not found then
    raise exception 'Ready sync binding not found' using errcode = '23503';
  end if;

  perform public.boh_vault_assert_sync_actor(
    requested_tenant_id,
    requested_actor_boh_user_id,
    binding_row.environment,
    array['vault_admin','sync_operator']::text[],
    requested_service_identity
  );

  select secret_version.id into active_version_id
  from public.boh_vault_secret_versions secret_version
  where secret_version.tenant_id = requested_tenant_id
    and secret_version.vault_item_id = binding_row.vault_item_id
    and secret_version.item_field_id = binding_row.item_field_id
    and secret_version.state = 'active'
  for share;
  if active_version_id is null then
    raise exception 'Active protected version for binding not found' using errcode = '23503';
  end if;

  return public.boh_vault_request_sync_run(
    requested_tenant_id,
    requested_binding_id,
    active_version_id,
    requested_actor_boh_user_id,
    requested_service_identity,
    requested_request_id,
    requested_run_request_id
  );
end;
$$;

revoke all on function public.boh_vault_request_active_sync_run(uuid,uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.boh_vault_request_active_sync_run(uuid,uuid,uuid,text,text,text)
  to service_role;

comment on function public.boh_vault_request_active_sync_run(uuid,uuid,uuid,text,text,text) is
  'Queues synchronization for the exact active protected version behind a ready tenant-scoped binding.';

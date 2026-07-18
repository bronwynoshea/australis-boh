-- Service-only BOH Vault synchronization claim contract.
-- A claim atomically starts one exact queued run and returns only the encrypted
-- value envelope plus approved provider-neutral destination metadata.

create or replace function public.boh_vault_claim_sync_run(
  requested_tenant_id uuid,
  requested_run_id uuid,
  requested_actor_boh_user_id uuid,
  requested_service_identity text,
  requested_request_id text
)
returns table (
  run_id uuid,
  binding_id uuid,
  item_id uuid,
  item_field_id uuid,
  adapter_key text,
  adapter_version text,
  target_url text,
  destination_key text,
  sync_mode text,
  secret_version_id uuid,
  secret_version integer,
  ciphertext text,
  nonce text,
  wrapped_data_key text,
  secret_algorithm text,
  tenant_key_id uuid,
  wrapping_key_ref text,
  wrapped_key text,
  tenant_key_algorithm text
)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  run_environment text;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'service_role is required' using errcode = '42501';
  end if;
  if btrim(coalesce(requested_service_identity, '')) = ''
     or btrim(coalesce(requested_request_id, '')) = '' then
    raise exception 'Service identity and request ID are required' using errcode = '22023';
  end if;

  select sync_run.environment
  into run_environment
  from public.boh_vault_sync_runs sync_run
  where sync_run.tenant_id = requested_tenant_id
    and sync_run.id = requested_run_id
    and sync_run.status = 'queued'
  for update;
  if run_environment is null then
    raise exception 'Queued Vault sync run not found' using errcode = 'P0002';
  end if;
  if run_environment <> 'development' then
    raise exception 'Vault runtime synchronization is development-only' using errcode = '42501';
  end if;

  perform public.boh_vault_start_sync_run(
    requested_tenant_id,
    requested_run_id,
    requested_actor_boh_user_id,
    requested_service_identity,
    requested_request_id
  );

  return query
  select
    sync_run.id,
    binding.id,
    sync_run.vault_item_id,
    sync_run.item_field_id,
    adapter.adapter_key,
    adapter.adapter_version,
    target.external_target_ref,
    binding.destination_key,
    binding.sync_mode,
    secret_version.id,
    secret_version.version,
    secret_version.ciphertext,
    secret_version.nonce,
    secret_version.wrapped_data_key,
    secret_version.algorithm,
    tenant_key.id,
    tenant_key.wrapping_key_ref,
    tenant_key.wrapped_key,
    tenant_key.algorithm
  from public.boh_vault_sync_runs sync_run
  join public.boh_vault_sync_bindings binding
    on binding.tenant_id = sync_run.tenant_id
   and binding.id = sync_run.binding_id
   and binding.vault_item_id = sync_run.vault_item_id
   and binding.item_field_id = sync_run.item_field_id
   and binding.environment = sync_run.environment
   and binding.state = 'ready'
  join public.boh_vault_deployment_targets target
    on target.tenant_id = binding.tenant_id
   and target.id = binding.deployment_target_id
   and target.environment = binding.environment
   and target.status = 'active'
  join public.boh_vault_deployment_adapters adapter
    on adapter.id = target.adapter_id
   and adapter.status = 'active'
  join public.boh_vault_secret_versions secret_version
    on secret_version.tenant_id = sync_run.tenant_id
   and secret_version.id = sync_run.secret_version_id
   and secret_version.vault_item_id = sync_run.vault_item_id
   and secret_version.item_field_id = sync_run.item_field_id
   and secret_version.state in ('active','superseded')
  join public.boh_vault_tenant_keys tenant_key
    on tenant_key.tenant_id = secret_version.tenant_id
   and tenant_key.id = secret_version.tenant_key_id
   and tenant_key.state in ('active','retired')
  where sync_run.tenant_id = requested_tenant_id
    and sync_run.id = requested_run_id
    and sync_run.status = 'running'
  for share of binding, target, adapter, secret_version, tenant_key;

  if not found then
    raise exception 'Exact ready sync binding, destination, version, or key not found' using errcode = '23503';
  end if;
end;
$$;

revoke all on function public.boh_vault_claim_sync_run(uuid,uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.boh_vault_claim_sync_run(uuid,uuid,uuid,text,text)
  to service_role;

comment on function public.boh_vault_claim_sync_run(uuid,uuid,uuid,text,text) is
  'Development-only service claim for one exact Vault sync run. Returns encrypted envelope and approved destination metadata, never plaintext.';

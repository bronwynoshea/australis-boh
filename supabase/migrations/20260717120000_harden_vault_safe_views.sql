-- Resolve Vault Security Advisor findings without exposing protected material.
-- Safe views execute as the signed-in caller, base-table access is column-limited,
-- RLS remains authoritative, and internal role helpers leave the exposed schema.
begin;

create schema if not exists private;

alter function public.boh_vault_current_user_id(uuid) set schema private;
alter function public.boh_vault_has_role(uuid,text[],text) set schema private;

create or replace function private.boh_vault_has_role(
  requested_tenant_id uuid,
  allowed_roles text[],
  requested_environment text default null
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select public.boh_vault_user_has_role(
    requested_tenant_id,
    private.boh_vault_current_user_id(requested_tenant_id),
    allowed_roles,
    requested_environment
  )
$$;

revoke all on function private.boh_vault_current_user_id(uuid) from public, anon;
revoke all on function private.boh_vault_has_role(uuid,text[],text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.boh_vault_current_user_id(uuid) to authenticated;
grant execute on function private.boh_vault_has_role(uuid,text[],text) to authenticated;

alter view public.boh_vault_items_safe set (security_invoker = true);
alter view public.boh_vault_item_fields_safe set (security_invoker = true);
alter view public.boh_vault_collections_safe set (security_invoker = true);
alter view public.boh_vault_collection_items_safe set (security_invoker = true);
alter view public.boh_vault_audit_events_safe set (security_invoker = true);
alter view public.boh_vault_deployment_targets_safe set (security_invoker = true);
alter view public.boh_vault_sync_bindings_safe set (security_invoker = true);
alter view public.boh_vault_sync_runs_safe set (security_invoker = true);
alter view public.boh_vault_access_grants_safe set (security_invoker = true);
alter view public.boh_vault_deployment_adapters_safe set (security_invoker = true);

grant select (
  id, tenant_id, item_key, display_name, item_type, provider_key, purpose,
  environment, description, notes, value_state, validation_state,
  last_validated_at, last_rotated_at, rotation_due_at, owner_boh_user_id,
  created_at, updated_at
) on public.boh_vault_items to authenticated;

grant select (
  id, tenant_id, vault_item_id, field_key, label, field_kind,
  plaintext_value, is_required, sort_order, created_at, updated_at
) on public.boh_vault_item_fields to authenticated;

grant select (
  id, tenant_id, environment, parent_collection_id, name, description,
  status, created_at, updated_at
) on public.boh_vault_collections to authenticated;

grant select (
  id, tenant_id, environment, collection_id, vault_item_id, created_at
) on public.boh_vault_collection_items to authenticated;

grant select (
  id, tenant_id, vault_item_id, actor_boh_user_id, service_identity,
  event_type, request_id, environment, subject_type, subject_id, metadata,
  created_at
) on public.boh_vault_audit_events to authenticated;

grant select (
  id, tenant_id, boh_user_id, role, environment, status, expires_at,
  granted_by, revoked_by, created_at, updated_at
) on public.boh_vault_access_grants to authenticated;

grant select (
  id, adapter_key, display_name, adapter_version, description,
  capabilities, configuration_schema, status
) on public.boh_vault_deployment_adapters to authenticated;

grant select (
  id, tenant_id, adapter_id, target_key, display_name, environment,
  external_target_ref, status, last_checked_at, created_at, updated_at
) on public.boh_vault_deployment_targets to authenticated;

grant select (
  id, tenant_id, vault_item_id, item_field_id, deployment_target_id,
  environment, destination_key, sync_mode, state,
  last_synced_secret_version_id, last_synced_at, created_at, updated_at
) on public.boh_vault_sync_bindings to authenticated;

grant select (
  id, tenant_id, binding_id, vault_item_id, item_field_id,
  secret_version_id, environment, status, attempt, request_id,
  result_code, started_at, completed_at, created_at
) on public.boh_vault_sync_runs to authenticated;

comment on schema private is 'Internal database helpers not exposed through the public API schema.';

commit;

-- Browser-safe BOH Vault administration reads required by the product UI.
-- These views expose authorization and adapter metadata only, never protected values,
-- cryptographic material, or destination authentication material.

create view public.boh_vault_access_grants_safe with (security_barrier = true) as
select
  access_grant.id,
  access_grant.tenant_id,
  access_grant.boh_user_id,
  access_grant.role,
  access_grant.environment,
  access_grant.status,
  access_grant.expires_at,
  access_grant.granted_by,
  access_grant.revoked_by,
  access_grant.created_at,
  access_grant.updated_at
from public.boh_vault_access_grants access_grant
where access_grant.environment is not null
  and public.boh_vault_has_role(
    access_grant.tenant_id,
    array['vault_admin']::text[],
    access_grant.environment
  );

create view public.boh_vault_deployment_adapters_safe with (security_barrier = true) as
select
  adapter.id,
  adapter.adapter_key,
  adapter.display_name,
  adapter.adapter_version,
  adapter.description,
  adapter.capabilities,
  adapter.configuration_schema,
  adapter.status
from public.boh_vault_deployment_adapters adapter
where adapter.status = 'active'
  and exists (
    select 1
    from public.boh_vault_access_grants access_grant
    where access_grant.boh_user_id = public.boh_vault_current_user_id(access_grant.tenant_id)
      and access_grant.status = 'active'
      and access_grant.environment is not null
      and (access_grant.expires_at is null or access_grant.expires_at > now())
      and public.boh_vault_has_role(
        access_grant.tenant_id,
        array['vault_admin','vault_editor','vault_viewer','sync_operator']::text[],
        access_grant.environment
      )
  );

revoke all on table public.boh_vault_access_grants_safe from public, anon;
revoke all on table public.boh_vault_deployment_adapters_safe from public, anon;
grant select on public.boh_vault_access_grants_safe to authenticated;
grant select on public.boh_vault_deployment_adapters_safe to authenticated;

comment on view public.boh_vault_access_grants_safe is
  'Vault-admin authorization metadata for the tenant and environment; contains no protected values.';
comment on view public.boh_vault_deployment_adapters_safe is
  'Non-secret active synchronization adapter catalogue visible to users with active Vault access.';

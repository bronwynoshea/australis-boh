-- BOH-DEV ONLY — REVIEWED LEGACY METADATA IMPORT — DO NOT AUTO-EXECUTE.
--
-- Imports names/status/classification/provider metadata from public.central_credentials
-- into the canonical tenant-scoped BOH Vault. It deliberately does NOT select or
-- copy public_value, encrypted_value, notes, ciphertext, or any raw value.
-- Target tenant: public.boh_tenant.slug = 'australis'.
-- Safe to review/re-run after the four 2026071509xxxx migrations are applied to BOH-DEV.
begin;

-- Fail closed if the inspected legacy/core shapes are not present. This prevents
-- a guessed upsert against a drifted BOH-DEV schema.
do $$
declare
  missing_columns text;
begin
  if to_regclass('public.central_credentials') is null then
    raise exception 'Missing public.central_credentials; metadata import cannot run.';
  end if;

  select string_agg(required.column_name, ', ' order by required.column_name)
  into missing_columns
  from (values
    ('id'), ('app_key'), ('environment'), ('name'), ('provider'),
    ('classification'), ('value_status'), ('source_system'), ('source_project_ref'),
    ('created_at'), ('updated_at'), ('last_rotated_at')
  ) required(column_name)
  where not exists (
    select 1
    from information_schema.columns actual
    where actual.table_schema = 'public'
      and actual.table_name = 'central_credentials'
      and actual.column_name = required.column_name
  );

  if missing_columns is not null then
    raise exception 'central_credentials is missing reviewed columns: %', missing_columns;
  end if;

  if not exists (select 1 from public.boh_tenant where slug = 'australis') then
    raise exception 'Missing BOH-DEV tenant slug=australis.';
  end if;
end $$;

-- Stable import keys include the immutable legacy UUID so duplicate legacy names do
-- not collide. Only canonical development/production metadata is eligible.
with legacy_metadata as (
  select
    tenant.id as tenant_id,
    credential.id as legacy_credential_id,
    'legacy-central-' || credential.id::text as item_key,
    coalesce(nullif(btrim(credential.name), ''), 'Legacy credential ' || credential.id::text) as display_name,
    nullif(btrim(credential.provider), '') as provider_key,
    credential.environment,
    'needs_setup'::text as value_state, -- no values are imported; legacy status remains bridge metadata only
    credential.app_key,
    credential.name,
    credential.provider,
    credential.classification,
    credential.value_status,
    credential.source_system,
    credential.source_project_ref,
    credential.created_at,
    credential.updated_at,
    credential.last_rotated_at
  from public.central_credentials credential
  cross join public.boh_tenant tenant
  where tenant.slug = 'australis'
    and credential.environment in ('development', 'production')
), upsert_items as (
  insert into public.boh_vault_items (
    tenant_id, item_key, display_name, item_type, provider_key, purpose,
    environment, description, notes, value_state, validation_state,
    last_rotated_at, created_at, updated_at
  )
  select
    tenant_id,
    item_key,
    display_name,
    'credential',
    provider_key,
    coalesce(nullif(btrim(app_key), ''), 'legacy_central_metadata'),
    environment,
    'Imported legacy Central credential metadata; value intentionally not imported.',
    null,
    value_state,
    'unchecked',
    null, -- no protected value/version was imported, so no Vault rotation occurred
    coalesce(created_at, now()),
    coalesce(updated_at, now())
  from legacy_metadata
  on conflict (tenant_id, environment, item_key) do update
  set display_name = excluded.display_name,
      provider_key = excluded.provider_key,
      purpose = excluded.purpose,
      value_state = 'needs_setup',
      last_rotated_at = null,
      updated_at = greatest(public.boh_vault_items.updated_at, excluded.updated_at)
  returning tenant_id, id, item_key
)
insert into public.boh_vault_legacy_credential_bridge (
  tenant_id, legacy_credential_id, vault_item_id, legacy_app_key,
  legacy_environment, legacy_name, legacy_provider, legacy_classification,
  legacy_value_status
)
select
  metadata.tenant_id,
  metadata.legacy_credential_id,
  item.id,
  metadata.app_key,
  metadata.environment,
  metadata.name,
  metadata.provider,
  metadata.classification,
  metadata.value_status
from legacy_metadata metadata
join public.boh_vault_items item
  on item.tenant_id = metadata.tenant_id
 and item.environment = metadata.environment
 and item.item_key = metadata.item_key
on conflict (tenant_id, legacy_credential_id) do update
set vault_item_id = excluded.vault_item_id,
    legacy_app_key = excluded.legacy_app_key,
    legacy_environment = excluded.legacy_environment,
    legacy_name = excluded.legacy_name,
    legacy_provider = excluded.legacy_provider,
    legacy_classification = excluded.legacy_classification,
    legacy_value_status = excluded.legacy_value_status,
    imported_at = now();

-- Define the expected field without copying a value. Secret-classified legacy rows
-- become protected fields; all other rows remain empty plaintext field definitions.
insert into public.boh_vault_item_fields (
  tenant_id, vault_item_id, field_key, label, field_kind, plaintext_value, sort_order
)
select
  bridge.tenant_id,
  bridge.vault_item_id,
  'value',
  'Value',
  case when bridge.legacy_classification = 'secret' then 'protected' else 'plaintext' end,
  null,
  0
from public.boh_vault_legacy_credential_bridge bridge
join public.boh_tenant tenant on tenant.id = bridge.tenant_id and tenant.slug = 'australis'
on conflict (tenant_id, vault_item_id, field_key) do update
set label = excluded.label,
    field_kind = excluded.field_kind,
    plaintext_value = null,
    updated_at = now();

insert into public.boh_vault_audit_events (
  tenant_id, vault_item_id, service_identity, event_type, environment,
  subject_type, subject_id, metadata
)
select
  bridge.tenant_id,
  bridge.vault_item_id,
  'boh-dev-legacy-metadata-import',
  'legacy_metadata_imported',
  bridge.legacy_environment,
  'legacy_credential_bridge',
  bridge.id,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_app_key', bridge.legacy_app_key,
    'legacy_name', bridge.legacy_name,
    'legacy_provider', bridge.legacy_provider,
    'legacy_classification', bridge.legacy_classification,
    'legacy_value_status', bridge.legacy_value_status
  ))
from public.boh_vault_legacy_credential_bridge bridge
join public.boh_tenant tenant on tenant.id = bridge.tenant_id and tenant.slug = 'australis'
where not exists (
  select 1
  from public.boh_vault_audit_events event
  where event.tenant_id = bridge.tenant_id
    and event.event_type = 'legacy_metadata_imported'
    and event.subject_type = 'legacy_credential_bridge'
    and event.subject_id = bridge.id
);

-- Review-only verification: counts and states, never values.
select
  item.environment,
  item.value_state,
  count(*) as imported_item_count
from public.boh_vault_legacy_credential_bridge bridge
join public.boh_vault_items item
  on item.tenant_id = bridge.tenant_id and item.id = bridge.vault_item_id
join public.boh_tenant tenant on tenant.id = bridge.tenant_id
where tenant.slug = 'australis'
group by item.environment, item.value_state
order by item.environment, item.value_state;

rollback; -- Safety default. Change to COMMIT only during an explicitly approved BOH-DEV run.

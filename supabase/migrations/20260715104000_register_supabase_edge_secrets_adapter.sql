-- Register the development-only Supabase Edge Function Secrets adapter.
-- The Edge Function enforces an explicit project-ref allowlist before decrypting
-- and dispatching any protected value.
begin;

insert into public.boh_vault_deployment_adapters (
  id,
  adapter_key,
  display_name,
  adapter_version,
  description,
  capabilities,
  configuration_schema,
  status
) values (
  'a45d39c5-6af2-4abc-99e9-b038994f32ef'::uuid,
  'supabase_edge_secrets',
  'Supabase Edge Secrets',
  'v1',
  'Creates or updates an Edge Function secret in an explicitly approved Supabase development project.',
  jsonb_build_object(
    'runtime_delivery_sync', true,
    'development_only', true,
    'creates_or_updates', true
  ),
  jsonb_build_object(
    'target_reference', jsonb_build_object(
      'type', 'supabase_project_ref',
      'protected', false
    ),
    'destination_key', jsonb_build_object(
      'type', 'environment_secret_name',
      'protected', false
    )
  ),
  'active'
)
on conflict (adapter_key) do update
set display_name = excluded.display_name,
    adapter_version = excluded.adapter_version,
    description = excluded.description,
    capabilities = excluded.capabilities,
    configuration_schema = excluded.configuration_schema,
    status = excluded.status;

commit;

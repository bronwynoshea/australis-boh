-- Register the development-only Cloudflare Worker Secrets adapter.
-- The Edge Function enforces explicit account and Worker allowlists before
-- decrypting and dispatching any protected value.
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
  '3570fe71-f5b2-4848-9462-49abb7535f0d'::uuid,
  'cloudflare_worker_secrets',
  'Cloudflare Worker Secrets',
  'v1',
  'Creates or updates a Worker secret in an explicitly approved Cloudflare development Worker.',
  jsonb_build_object(
    'runtime_delivery_sync', true,
    'development_only', true,
    'creates_or_updates', true
  ),
  jsonb_build_object(
    'target_reference', jsonb_build_object(
      'type', 'cloudflare_account_and_worker',
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

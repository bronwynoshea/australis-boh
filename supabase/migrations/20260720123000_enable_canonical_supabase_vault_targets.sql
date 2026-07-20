-- The central Vault can deliver to explicitly allow-listed Supabase projects
-- in either canonical environment. Authorization and destination safety remain
-- enforced by exact environment grants and the Edge Function project-ref allowlist.
begin;

update public.boh_vault_deployment_adapters
set description = 'Creates or updates an Edge Function secret in an explicitly approved Supabase project.',
    capabilities = (capabilities - 'development_only') || jsonb_build_object(
      'supported_environments', jsonb_build_array('development', 'production')
    )
where adapter_key = 'supabase_edge_secrets';

commit;

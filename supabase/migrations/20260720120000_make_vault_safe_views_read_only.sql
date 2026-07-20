-- Ensure browser-facing Vault views are read-only even when the hosting
-- Supabase project grants broad default privileges on newly created views.
begin;

do $do$
declare
  safe_view text;
begin
  foreach safe_view in array array[
    'boh_vault_items_safe',
    'boh_vault_item_fields_safe',
    'boh_vault_collections_safe',
    'boh_vault_collection_items_safe',
    'boh_vault_audit_events_safe',
    'boh_vault_access_grants_safe',
    'boh_vault_deployment_adapters_safe',
    'boh_vault_deployment_targets_safe',
    'boh_vault_sync_bindings_safe',
    'boh_vault_sync_runs_safe'
  ]
  loop
    execute format(
      'revoke all on table public.%I from public, anon, authenticated, service_role',
      safe_view
    );
    execute format(
      'grant select on table public.%I to authenticated',
      safe_view
    );
  end loop;
end;
$do$;

commit;

-- Prepare an additive, metadata-only bridge from legacy central_credentials.
-- This migration does not import rows, does not read legacy values, and does not
-- make the legacy Central tables canonical. The reviewed BOH-DEV manual SQL is a
-- separate artifact and must not be executed automatically.
begin;

create table public.boh_vault_legacy_credential_bridge (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.boh_tenant(id) on delete cascade,
  legacy_credential_id uuid not null,
  vault_item_id uuid not null,
  legacy_app_key text,
  legacy_environment text,
  legacy_name text,
  legacy_provider text,
  legacy_classification text,
  legacy_value_status text,
  imported_by uuid,
  imported_at timestamptz not null default now(),
  unique (tenant_id, legacy_credential_id),
  unique (tenant_id, vault_item_id),
  constraint boh_vault_legacy_bridge_tenant_item_fk
    foreign key (tenant_id, vault_item_id)
    references public.boh_vault_items (tenant_id, id) on delete restrict,
  constraint boh_vault_legacy_bridge_imported_by_fk
    foreign key (tenant_id, imported_by)
    references public.boh_tenant_member (tenant_id, user_id),
  constraint boh_vault_legacy_bridge_environment_guard
    check (legacy_environment is null or legacy_environment in ('development', 'production'))
);

create index boh_vault_legacy_bridge_item_idx
  on public.boh_vault_legacy_credential_bridge (tenant_id, vault_item_id);

alter table public.boh_vault_legacy_credential_bridge enable row level security;
revoke all on table public.boh_vault_legacy_credential_bridge from anon, authenticated, service_role;
-- No browser policy: the bridge is backend/migration metadata only.

comment on table public.boh_vault_legacy_credential_bridge is
  'Backend-only metadata mapping from legacy central_credentials IDs to canonical tenant-scoped BOH Vault items. It never stores or imports public_value, encrypted_value, ciphertext, or raw secrets.';
comment on column public.boh_vault_legacy_credential_bridge.legacy_credential_id is
  'Legacy central_credentials.id recorded without an FK so legacy retirement is not blocked.';

commit;

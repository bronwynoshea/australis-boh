import { supabase } from '../../../lib/supabase';
import { buildVaultCreateFields, type VaultItemKind } from '../vaultItemKinds';

export type VaultEnvironment = 'development' | 'production';

export type VaultItem = {
  id: string;
  tenant_id: string;
  item_key: string;
  display_name: string;
  item_type: string;
  provider_key: string | null;
  purpose: string | null;
  environment: VaultEnvironment;
  description: string | null;
  notes: string | null;
  value_state: string;
  validation_state: string;
  last_rotated_at: string | null;
  rotation_due_at: string | null;
  updated_at: string;
};

export type VaultField = {
  id: string;
  tenant_id: string;
  vault_item_id: string;
  field_key: string;
  label: string;
  field_kind: 'plaintext' | 'protected';
  plaintext_value: string | null;
  is_required: boolean;
  sort_order: number;
  updated_at: string;
};

export type VaultAuditEvent = {
  id: string;
  event_type: string;
  environment: VaultEnvironment;
  subject_type: string;
  subject_id: string;
  vault_item_id: string | null;
  actor_boh_user_id: string | null;
  created_at: string;
};

export type VaultGrant = {
  id: string;
  boh_user_id: string;
  role: string;
  environment: VaultEnvironment;
  status: string;
  expires_at: string | null;
  updated_at: string;
};

export type VaultAdapter = { id: string; adapter_key: string; display_name: string; adapter_version: string; description: string | null };
export type VaultTarget = { id: string; adapter_key: string; adapter_name: string; target_key: string; display_name: string; environment: VaultEnvironment; external_target_ref: string | null; status: string; updated_at: string };
export type VaultBinding = { id: string; vault_item_id: string; item_field_id: string; deployment_target_id: string; environment: VaultEnvironment; destination_key: string; sync_mode: string; state: string; last_synced_at: string | null };
export type VaultRun = { id: string; binding_id: string; vault_item_id: string; status: string; attempt: number; result_code: string | null; created_at: string; completed_at: string | null };
export type BohUserOption = { id: string; full_name: string | null; email: string | null };

function fail(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

async function invoke<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) fail(error, 'The Vault action could not be completed.');
  if (!data || data.ok === false) throw new Error(data?.error || 'The Vault action could not be completed.');
  return data as T;
}

function requestId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function common(tenantId: string, action: string) {
  return { tenantId, action, environment: 'development', requestId: requestId(action) };
}

export async function listVaultItems(tenantId: string): Promise<VaultItem[]> {
  const { data, error } = await supabase.from('boh_vault_items_safe').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false });
  if (error) fail(error, 'Unable to load Vault items.');
  return (data ?? []) as VaultItem[];
}

export async function listVaultFields(tenantId: string, itemId: string): Promise<VaultField[]> {
  const { data, error } = await supabase.from('boh_vault_item_fields_safe').select('*').eq('tenant_id', tenantId).eq('vault_item_id', itemId).order('sort_order');
  if (error) fail(error, 'Unable to load Vault fields.');
  return (data ?? []) as VaultField[];
}

export async function listVaultActivity(tenantId: string): Promise<VaultAuditEvent[]> {
  const { data, error } = await supabase.from('boh_vault_audit_events_safe').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
  if (error) fail(error, 'Unable to load Vault activity.');
  return (data ?? []) as VaultAuditEvent[];
}

export async function listVaultAccess(tenantId: string): Promise<VaultGrant[]> {
  const { data, error } = await supabase.from('boh_vault_access_grants_safe').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false });
  if (error) fail(error, 'Unable to load Vault access.');
  return (data ?? []) as VaultGrant[];
}

export async function listBohUsers(tenantId: string): Promise<BohUserOption[]> {
  const { data, error } = await supabase.from('boh_user').select('id,full_name,email').eq('tenant_id', tenantId).eq('app_context', 'boh').eq('status', 'active').order('full_name');
  if (error) fail(error, 'Unable to load BOH users.');
  return (data ?? []) as BohUserOption[];
}

export async function listVaultSync(tenantId: string) {
  const [adapters, targets, bindings, runs] = await Promise.all([
    supabase.from('boh_vault_deployment_adapters_safe').select('id,adapter_key,display_name,adapter_version,description').order('display_name'),
    supabase.from('boh_vault_deployment_targets_safe').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false }),
    supabase.from('boh_vault_sync_bindings_safe').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false }),
    supabase.from('boh_vault_sync_runs_safe').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50),
  ]);
  for (const result of [adapters, targets, bindings, runs]) if (result.error) fail(result.error, 'Unable to load synchronization.');
  return {
    adapters: (adapters.data ?? []) as VaultAdapter[],
    targets: (targets.data ?? []) as VaultTarget[],
    bindings: (bindings.data ?? []) as VaultBinding[],
    runs: (runs.data ?? []) as VaultRun[],
  };
}

export async function createVaultItem(tenantId: string, input: {
  displayName: string; kind: VaultItemKind; websiteUrl: string; username: string;
  providerKey: string; description: string; referenceName: string; protectedValue: string;
}): Promise<string> {
  const itemId = crypto.randomUUID();
  const slug = input.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'vault-item';
  await invoke('boh-vault-manage', {
    ...common(tenantId, 'upsert_item'), itemId, itemKey: `${slug}-${itemId.slice(0, 8)}`,
    displayName: input.displayName, itemType: input.kind === 'password' ? 'login' : 'credential',
    providerKey: input.providerKey || null, purpose: null, description: input.description.trim() || null, notes: null,
  });

  let protectedFieldId = '';
  const fields = buildVaultCreateFields(input);
  for (const field of fields) {
    const fieldId = crypto.randomUUID();
    await invoke('boh-vault-manage', {
      ...common(tenantId, 'upsert_field'), fieldId, itemId,
      fieldKey: field.fieldKey, label: field.label, fieldKind: field.fieldKind,
      plaintextValue: field.plaintextValue, isRequired: field.isRequired,
      sortOrder: field.sortOrder, metadata: {},
    });
    if (field.fieldKind === 'protected') protectedFieldId = fieldId;
  }
  if (input.protectedValue) {
    await setVaultValue(tenantId, itemId, protectedFieldId, input.protectedValue);
  }
  return itemId;
}

export async function deleteVaultItem(tenantId: string, itemId: string): Promise<void> {
  await invoke('boh-vault-manage', { ...common(tenantId, 'delete_item'), itemId });
}

export async function updateVaultItemDetails(tenantId: string, input: {
  itemId: string;
  displayName: string;
  providerKey: string;
  description: string;
  protectedFieldId: string | null;
  referenceName: string | null;
}): Promise<void> {
  await invoke('boh-vault-manage', { ...common(tenantId, 'update_item_details'), ...input });
}

export async function setVaultValue(tenantId: string, itemId: string, fieldId: string, value: string): Promise<void> {
  await invoke('boh-vault-secret', { ...common(tenantId, 'set'), itemId, fieldId, value });
}

export async function readVaultValue(tenantId: string, itemId: string, fieldId: string, action: 'reveal' | 'copy'): Promise<string> {
  const result = await invoke<{ ok: true; value: string }>('boh-vault-secret', { ...common(tenantId, action), itemId, fieldId });
  return result.value;
}

export async function saveVaultGrant(tenantId: string, input: { grantId?: string; bohUserId: string; role: string; status: string }): Promise<void> {
  await invoke('boh-vault-manage', { ...common(tenantId, 'mutate_grant'), grantId: input.grantId || crypto.randomUUID(), bohUserId: input.bohUserId, role: input.role, status: input.status });
}

export async function createVaultTarget(tenantId: string, input: { adapterId: string; displayName: string; targetKey: string; targetUrl: string }): Promise<void> {
  await invoke('boh-vault-manage', { ...common(tenantId, 'create_target'), adapterId: input.adapterId, displayName: input.displayName, targetKey: input.targetKey, externalTargetRef: input.targetUrl, metadata: {} });
}

export async function createVaultBinding(tenantId: string, input: { itemId: string; fieldId: string; targetId: string; destinationKey: string }): Promise<void> {
  const result = await invoke<{ ok: true; id: string }>('boh-vault-manage', { ...common(tenantId, 'create_binding'), ...input, syncMode: 'runtime_secret_sync' });
  await invoke('boh-vault-manage', { ...common(tenantId, 'update_binding'), bindingId: result.id, state: 'ready' });
}

export async function removeVaultBinding(tenantId: string, bindingId: string): Promise<void> {
  await invoke('boh-vault-manage', { ...common(tenantId, 'update_binding'), bindingId, state: 'disabled' });
}

export async function runVaultSync(tenantId: string, bindingId: string): Promise<void> {
  const queued = await invoke<{ ok: true; id: string }>('boh-vault-manage', { ...common(tenantId, 'request_sync'), bindingId, runRequestId: requestId('vault-sync-run') });
  await invoke('boh-vault-sync', { tenantId, runId: queued.id, environment: 'development', requestId: requestId('vault-sync-dispatch') });
}

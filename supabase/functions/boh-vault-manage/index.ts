import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';
import { createVaultManageHandler, type VaultManageDependencies } from '../_shared/vaultManageApi.ts';
import { VaultApiError } from '../_shared/vaultSecretApi.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const serviceIdentity = 'boh-vault-manage-edge-v1';

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function mapDatabaseError(error: { code?: string } | null): never {
  const code = error?.code ?? 'unknown';
  if (code === '42501') throw new VaultApiError(403, 'forbidden');
  if (code === 'P0002' || code === '23503') throw new VaultApiError(404, 'not_found');
  if (code === '23505') throw new VaultApiError(409, 'conflict');
  if (code === '22023' || code === '23514') throw new VaultApiError(400, 'invalid_request');
  console.error('[boh-vault-manage] database operation failed', { code });
  throw new Error('Vault management database operation failed');
}

async function rpcId(name: string, parameters: Record<string, unknown>): Promise<string> {
  const { data, error } = await serviceClient.rpc(name, parameters);
  if (error) mapDatabaseError(error);
  if (typeof data !== 'string') throw new Error(`${name} returned no identifier`);
  return data;
}

async function rpcVoid(name: string, parameters: Record<string, unknown>): Promise<void> {
  const { error } = await serviceClient.rpc(name, parameters);
  if (error) mapDatabaseError(error);
}

const dependencies: VaultManageDependencies = {
  async resolveActor(authorization, tenantId) {
    const token = authorization.slice('Bearer '.length).trim();
    if (!token) throw new VaultApiError(401, 'unauthorized');
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) throw new VaultApiError(401, 'unauthorized');
    const { data, error } = await serviceClient
      .from('boh_user')
      .select('id')
      .eq('auth_user_id', authData.user.id)
      .eq('tenant_id', tenantId)
      .eq('app_context', 'boh')
      .eq('status', 'active')
      .maybeSingle();
    if (error) mapDatabaseError(error);
    if (!data?.id) throw new VaultApiError(403, 'forbidden');
    return { id: String(data.id) };
  },

  upsertItem: (input) => rpcId('boh_vault_upsert_item_v3', {
    requested_item_id: input.itemId,
    requested_tenant_id: input.tenantId,
    requested_item_key: input.itemKey,
    requested_display_name: input.displayName,
    requested_item_type: input.itemType,
    requested_provider_key: input.providerKey,
    requested_project_workspace: input.projectWorkspace,
    requested_project_id: input.projectId,
    requested_switchboard_project_id: input.switchboardProjectId,
    requested_service_url: input.serviceUrl,
    requested_purpose: input.purpose,
    requested_environment: input.environment,
    requested_description: input.description,
    requested_notes: input.notes,
    requested_actor_boh_user_id: input.actorId,
    requested_request_id: input.requestId,
    requested_service_identity: serviceIdentity,
  }),

  updateItemDetails: (input) => rpcId('boh_vault_update_item_details_v4', {
    requested_item_id: input.itemId,
    requested_tenant_id: input.tenantId,
    requested_environment: input.environment,
    requested_display_name: input.displayName,
    requested_provider_key: input.providerKey,
    requested_project_workspace: input.projectWorkspace,
    requested_project_id: input.projectId,
    requested_switchboard_project_id: input.switchboardProjectId,
    requested_service_url: input.serviceUrl,
    requested_purpose: input.purpose,
    requested_description: input.description,
    requested_protected_field_id: input.protectedFieldId,
    requested_reference_name: input.referenceName,
    requested_actor_boh_user_id: input.actorId,
    requested_request_id: input.requestId,
    requested_service_identity: serviceIdentity,
  }),

  upsertField: (input) => rpcId('boh_vault_upsert_item_field', {
    requested_field_id: input.fieldId,
    requested_tenant_id: input.tenantId,
    requested_item_id: input.itemId,
    requested_environment: input.environment,
    requested_field_key: input.fieldKey,
    requested_label: input.label,
    requested_field_kind: input.fieldKind,
    requested_plaintext_value: input.plaintextValue,
    requested_is_required: input.isRequired,
    requested_sort_order: input.sortOrder,
    requested_metadata: input.metadata,
    requested_actor_boh_user_id: input.actorId,
    requested_request_id: input.requestId,
    requested_service_identity: serviceIdentity,
  }),

  deleteItem: (input) => rpcVoid('boh_vault_archive_item', {
    requested_tenant_id: input.tenantId,
    requested_item_id: input.itemId,
    requested_environment: input.environment,
    requested_actor_boh_user_id: input.actorId,
    requested_service_identity: serviceIdentity,
    requested_request_id: input.requestId,
  }),

  mutateGrant: (input) => rpcId('boh_vault_mutate_access_grant', {
    requested_grant_id: input.grantId,
    requested_tenant_id: input.tenantId,
    requested_boh_user_id: input.bohUserId,
    requested_role: input.role,
    requested_environment: input.environment,
    requested_status: input.status,
    requested_actor_boh_user_id: input.actorId,
    requested_request_id: input.requestId,
    requested_service_identity: serviceIdentity,
  }),

  createTarget: (input) => rpcId('boh_vault_create_deployment_target', {
    requested_tenant_id: input.tenantId,
    requested_adapter_id: input.adapterId,
    requested_target_key: input.targetKey,
    requested_display_name: input.displayName,
    requested_environment: input.environment,
    requested_external_target_ref: input.externalTargetRef,
    requested_actor_boh_user_id: input.actorId,
    requested_service_identity: serviceIdentity,
    requested_request_id: input.requestId,
    requested_metadata: input.metadata,
  }),

  createBinding: (input) => rpcId('boh_vault_create_sync_binding', {
    requested_tenant_id: input.tenantId,
    requested_item_id: input.itemId,
    requested_field_id: input.fieldId,
    requested_target_id: input.targetId,
    requested_environment: input.environment,
    requested_destination_key: input.destinationKey,
    requested_sync_mode: input.syncMode,
    requested_actor_boh_user_id: input.actorId,
    requested_service_identity: serviceIdentity,
    requested_request_id: input.requestId,
  }),

  updateBinding: (input) => rpcVoid('boh_vault_update_sync_binding', {
    requested_tenant_id: input.tenantId,
    requested_binding_id: input.bindingId,
    requested_state: input.state,
    requested_actor_boh_user_id: input.actorId,
    requested_service_identity: serviceIdentity,
    requested_request_id: input.requestId,
  }),

  requestSync: (input) => rpcId('boh_vault_request_active_sync_run', {
    requested_tenant_id: input.tenantId,
    requested_binding_id: input.bindingId,
    requested_actor_boh_user_id: input.actorId,
    requested_service_identity: serviceIdentity,
    requested_request_id: input.requestId,
    requested_run_request_id: input.runRequestId,
  }),
};

const handleVaultManage = createVaultManageHandler(dependencies);

Deno.serve(async (request: Request) => {
  const preflight = handleCors(request, { allowMethods: ['POST', 'OPTIONS'] });
  if (preflight) return preflight;
  const response = await handleVaultManage(request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(
    buildCorsHeaders(request, { allowMethods: ['POST', 'OPTIONS'] }),
  )) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
});

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';
import {
  createVaultSyncHandler,
  type ClaimedVaultSyncRun,
  type VaultSyncDependencies,
} from '../_shared/vaultSyncApi.ts';
import { VaultApiError } from '../_shared/vaultSecretApi.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const serviceIdentity = 'boh-vault-sync-edge-v1';
const allowedWebhookHosts = (Deno.env.get('BOH_VAULT_SYNC_ALLOWED_HOSTS') ?? '')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
const allowedSupabaseProjectRefs = (Deno.env.get('BOH_VAULT_SUPABASE_ALLOWED_PROJECT_REFS') ?? '')
  .split(',')
  .map((projectRef) => projectRef.trim().toLowerCase())
  .filter(Boolean);
const allowedCloudflareWorkerTargets = (Deno.env.get('BOH_VAULT_CLOUDFLARE_ALLOWED_TARGETS') ?? '')
  .split(',')
  .map((target) => target.trim().toLowerCase())
  .filter(Boolean);

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function mapDatabaseError(error: { code?: string } | null): never {
  const code = error?.code ?? 'unknown';
  if (code === '42501') throw new VaultApiError(403, 'forbidden');
  if (code === 'P0002' || code === '23503') throw new VaultApiError(404, 'not_found');
  if (code === '23505') throw new VaultApiError(409, 'conflict');
  console.error('[boh-vault-sync] database operation failed', { code });
  throw new Error('Vault sync database operation failed');
}

function firstRow<T>(data: T[] | T | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

const dependencies: VaultSyncDependencies = {
  masterKeyBase64: Deno.env.get('BOH_VAULT_MASTER_KEY_V1') ?? '',
  signingKeyBase64: Deno.env.get('BOH_VAULT_SYNC_SIGNING_KEY_V1') ?? '',
  serviceIdentity,
  allowedWebhookHosts,
  supabaseManagementToken: Deno.env.get('BOH_VAULT_SUPABASE_MANAGEMENT_TOKEN') ?? '',
  allowedSupabaseProjectRefs,
  cloudflareApiToken: Deno.env.get('BOH_VAULT_CLOUDFLARE_API_TOKEN') ?? '',
  allowedCloudflareWorkerTargets,
  maxAttempts: 3,

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

  async claimSyncRun(input) {
    const { data, error } = await serviceClient.rpc('boh_vault_claim_sync_run', {
      requested_tenant_id: input.tenantId,
      requested_run_id: input.runId,
      requested_actor_boh_user_id: input.actorId,
      requested_service_identity: serviceIdentity,
      requested_request_id: input.requestId,
    });
    if (error) mapDatabaseError(error);
    const row = firstRow<Record<string, unknown>>(data);
    if (!row) throw new VaultApiError(404, 'not_found');
    return {
      runId: String(row.run_id),
      itemId: String(row.item_id),
      fieldId: String(row.item_field_id),
      adapterKey: String(row.adapter_key),
      adapterVersion: String(row.adapter_version),
      targetUrl: String(row.target_url),
      destinationKey: String(row.destination_key),
      syncMode: String(row.sync_mode),
      secretVersionId: String(row.secret_version_id),
      tenantKeyId: String(row.tenant_key_id),
      wrappedKey: String(row.wrapped_key),
      wrappingKeyRef: String(row.wrapping_key_ref),
      tenantKeyAlgorithm: String(row.tenant_key_algorithm),
      ciphertext: String(row.ciphertext),
      nonce: String(row.nonce),
      wrappedDataKey: String(row.wrapped_data_key),
      secretAlgorithm: String(row.secret_algorithm),
    } as ClaimedVaultSyncRun;
  },

  async completeSyncRun(input) {
    const { error } = await serviceClient.rpc('boh_vault_complete_sync_run', {
      requested_tenant_id: input.tenantId,
      requested_run_id: input.runId,
      requested_result_code: input.resultCode,
      requested_actor_boh_user_id: input.actorId,
      requested_service_identity: serviceIdentity,
      requested_request_id: `${input.requestId}:completed`,
    });
    if (error) mapDatabaseError(error);
  },

  async failSyncRun(input) {
    const { error } = await serviceClient.rpc('boh_vault_fail_sync_run', {
      requested_tenant_id: input.tenantId,
      requested_run_id: input.runId,
      requested_result_code: input.resultCode,
      requested_actor_boh_user_id: input.actorId,
      requested_service_identity: serviceIdentity,
      requested_request_id: `${input.requestId}:failed`,
    });
    if (error) mapDatabaseError(error);
  },

  fetch: (request) => fetch(request),
  now: () => Math.floor(Date.now() / 1000),
  nonce: randomNonce,
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

const handleVaultSync = createVaultSyncHandler(dependencies);

Deno.serve(async (request: Request) => {
  const preflight = handleCors(request, { allowMethods: ['POST', 'OPTIONS'] });
  if (preflight) return preflight;
  const response = await handleVaultSync(request);
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(
    buildCorsHeaders(request, { allowMethods: ['POST', 'OPTIONS'] }),
  )) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
});

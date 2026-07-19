import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';
import {
  createVaultSecretHandler,
  VaultApiError,
  type VaultSecretDependencies,
  type VaultStoredSecretEnvelope,
  type VaultTenantKeyEnvelope,
} from '../_shared/vaultSecretApi.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const masterKeyBase64 = Deno.env.get('BOH_VAULT_MASTER_KEY_V1') ?? '';
const serviceIdentity = 'boh-vault-secret-edge-v1';

const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function bearerToken(authorization: string): string {
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) throw new VaultApiError(401, 'unauthorized');
  return token;
}

function mapDatabaseError(error: { code?: string; message?: string } | null): never {
  const code = error?.code ?? 'unknown';
  if (code === '42501') throw new VaultApiError(403, 'forbidden');
  if (code === 'P0002' || code === '23503') throw new VaultApiError(404, 'not_found');
  if (code === '23505') throw new VaultApiError(409, 'conflict');
  console.error('[boh-vault-secret] database operation failed', { code });
  throw new Error('Vault database operation failed');
}

function firstRow<T>(data: T[] | T | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

function mapTenantKey(row: Record<string, unknown>): VaultTenantKeyEnvelope {
  return {
    tenantKeyId: String(row.tenant_key_id),
    wrappedKey: String(row.wrapped_key),
    wrappingKeyRef: String(row.wrapping_key_ref),
    algorithm: String(row.algorithm),
  };
}

const dependencies: VaultSecretDependencies = {
  masterKeyBase64,
  serviceIdentity,

  async resolveActor(authorization, tenantId) {
    const token = bearerToken(authorization);
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

  async getActiveTenantKey(input) {
    const { data, error } = await serviceClient.rpc('boh_vault_get_active_tenant_key', {
      requested_tenant_id: input.tenantId,
      requested_actor_boh_user_id: input.actorId,
      requested_environment: input.environment,
      requested_service_identity: serviceIdentity,
      requested_request_id: input.requestId,
    });
    if (error?.code === 'P0002') return null;
    if (error) mapDatabaseError(error);
    const row = firstRow<Record<string, unknown>>(data);
    return row ? mapTenantKey(row) : null;
  },

  async initializeTenantKey(input) {
    const { data, error } = await serviceClient.rpc('boh_vault_initialize_tenant_key', {
      requested_tenant_id: input.tenantId,
      requested_actor_boh_user_id: input.actorId,
      requested_environment: input.environment,
      requested_wrapping_key_ref: input.wrappingKeyRef,
      requested_wrapped_key: input.wrappedKey,
      requested_service_identity: serviceIdentity,
      requested_request_id: input.requestId,
    });
    if (error) mapDatabaseError(error);
    const row = firstRow<Record<string, unknown>>(data);
    if (!row) throw new Error('Tenant-key initialization returned no row');
    return mapTenantKey(row);
  },

  async commitSecretVersion(input) {
    const { data, error } = await serviceClient.rpc('boh_vault_commit_secret_version', {
      requested_tenant_id: input.tenantId,
      requested_item_id: input.itemId,
      requested_field_id: input.fieldId,
      requested_tenant_key_id: input.tenantKeyId,
      requested_actor_boh_user_id: input.actorId,
      requested_ciphertext: input.ciphertext,
      requested_nonce: input.nonce,
      requested_wrapped_data_key: input.wrappedDataKey,
      requested_request_id: input.requestId,
      requested_service_identity: serviceIdentity,
    });
    if (error) mapDatabaseError(error);
    if (typeof data !== 'string') throw new Error('Secret commit returned no version ID');
    return data;
  },

  async readSecretEnvelope(input) {
    const { data, error } = await serviceClient.rpc('boh_vault_read_secret_envelope', {
      requested_tenant_id: input.tenantId,
      requested_item_id: input.itemId,
      requested_item_field_id: input.fieldId,
      requested_actor_boh_user_id: input.actorId,
      requested_environment: input.environment,
      requested_service_identity: serviceIdentity,
      requested_request_id: input.requestId,
      requested_audit_event: input.auditEvent,
    });
    if (error) mapDatabaseError(error);
    const row = firstRow<Record<string, unknown>>(data);
    if (!row) throw new VaultApiError(404, 'not_found');
    return {
      secretVersionId: String(row.secret_version_id),
      tenantKeyId: String(row.tenant_key_id),
      wrappedKey: String(row.wrapped_key),
      wrappingKeyRef: String(row.wrapping_key_ref),
      tenantKeyAlgorithm: String(row.tenant_key_algorithm),
      ciphertext: String(row.ciphertext),
      nonce: String(row.nonce),
      wrappedDataKey: String(row.wrapped_data_key),
      secretAlgorithm: String(row.secret_algorithm),
    } as VaultStoredSecretEnvelope;
  },
};

const handleVaultSecret = createVaultSecretHandler(dependencies);

Deno.serve(async (request: Request) => {
  const preflight = handleCors(request, { allowMethods: ['POST', 'OPTIONS'] });
  if (preflight) return preflight;

  const response = await handleVaultSecret(request);
  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders(request, { allowMethods: ['POST', 'OPTIONS'] });
  for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
});

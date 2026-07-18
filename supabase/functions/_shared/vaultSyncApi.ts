import { decodeMasterKey, decryptProtectedValue, unwrapTenantKey } from './vaultCrypto.ts';
import { createSignedWebhookRequest } from './vaultSignedWebhook.ts';
import { VaultApiError } from './vaultSecretApi.ts';

export type ClaimedVaultSyncRun = {
  runId: string;
  itemId: string;
  fieldId: string;
  adapterKey: string;
  adapterVersion: string;
  targetUrl: string;
  destinationKey: string;
  syncMode: string;
  secretVersionId: string;
  tenantKeyId: string;
  wrappedKey: string;
  wrappingKeyRef: string;
  tenantKeyAlgorithm: string;
  ciphertext: string;
  nonce: string;
  wrappedDataKey: string;
  secretAlgorithm: 'AES-256-GCM';
};

type CommonInput = {
  tenantId: string;
  runId: string;
  actorId: string;
  requestId: string;
  environment: 'development';
};

export type VaultSyncDependencies = {
  masterKeyBase64: string;
  signingKeyBase64: string;
  serviceIdentity: string;
  allowedWebhookHosts: string[];
  supabaseManagementToken: string;
  allowedSupabaseProjectRefs: string[];
  cloudflareApiToken: string;
  allowedCloudflareWorkerTargets: string[];
  maxAttempts: number;
  resolveActor(authorization: string, tenantId: string): Promise<{ id: string }>;
  claimSyncRun(input: CommonInput): Promise<ClaimedVaultSyncRun>;
  completeSyncRun(input: CommonInput & { resultCode: string }): Promise<void>;
  failSyncRun(input: CommonInput & { resultCode: string }): Promise<void>;
  fetch(request: Request): Promise<Response>;
  now(): number;
  nonce(): string;
  sleep(milliseconds: number): Promise<void>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      pragma: 'no-cache',
      'x-content-type-options': 'nosniff',
    },
  });
}

function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new VaultApiError(400, 'invalid_request');
  return value;
}

function requestId(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 200) {
    throw new VaultApiError(400, 'invalid_request');
  }
  return value;
}

function publicError(error: unknown): Response {
  if (error instanceof VaultApiError) {
    if (error.status === 401) return json(401, { ok: false, error: 'Authentication is required.' });
    if (error.status === 403) return json(403, { ok: false, error: 'You do not have access to this Vault synchronization.' });
    return json(error.status, { ok: false, error: 'The Vault synchronization request is invalid.' });
  }
  return json(500, { ok: false, error: 'Vault synchronization is temporarily unavailable.' });
}

function validateDestination(urlValue: string, allowedHosts: string[]): URL {
  let target: URL;
  try {
    target = new URL(urlValue);
  } catch {
    throw new VaultApiError(400, 'invalid_destination');
  }
  if (
    target.protocol !== 'https:' ||
    target.username !== '' ||
    target.password !== '' ||
    target.port !== '' ||
    !allowedHosts.includes(target.hostname.toLowerCase())
  ) {
    throw new VaultApiError(400, 'invalid_destination');
  }
  return target;
}

function validateSupabaseProjectRef(value: string, allowedProjectRefs: string[]): string {
  if (!/^[a-z]{20}$/.test(value) || !allowedProjectRefs.includes(value)) {
    throw new VaultApiError(400, 'invalid_destination');
  }
  return value;
}

function validateSupabaseSecretName(value: string): string {
  if (!/^[A-Z][A-Z0-9_]{1,127}$/.test(value)) {
    throw new VaultApiError(400, 'invalid_destination_key');
  }
  return value;
}

function validateCloudflareWorkerTarget(
  value: string,
  allowedWorkerTargets: string[],
): { accountId: string; workerName: string } {
  const match = value.match(/^([0-9a-f]{32})\/([a-z0-9][a-z0-9-]{0,62})$/);
  if (!match || !allowedWorkerTargets.includes(value)) {
    throw new VaultApiError(400, 'invalid_destination');
  }
  return { accountId: match[1], workerName: match[2] };
}

export function createVaultSyncHandler(dependencies: VaultSyncDependencies) {
  return async (request: Request): Promise<Response> => {
    let claimedInput: CommonInput | null = null;
    try {
      if (request.method !== 'POST') throw new VaultApiError(400, 'invalid_request');
      let body: Record<string, unknown>;
      try {
        const parsed = await request.json() as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('Invalid JSON object');
        }
        body = parsed as Record<string, unknown>;
      } catch {
        throw new VaultApiError(400, 'invalid_request');
      }
      if (body.environment !== 'development') throw new VaultApiError(400, 'development_only');
      const tenantId = uuid(body.tenantId);
      const runId = uuid(body.runId);
      const syncRequestId = requestId(body.requestId);
      const authorization = request.headers.get('authorization');
      if (!authorization?.startsWith('Bearer ')) throw new VaultApiError(401, 'unauthorized');
      const actor = await dependencies.resolveActor(authorization, tenantId);
      const common: CommonInput = {
        tenantId,
        runId,
        actorId: actor.id,
        requestId: syncRequestId,
        environment: 'development',
      };
      const claimed = await dependencies.claimSyncRun(common);
      claimedInput = common;

      const isSignedWebhook = claimed.adapterKey === 'signed_webhook' && claimed.adapterVersion === 'v1';
      const isSupabaseEdgeSecrets = claimed.adapterKey === 'supabase_edge_secrets' && claimed.adapterVersion === 'v1';
      const isCloudflareWorkerSecrets = claimed.adapterKey === 'cloudflare_worker_secrets' && claimed.adapterVersion === 'v1';
      if ((!isSignedWebhook && !isSupabaseEdgeSecrets && !isCloudflareWorkerSecrets) || claimed.syncMode !== 'runtime_secret_sync') {
        throw new VaultApiError(400, 'unsupported_adapter');
      }
      const webhookTarget = isSignedWebhook
        ? validateDestination(claimed.targetUrl, dependencies.allowedWebhookHosts)
        : null;
      const supabaseProjectRef = isSupabaseEdgeSecrets
        ? validateSupabaseProjectRef(claimed.targetUrl, dependencies.allowedSupabaseProjectRefs)
        : null;
      const supabaseSecretName = isSupabaseEdgeSecrets
        ? validateSupabaseSecretName(claimed.destinationKey)
        : null;
      const cloudflareTarget = isCloudflareWorkerSecrets
        ? validateCloudflareWorkerTarget(
          claimed.targetUrl,
          dependencies.allowedCloudflareWorkerTargets,
        )
        : null;
      const cloudflareSecretName = isCloudflareWorkerSecrets
        ? validateSupabaseSecretName(claimed.destinationKey)
        : null;
      if (isSupabaseEdgeSecrets && dependencies.supabaseManagementToken.trim() === '') {
        throw new Error('Supabase management integration is not configured');
      }
      if (isCloudflareWorkerSecrets && dependencies.cloudflareApiToken.trim() === '') {
        throw new Error('Cloudflare management integration is not configured');
      }
      if (claimed.tenantKeyAlgorithm !== 'AES-256-GCM' || claimed.secretAlgorithm !== 'AES-256-GCM') {
        throw new Error('Unsupported Vault envelope algorithm');
      }

      const masterKey = decodeMasterKey(dependencies.masterKeyBase64);
      const tenantKey = await unwrapTenantKey(masterKey, claimed.wrappedKey);
      const value = await decryptProtectedValue(tenantKey, {
        ciphertext: claimed.ciphertext,
        nonce: claimed.nonce,
        wrappedDataKey: claimed.wrappedDataKey,
        algorithm: claimed.secretAlgorithm,
      }, `tenant:${tenantId}/item:${claimed.itemId}/field:${claimed.fieldId}`);

      const attempts = Math.max(1, Math.min(5, dependencies.maxAttempts));
      if (isSupabaseEdgeSecrets && supabaseProjectRef && supabaseSecretName) {
        let finalStatus = 0;
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
          const managementRequest = new Request(
            `https://api.supabase.com/v1/projects/${supabaseProjectRef}/secrets`,
            {
              method: 'POST',
              redirect: 'manual',
              headers: {
                authorization: `Bearer ${dependencies.supabaseManagementToken}`,
                'content-type': 'application/json',
                'cache-control': 'no-store',
              },
              body: JSON.stringify([{ name: supabaseSecretName, value }]),
            },
          );
          try {
            const response = await dependencies.fetch(managementRequest);
            finalStatus = response.status;
            if (response.ok) {
              const resultCode = `supabase_edge_secrets_${response.status}`;
              await dependencies.completeSyncRun({ ...common, resultCode });
              return json(200, { ok: true, runId, resultCode });
            }
            if (response.status < 500 && response.status !== 429) break;
          } catch {
            finalStatus = 0;
          }
          if (attempt < attempts) await dependencies.sleep(100 * 2 ** (attempt - 1));
        }
        await dependencies.failSyncRun({
          ...common,
          resultCode: finalStatus > 0 ? `supabase_edge_secrets_${finalStatus}` : 'supabase_edge_secrets_network_error',
        });
        claimedInput = null;
        return json(502, { ok: false, error: 'The Vault synchronization destination did not accept the update.' });
      }

      if (isCloudflareWorkerSecrets && cloudflareTarget && cloudflareSecretName) {
        let finalStatus = 0;
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
          const managementRequest = new Request(
            `https://api.cloudflare.com/client/v4/accounts/${cloudflareTarget.accountId}/workers/scripts/${cloudflareTarget.workerName}/secrets`,
            {
              method: 'PUT',
              redirect: 'manual',
              headers: {
                authorization: `Bearer ${dependencies.cloudflareApiToken}`,
                'content-type': 'application/json',
                'cache-control': 'no-store',
              },
              body: JSON.stringify({ name: cloudflareSecretName, text: value, type: 'secret_text' }),
            },
          );
          try {
            const response = await dependencies.fetch(managementRequest);
            finalStatus = response.status;
            if (response.ok) {
              const resultCode = `cloudflare_worker_secrets_${response.status}`;
              await dependencies.completeSyncRun({ ...common, resultCode });
              return json(200, { ok: true, runId, resultCode });
            }
            if (response.status < 500 && response.status !== 429) break;
          } catch {
            finalStatus = 0;
          }
          if (attempt < attempts) await dependencies.sleep(100 * 2 ** (attempt - 1));
        }
        await dependencies.failSyncRun({
          ...common,
          resultCode: finalStatus > 0 ? `cloudflare_worker_secrets_${finalStatus}` : 'cloudflare_worker_secrets_network_error',
        });
        claimedInput = null;
        return json(502, { ok: false, error: 'The Vault synchronization destination did not accept the update.' });
      }

      if (!webhookTarget) throw new VaultApiError(400, 'invalid_destination');
      const signingKey = decodeMasterKey(dependencies.signingKeyBase64);
      let finalStatus = 0;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const webhookRequest = await createSignedWebhookRequest({
          url: webhookTarget.toString(),
          runId,
          destinationKey: claimed.destinationKey,
          value,
          timestamp: dependencies.now(),
          nonce: dependencies.nonce(),
        }, signingKey);
        try {
          const response = await dependencies.fetch(webhookRequest);
          finalStatus = response.status;
          if (response.ok) {
            const resultCode = `signed_webhook_${response.status}`;
            await dependencies.completeSyncRun({ ...common, resultCode });
            return json(200, { ok: true, runId, resultCode });
          }
          if (response.status < 500 && response.status !== 429) break;
        } catch {
          finalStatus = 0;
        }
        if (attempt < attempts) await dependencies.sleep(100 * 2 ** (attempt - 1));
      }

      await dependencies.failSyncRun({
        ...common,
        resultCode: finalStatus > 0 ? `signed_webhook_${finalStatus}` : 'signed_webhook_network_error',
      });
      claimedInput = null;
      return json(502, { ok: false, error: 'The Vault synchronization destination did not accept the update.' });
    } catch (error) {
      if (claimedInput) {
        try {
          await dependencies.failSyncRun({ ...claimedInput, resultCode: 'sync_dispatch_rejected' });
        } catch {
          // The public response remains sanitized; database state is reviewed through sync-run audit.
        }
      }
      return publicError(error);
    }
  };
}

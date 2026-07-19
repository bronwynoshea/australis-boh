import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeMasterKey, encryptProtectedValue, generateWrappedTenantKey, unwrapTenantKey } from './vaultCrypto.ts';
import { verifySignedWebhookRequest } from './vaultSignedWebhook.ts';
import { createVaultSyncHandler, type VaultSyncDependencies } from './vaultSyncApi.ts';

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  actor: '30000000-0000-4000-8000-000000000001',
  item: '40000000-0000-4000-8000-000000000001',
  field: '50000000-0000-4000-8000-000000000001',
  run: '70000000-0000-4000-8000-000000000001',
  version: '71000000-0000-4000-8000-000000000001',
  key: '60000000-0000-4000-8000-000000000001',
};

async function fixture(statuses = [200]) {
  const masterKey = new Uint8Array(32).fill(13);
  const signingKey = new Uint8Array(32).fill(29);
  const wrappedKey = await generateWrappedTenantKey(masterKey);
  const tenantKey = await unwrapTenantKey(masterKey, wrappedKey);
  const protectedEnvelope = await encryptProtectedValue(
    tenantKey,
    'runtime-secret',
    `tenant:${ids.tenant}/item:${ids.item}/field:${ids.field}`,
  );
  const calls: Record<string, unknown>[] = [];
  const requests: Request[] = [];
  let nonceCounter = 0;
  const dependencies: VaultSyncDependencies = {
    masterKeyBase64: Buffer.from(masterKey).toString('base64'),
    signingKeyBase64: Buffer.from(signingKey).toString('base64'),
    serviceIdentity: 'boh-vault-sync-test',
    allowedWebhookHosts: ['runner.example.test'],
    supabaseManagementToken: 'test-management-token',
    allowedSupabaseProjectRefs: ['jmjrgthqnrebzflythvj'],
    cloudflareApiToken: 'test-cloudflare-token',
    allowedCloudflareWorkerTargets: ['0123456789abcdef0123456789abcdef/jobzcafe-ai-gateway-dev'],
    maxAttempts: 3,
    resolveActor: async () => ({ id: ids.actor }),
    claimSyncRun: async (input) => {
      calls.push({ method: 'claimSyncRun', ...input });
      return {
        runId: ids.run,
        itemId: ids.item,
        fieldId: ids.field,
        adapterKey: 'signed_webhook',
        adapterVersion: 'v1',
        targetUrl: 'https://runner.example.test/vault-sync',
        destinationKey: 'OPENAI_API_KEY',
        syncMode: 'runtime_secret_sync',
        secretVersionId: ids.version,
        tenantKeyId: ids.key,
        wrappedKey,
        wrappingKeyRef: 'env:BOH_VAULT_MASTER_KEY_V1',
        tenantKeyAlgorithm: 'AES-256-GCM',
        ciphertext: protectedEnvelope.ciphertext,
        nonce: protectedEnvelope.nonce,
        wrappedDataKey: protectedEnvelope.wrappedDataKey,
        secretAlgorithm: protectedEnvelope.algorithm,
      };
    },
    completeSyncRun: async (input) => { calls.push({ method: 'completeSyncRun', ...input }); },
    failSyncRun: async (input) => { calls.push({ method: 'failSyncRun', ...input }); },
    fetch: async (request) => {
      requests.push(request.clone());
      const status = statuses[Math.min(requests.length - 1, statuses.length - 1)];
      return new Response(null, { status });
    },
    now: () => 1_789_400_000,
    nonce: () => `nonce-${String(++nonceCounter).padStart(12, '0')}`,
    sleep: async () => {},
  };
  return { handler: createVaultSyncHandler(dependencies), dependencies, calls, requests, signingKey };
}

function syncRequest() {
  return new Request('https://example.test/boh-vault-sync', {
    method: 'POST',
    headers: { authorization: 'Bearer valid-user-token', 'content-type': 'application/json' },
    body: JSON.stringify({
      tenantId: ids.tenant,
      runId: ids.run,
      environment: 'development',
      requestId: 'sync-dispatch-1',
    }),
  });
}

test('sync sends an authenticated payload and completes without returning the value', async () => {
  const { handler, calls, requests, signingKey } = await fixture([200]);
  const response = await handler(syncRequest());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, runId: ids.run, resultCode: 'signed_webhook_200' });
  assert.equal(JSON.stringify(body).includes('runtime-secret'), false);
  assert.equal(requests.length, 1);
  const verified = await verifySignedWebhookRequest(requests[0], signingKey, {
    now: 1_789_400_000,
    maxSkewSeconds: 300,
    nonces: { consume: async () => true },
  });
  assert.equal(verified.value, 'runtime-secret');
  assert.equal(calls.some((call) => call.method === 'completeSyncRun'), true);
  assert.equal(calls.some((call) => call.method === 'failSyncRun'), false);
});

test('Supabase adapter writes the protected value to an explicitly allowed development project', async () => {
  const { dependencies, calls, requests } = await fixture([201]);
  const originalClaim = dependencies.claimSyncRun;
  dependencies.claimSyncRun = async (input) => ({
    ...(await originalClaim(input)),
    adapterKey: 'supabase_edge_secrets',
    adapterVersion: 'v1',
    targetUrl: 'jmjrgthqnrebzflythvj',
    destinationKey: 'JOBZCAFE_AI_GATEWAY_TOKEN',
  });

  const response = await createVaultSyncHandler(dependencies)(syncRequest());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, runId: ids.run, resultCode: 'supabase_edge_secrets_201' });
  assert.equal(JSON.stringify(body).includes('runtime-secret'), false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.supabase.com/v1/projects/jmjrgthqnrebzflythvj/secrets');
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].redirect, 'manual');
  assert.equal(requests[0].headers.get('authorization'), 'Bearer test-management-token');
  assert.deepEqual(await requests[0].json(), [{ name: 'JOBZCAFE_AI_GATEWAY_TOKEN', value: 'runtime-secret' }]);
  assert.equal(calls.some((call) => call.method === 'completeSyncRun'), true);
});

test('Supabase adapter blocks unapproved projects before sending the protected value', async () => {
  const { dependencies, calls, requests } = await fixture([201]);
  const originalClaim = dependencies.claimSyncRun;
  dependencies.claimSyncRun = async (input) => ({
    ...(await originalClaim(input)),
    adapterKey: 'supabase_edge_secrets',
    adapterVersion: 'v1',
    targetUrl: 'dqmzrlpiunoxmlrgluju',
    destinationKey: 'JOBZCAFE_AI_GATEWAY_TOKEN',
  });

  const response = await createVaultSyncHandler(dependencies)(syncRequest());
  assert.equal(response.status, 400);
  assert.equal(requests.length, 0);
  assert.equal(calls.filter((call) => call.method === 'failSyncRun').length, 1);
});

test('Cloudflare adapter writes the protected value to an explicitly allowed Worker', async () => {
  const { dependencies, calls, requests } = await fixture([200]);
  const originalClaim = dependencies.claimSyncRun;
  dependencies.claimSyncRun = async (input) => ({
    ...(await originalClaim(input)),
    adapterKey: 'cloudflare_worker_secrets',
    adapterVersion: 'v1',
    targetUrl: '0123456789abcdef0123456789abcdef/jobzcafe-ai-gateway-dev',
    destinationKey: 'JOBZCAFE_AI_GATEWAY_TOKEN',
  });

  const response = await createVaultSyncHandler(dependencies)(syncRequest());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, runId: ids.run, resultCode: 'cloudflare_worker_secrets_200' });
  assert.equal(JSON.stringify(body).includes('runtime-secret'), false);
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/workers/scripts/jobzcafe-ai-gateway-dev/secrets',
  );
  assert.equal(requests[0].method, 'PUT');
  assert.equal(requests[0].redirect, 'manual');
  assert.equal(requests[0].headers.get('authorization'), 'Bearer test-cloudflare-token');
  assert.deepEqual(await requests[0].json(), {
    name: 'JOBZCAFE_AI_GATEWAY_TOKEN',
    text: 'runtime-secret',
    type: 'secret_text',
  });
  assert.equal(calls.some((call) => call.method === 'completeSyncRun'), true);
});

test('Cloudflare adapter blocks unapproved Workers before sending the protected value', async () => {
  const { dependencies, calls, requests } = await fixture([200]);
  const originalClaim = dependencies.claimSyncRun;
  dependencies.claimSyncRun = async (input) => ({
    ...(await originalClaim(input)),
    adapterKey: 'cloudflare_worker_secrets',
    adapterVersion: 'v1',
    targetUrl: '0123456789abcdef0123456789abcdef/unapproved-worker',
    destinationKey: 'JOBZCAFE_AI_GATEWAY_TOKEN',
  });

  const response = await createVaultSyncHandler(dependencies)(syncRequest());
  assert.equal(response.status, 400);
  assert.equal(requests.length, 0);
  assert.equal(calls.filter((call) => call.method === 'failSyncRun').length, 1);
});

test('sync rejects redirects without forwarding the protected payload', async () => {
  const { handler, requests, calls } = await fixture([307, 200]);
  const response = await handler(syncRequest());
  assert.equal(response.status, 502);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].redirect, 'manual');
  assert.equal(calls.filter((call) => call.method === 'failSyncRun').length, 1);
  assert.equal(calls.filter((call) => call.method === 'completeSyncRun').length, 0);
});

test('sync retries with fresh nonces and then succeeds', async () => {
  const { handler, requests, calls } = await fixture([503, 200]);
  const response = await handler(syncRequest());
  assert.equal(response.status, 200);
  assert.equal(requests.length, 2);
  assert.notEqual(
    requests[0].headers.get('x-boh-vault-nonce'),
    requests[1].headers.get('x-boh-vault-nonce'),
  );
  assert.equal(calls.filter((call) => call.method === 'completeSyncRun').length, 1);
});

test('sync caps retries and records failure', async () => {
  const { handler, requests, calls } = await fixture([503, 503, 503, 200]);
  const response = await handler(syncRequest());
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.equal(requests.length, 3);
  assert.deepEqual(body, { ok: false, error: 'The Vault synchronization destination did not accept the update.' });
  assert.equal(calls.filter((call) => call.method === 'failSyncRun').length, 1);
  assert.equal(JSON.stringify(calls).includes('runtime-secret'), false);
});

test('sync blocks destinations outside the explicit HTTPS host allowlist', async () => {
  const { handler, dependencies, requests, calls } = await fixture([200]);
  const originalClaim = dependencies.claimSyncRun;
  dependencies.claimSyncRun = async (input) => ({
    ...(await originalClaim(input)),
    targetUrl: 'https://attacker.example.test/collect',
  });
  const response = await createVaultSyncHandler(dependencies)(syncRequest());
  assert.equal(response.status, 400);
  assert.equal(requests.length, 0);
  assert.equal(calls.filter((call) => call.method === 'failSyncRun').length, 1);
});

test('sync rejects null JSON as an invalid request', async () => {
  const { handler, calls } = await fixture([200]);
  const response = await handler(new Request('https://example.test/boh-vault-sync', {
    method: 'POST',
    headers: { authorization: 'Bearer valid-user-token', 'content-type': 'application/json' },
    body: 'null',
  }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test('sync preserves production through claim and delivery', async () => {
  const { handler, calls } = await fixture([200]);
  const request = syncRequest();
  const body = await request.json();
  const response = await handler(new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ ...body, environment: 'production' }),
  }));
  assert.equal(response.status, 200);
  const claim = calls.find((call) => call.method === 'claimSyncRun');
  assert.equal(claim?.environment, 'production');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeMasterKey, generateWrappedTenantKey } from './vaultCrypto.ts';
import {
  createVaultSecretHandler,
  type VaultSecretDependencies,
  VaultApiError,
} from './vaultSecretApi.ts';

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  actor: '30000000-0000-4000-8000-000000000001',
  item: '40000000-0000-4000-8000-000000000001',
  field: '50000000-0000-4000-8000-000000000001',
  key: '60000000-0000-4000-8000-000000000001',
  version: '70000000-0000-4000-8000-000000000001',
};

async function fixture(noActiveKey = false) {
  const masterKeyBase64 = Buffer.alloc(32, 11).toString('base64');
  const wrappedKey = await generateWrappedTenantKey(decodeMasterKey(masterKeyBase64));
  const calls: Record<string, unknown>[] = [];
  const dependencies: VaultSecretDependencies = {
    masterKeyBase64,
    serviceIdentity: 'boh-vault-secret-test',
    resolveActor: async (authorization, tenantId) => {
      calls.push({ method: 'resolveActor', authorization, tenantId });
      return { id: ids.actor };
    },
    getActiveTenantKey: async (input) => {
      calls.push({ method: 'getActiveTenantKey', ...input });
      if (noActiveKey) return null;
      return {
        tenantKeyId: ids.key,
        wrappedKey,
        wrappingKeyRef: 'env:BOH_VAULT_MASTER_KEY_V1',
        algorithm: 'AES-256-GCM',
      };
    },
    initializeTenantKey: async (input) => {
      calls.push({ method: 'initializeTenantKey', ...input });
      return {
        tenantKeyId: ids.key,
        wrappedKey: input.wrappedKey,
        wrappingKeyRef: input.wrappingKeyRef,
        algorithm: 'AES-256-GCM',
      };
    },
    commitSecretVersion: async (input) => {
      calls.push({ method: 'commitSecretVersion', ...input });
      return ids.version;
    },
    readSecretEnvelope: async (input) => {
      calls.push({ method: 'readSecretEnvelope', ...input });
      const commit = calls.find((call) => call.method === 'commitSecretVersion');
      if (!commit) throw new Error('test must set a secret before reveal');
      return {
        secretVersionId: ids.version,
        tenantKeyId: ids.key,
        wrappedKey,
        wrappingKeyRef: 'env:BOH_VAULT_MASTER_KEY_V1',
        tenantKeyAlgorithm: 'AES-256-GCM',
        ciphertext: String(commit.ciphertext),
        nonce: String(commit.nonce),
        wrappedDataKey: String(commit.wrappedDataKey),
        secretAlgorithm: 'AES-256-GCM',
      };
    },
  };
  return { handler: createVaultSecretHandler(dependencies), dependencies, calls };
}

function request(action: 'set' | 'reveal' | 'copy', extras: Record<string, unknown> = {}) {
  return new Request('https://example.test/boh-vault-secret', {
    method: 'POST',
    headers: { authorization: 'Bearer valid-user-token', 'content-type': 'application/json' },
    body: JSON.stringify({
      action,
      tenantId: ids.tenant,
      itemId: ids.item,
      fieldId: ids.field,
      environment: 'development',
      requestId: `request-${action}`,
      ...extras,
    }),
  });
}

test('set encrypts before persistence and returns no protected value', async () => {
  const { handler, calls } = await fixture();
  const response = await handler(request('set', { value: 'server-only-secret' }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(body, { ok: true, secretVersionId: ids.version });
  const commit = calls.find((call) => call.method === 'commitSecretVersion');
  assert(commit);
  assert.notEqual(commit.ciphertext, 'server-only-secret');
  assert.equal(JSON.stringify(commit).includes('server-only-secret'), false);
  assert.equal(commit.tenantId, ids.tenant);
  assert.equal(commit.itemId, ids.item);
  assert.equal(commit.fieldId, ids.field);
});

test('first set bootstraps a wrapped tenant key without persisting the master key', async () => {
  const { handler, calls } = await fixture(true);
  const response = await handler(request('set', { value: 'first-secret' }));
  assert.equal(response.status, 200);
  const initialization = calls.find((call) => call.method === 'initializeTenantKey');
  assert(initialization);
  assert.match(String(initialization.wrappedKey), /^v1\./);
  assert.equal(JSON.stringify(initialization).includes(Buffer.alloc(32, 11).toString('base64')), false);
});

test('reveal reads the audited envelope before decrypting and never caches', async () => {
  const { handler, calls } = await fixture();
  await handler(request('set', { value: 'server-only-secret' }));
  const response = await handler(request('reveal'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(body, { ok: true, value: 'server-only-secret', secretVersionId: ids.version });
  const read = calls.find((call) => call.method === 'readSecretEnvelope');
  assert.equal(read?.auditEvent, 'revealed');
});

test('copy uses a distinct audit event', async () => {
  const { handler, calls } = await fixture();
  await handler(request('set', { value: 'server-only-secret' }));
  const response = await handler(request('copy'));
  assert.equal(response.status, 200);
  const read = calls.find((call) => call.method === 'readSecretEnvelope');
  assert.equal(read?.auditEvent, 'copied');
});

test('production requests are rejected before authentication or persistence', async () => {
  const { handler, calls } = await fixture();
  const response = await handler(request('set', { value: 'secret', environment: 'production' }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test('null JSON is rejected as an invalid request', async () => {
  const { handler } = await fixture();
  const response = await handler(new Request('https://example.test/boh-vault-secret', {
    method: 'POST',
    headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
    body: 'null',
  }));
  assert.equal(response.status, 400);
});

test('missing authorization is rejected without exposing internals', async () => {
  const { handler, calls } = await fixture();
  const response = await handler(new Request('https://example.test/boh-vault-secret', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'reveal', tenantId: ids.tenant, itemId: ids.item, fieldId: ids.field, environment: 'development', requestId: 'missing-auth' }),
  }));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: 'Authentication is required.' });
  assert.equal(calls.length, 0);
});

test('dependency failures map to safe public messages', async () => {
  const { dependencies } = await fixture();
  dependencies.resolveActor = async () => {
    throw new VaultApiError(403, 'forbidden', 'internal role details');
  };
  const handler = createVaultSecretHandler(dependencies);
  const response = await handler(request('reveal'));
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.deepEqual(body, { ok: false, error: 'You do not have access to this Vault action.' });
  assert.equal(JSON.stringify(body).includes('internal role details'), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSignedWebhookRequest,
  verifySignedWebhookRequest,
  type NonceStore,
} from './vaultSignedWebhook.ts';

const signingKey = new Uint8Array(32).fill(23);
const timestamp = 1_789_400_000;

function nonceStore(): NonceStore {
  const values = new Set<string>();
  return {
    consume: async (nonce) => {
      if (values.has(nonce)) return false;
      values.add(nonce);
      return true;
    },
  };
}

test('signed webhook authenticates the exact destination and protected payload', async () => {
  const request = await createSignedWebhookRequest({
    url: 'https://runner.example.test/vault-sync',
    runId: '70000000-0000-4000-8000-000000000001',
    destinationKey: 'OPENAI_API_KEY',
    value: 'protected-value',
    timestamp,
    nonce: 'nonce-1234567890',
  }, signingKey);
  const verified = await verifySignedWebhookRequest(request, signingKey, {
    now: timestamp,
    maxSkewSeconds: 300,
    nonces: nonceStore(),
  });

  assert.deepEqual(verified, {
    runId: '70000000-0000-4000-8000-000000000001',
    destinationKey: 'OPENAI_API_KEY',
    value: 'protected-value',
  });
  assert.equal(request.redirect, 'manual');
  assert.equal(request.headers.get('x-boh-vault-signature')?.startsWith('v1='), true);
});

test('signed webhook rejects payload tampering', async () => {
  const request = await createSignedWebhookRequest({
    url: 'https://runner.example.test/vault-sync',
    runId: '70000000-0000-4000-8000-000000000001',
    destinationKey: 'OPENAI_API_KEY',
    value: 'protected-value',
    timestamp,
    nonce: 'nonce-1234567890',
  }, signingKey);
  const body = await request.json();
  const tampered = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ ...body, value: 'tampered' }),
  });

  await assert.rejects(
    verifySignedWebhookRequest(tampered, signingKey, { now: timestamp, maxSkewSeconds: 300, nonces: nonceStore() }),
    /signature/i,
  );
});

test('signed webhook rejects expired timestamps', async () => {
  const request = await createSignedWebhookRequest({
    url: 'https://runner.example.test/vault-sync',
    runId: '70000000-0000-4000-8000-000000000001',
    destinationKey: 'OPENAI_API_KEY',
    value: 'protected-value',
    timestamp,
    nonce: 'nonce-1234567890',
  }, signingKey);

  await assert.rejects(
    verifySignedWebhookRequest(request, signingKey, { now: timestamp + 301, maxSkewSeconds: 300, nonces: nonceStore() }),
    /expired/i,
  );
});

test('signed webhook atomically rejects concurrent nonce replay', async () => {
  const request = await createSignedWebhookRequest({
    url: 'https://runner.example.test/vault-sync',
    runId: '70000000-0000-4000-8000-000000000001',
    destinationKey: 'OPENAI_API_KEY',
    value: 'protected-value',
    timestamp,
    nonce: 'nonce-1234567890',
  }, signingKey);
  const nonces = nonceStore();
  const results = await Promise.allSettled([
    verifySignedWebhookRequest(request.clone(), signingKey, { now: timestamp, maxSkewSeconds: 300, nonces }),
    verifySignedWebhookRequest(request.clone(), signingKey, { now: timestamp, maxSkewSeconds: 300, nonces }),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
});

test('signed webhook rejects nonce replay', async () => {
  const request = await createSignedWebhookRequest({
    url: 'https://runner.example.test/vault-sync',
    runId: '70000000-0000-4000-8000-000000000001',
    destinationKey: 'OPENAI_API_KEY',
    value: 'protected-value',
    timestamp,
    nonce: 'nonce-1234567890',
  }, signingKey);
  const nonces = nonceStore();
  await verifySignedWebhookRequest(request.clone(), signingKey, { now: timestamp, maxSkewSeconds: 300, nonces });

  await assert.rejects(
    verifySignedWebhookRequest(request, signingKey, { now: timestamp, maxSkewSeconds: 300, nonces }),
    /replay/i,
  );
});

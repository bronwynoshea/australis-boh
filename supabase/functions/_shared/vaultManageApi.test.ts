import assert from 'node:assert/strict';
import test from 'node:test';
import { createVaultManageHandler, type VaultManageDependencies } from './vaultManageApi.ts';

const ids = {
  tenant: '10000000-0000-4000-8000-000000000001',
  actor: '30000000-0000-4000-8000-000000000001',
  item: '40000000-0000-4000-8000-000000000001',
  field: '50000000-0000-4000-8000-000000000001',
  user: '31000000-0000-4000-8000-000000000001',
  grant: '32000000-0000-4000-8000-000000000001',
  adapter: '70000000-0000-4000-8000-000000000001',
  target: '71000000-0000-4000-8000-000000000001',
  binding: '72000000-0000-4000-8000-000000000001',
  version: '73000000-0000-4000-8000-000000000001',
};

function fixture() {
  const calls: Array<Record<string, unknown>> = [];
  const record = (method: string, result?: string) => async (input: Record<string, unknown>) => {
    calls.push({ method, ...input });
    return result;
  };
  const dependencies: VaultManageDependencies = {
    resolveActor: async () => ({ id: ids.actor }),
    upsertItem: record('upsertItem', ids.item),
    updateItemDetails: record('updateItemDetails', ids.item),
    upsertField: record('upsertField', ids.field),
    deleteItem: async (input) => { calls.push({ method: 'deleteItem', ...input }); },
    mutateGrant: record('mutateGrant', ids.grant),
    createTarget: record('createTarget', ids.target),
    createBinding: record('createBinding', ids.binding),
    updateBinding: async (input) => { calls.push({ method: 'updateBinding', ...input }); },
    requestSync: record('requestSync', '74000000-0000-4000-8000-000000000001'),
  };
  return { handler: createVaultManageHandler(dependencies), calls };
}

function request(action: string, input: Record<string, unknown>) {
  return new Request('https://example.test/boh-vault-manage', {
    method: 'POST',
    headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
    body: JSON.stringify({ action, tenantId: ids.tenant, environment: 'development', requestId: `request-${action}`, ...input }),
  });
}

test('item metadata is tenant-scoped and returns only its ID', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request('upsert_item', {
    itemId: ids.item,
    itemKey: 'openai-platform',
    displayName: 'OpenAI platform',
    itemType: 'service_api_key',
    providerKey: 'openai',
    purpose: 'Product AI access',
    description: 'Shared development access',
    notes: 'Rotate quarterly',
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, id: ids.item });
  assert.equal(calls[0].tenantId, ids.tenant);
  assert.equal(calls[0].actorId, ids.actor);
});

test('protected field values are forbidden from the metadata endpoint', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request('upsert_field', {
    fieldId: ids.field,
    itemId: ids.item,
    fieldKey: 'api_key',
    label: 'API key',
    fieldKind: 'protected',
    plaintextValue: 'must-not-pass',
    isRequired: true,
    sortOrder: 1,
  }));
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test('item details edit sends metadata and a protected-field reference without a value', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request('update_item_details', {
    itemId: ids.item,
    displayName: 'Cloudflare management token',
    providerKey: 'Cloudflare',
    protectedFieldId: ids.field,
    referenceName: 'BOH_VAULT_CLOUDFLARE_API_TOKEN',
  }));
  assert.equal(response.status, 200);
  assert.equal(calls[0].method, 'updateItemDetails');
  assert.equal(calls[0].referenceName, 'BOH_VAULT_CLOUDFLARE_API_TOKEN');
  assert.equal('protectedValue' in calls[0], false);
});

test('item deletion preserves the exact tenant and item identifiers', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request('delete_item', { itemId: ids.item }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls[0].method, 'deleteItem');
  assert.equal(calls[0].tenantId, ids.tenant);
  assert.equal(calls[0].itemId, ids.item);
  assert.equal(calls[0].actorId, ids.actor);
});

test('grant and synchronization actions preserve exact identifiers', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request('mutate_grant', {
    grantId: ids.grant,
    bohUserId: ids.user,
    role: 'vault_viewer',
    status: 'active',
  }))).status, 200);
  assert.equal((await handler(request('request_sync', {
    bindingId: ids.binding,
    secretVersionId: ids.version,
    runRequestId: 'run-request-1',
  }))).status, 200);
  assert.equal(calls[0].grantId, ids.grant);
  assert.equal(calls[0].bohUserId, ids.user);
  assert.equal(calls[1].bindingId, ids.binding);
  assert.equal('secretVersionId' in calls[1], false);
});

test('production and null JSON are rejected before authentication', async () => {
  const { handler, calls } = fixture();
  const production = request('upsert_item', { itemId: ids.item });
  const body = await production.json();
  const productionResponse = await handler(new Request(production.url, {
    method: 'POST', headers: production.headers, body: JSON.stringify({ ...body, environment: 'production' }),
  }));
  const nullResponse = await handler(new Request(production.url, {
    method: 'POST', headers: production.headers, body: 'null',
  }));
  assert.equal(productionResponse.status, 400);
  assert.equal(nullResponse.status, 400);
  assert.equal(calls.length, 0);
});

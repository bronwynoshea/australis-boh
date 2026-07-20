import test from 'node:test';
import assert from 'node:assert/strict';
import { filterActiveVaultBindings, filterVaultItemsForSynchronization, filterVaultRecordsByEnvironment, filterVaultRunsByBinding, getVaultConnectionDisplay } from '../src/apps/vault/vaultSyncSelection.ts';

test('personal passwords are never synchronization candidates', () => {
  const items = [
    { id: 'password', item_type: 'login' },
    { id: 'api-key', item_type: 'api_key' },
  ];
  assert.deepEqual(filterVaultItemsForSynchronization(items).map((item) => item.id), ['api-key']);
});

test('synchronization records are isolated by environment', () => {
  const records = [
    { id: 'dev', environment: 'development' },
    { id: 'prod', environment: 'production' },
  ];
  assert.deepEqual(filterVaultRecordsByEnvironment(records, 'development').map((record) => record.id), ['dev']);
  assert.deepEqual(filterVaultRecordsByEnvironment(records, 'production').map((record) => record.id), ['prod']);
});

test('connection display distinguishes the same Vault item by destination', () => {
  const supabase = getVaultConnectionDisplay('JOBZCAFE AI Gateway Token', 'JOBZCAFE development Supabase', 'JOBZCAFE_AI_GATEWAY_TOKEN');
  const cloudflare = getVaultConnectionDisplay('JOBZCAFE AI Gateway Token', 'JOBZCAFE AI Gateway development Worker', 'JOBZCAFE_AI_GATEWAY_TOKEN');
  assert.equal(supabase.title, cloudflare.title);
  assert.notEqual(supabase.destination, cloudflare.destination);
  assert.equal(cloudflare.secretName, 'JOBZCAFE_AI_GATEWAY_TOKEN');
});

test('recent synchronization runs only belong to the selected connection', () => {
  const runs = [
    { id: 'run-1', binding_id: 'binding-a' },
    { id: 'run-2', binding_id: 'binding-b' },
    { id: 'run-3', binding_id: 'binding-a' },
  ];
  assert.deepEqual(filterVaultRunsByBinding(runs, 'binding-a').map((run) => run.id), ['run-1', 'run-3']);
});

test('no connection selection displays no recent runs', () => {
  assert.deepEqual(filterVaultRunsByBinding([{ id: 'run-1', binding_id: 'binding-a' }], null), []);
});

test('removed connections are hidden from the active connection list', () => {
  const bindings = [
    { id: 'active', state: 'ready' },
    { id: 'removed', state: 'disabled' },
  ];

  assert.deepEqual(filterActiveVaultBindings(bindings), [{ id: 'active', state: 'ready' }]);
});

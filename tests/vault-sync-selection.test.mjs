import test from 'node:test';
import assert from 'node:assert/strict';
import { filterActiveVaultBindings, filterVaultRunsByBinding } from '../src/apps/vault/vaultSyncSelection.ts';

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

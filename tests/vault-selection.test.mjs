import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveVaultSelection } from '../src/apps/vault/vaultSelection.ts';

const items = [{ id: 'first' }, { id: 'second' }];

test('Vault keeps the selected item in the first-screen detail panel', () => {
  assert.equal(resolveVaultSelection(items, 'second'), 'second');
});

test('Vault selects the first item when the prior selection is unavailable', () => {
  assert.equal(resolveVaultSelection(items, 'missing'), 'first');
  assert.equal(resolveVaultSelection([], 'missing'), null);
});

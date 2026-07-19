import test from 'node:test';
import assert from 'node:assert/strict';
import { getVaultSyncDisplayStatus } from '../src/apps/vault/vaultSyncStatus.ts';

test('a ready connection that has never completed displays Not synced', () => {
  assert.equal(getVaultSyncDisplayStatus({ state: 'ready', last_synced_at: null }), 'not_synced');
});

test('a ready connection with a successful timestamp displays Synced', () => {
  assert.equal(getVaultSyncDisplayStatus({ state: 'ready', last_synced_at: '2026-07-17T00:00:00Z' }), 'synced');
});

test('an errored connection displays Needs attention', () => {
  assert.equal(getVaultSyncDisplayStatus({ state: 'error', last_synced_at: null }), 'needs_attention');
});

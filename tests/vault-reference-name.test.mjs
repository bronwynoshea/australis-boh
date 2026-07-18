import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeVaultReferenceName } from '../src/apps/vault/referenceName.ts';

test('Vault reference names use uppercase runtime-secret syntax', () => {
  assert.equal(
    normalizeVaultReferenceName('Jobzcafe ai-gateway token'),
    'JOBZCAFE_AI_GATEWAY_TOKEN',
  );
});

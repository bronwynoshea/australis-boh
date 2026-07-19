import assert from 'node:assert/strict';
import test from 'node:test';
import { getProtectedVaultValueInputProps } from '../src/apps/vault/protectedValueInput.ts';

test('protected Vault values are masked without invoking browser password managers', () => {
  const protectedVaultValueInputProps = getProtectedVaultValueInputProps(false);
  assert.equal(protectedVaultValueInputProps.type, 'text');
  assert.equal(protectedVaultValueInputProps.autoComplete, 'off');
  assert.equal(protectedVaultValueInputProps['data-1p-ignore'], true);
  assert.equal(protectedVaultValueInputProps['data-lpignore'], 'true');
  assert.equal(protectedVaultValueInputProps.style.WebkitTextSecurity, 'disc');
});

test('protected Vault values can be shown for pre-save verification', () => {
  const revealed = getProtectedVaultValueInputProps(true);
  assert.equal(revealed.style.WebkitTextSecurity, 'none');
});

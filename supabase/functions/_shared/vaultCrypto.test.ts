import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeMasterKey,
  decryptProtectedValue,
  encryptProtectedValue,
  generateWrappedTenantKey,
  unwrapTenantKey,
} from './vaultCrypto.ts';

const masterKeyBase64 = Buffer.alloc(32, 7).toString('base64');
const fieldContext = 'tenant:100/item:200/field:300';

test('decodeMasterKey accepts exactly one 256-bit base64 key', () => {
  assert.equal(decodeMasterKey(masterKeyBase64).byteLength, 32);
  assert.throws(() => decodeMasterKey(Buffer.alloc(31).toString('base64')), /32 bytes/i);
  assert.throws(() => decodeMasterKey('not-base64'), /base64/i);
});

test('tenant keys round-trip only through the configured master key', async () => {
  const masterKey = decodeMasterKey(masterKeyBase64);
  const wrapped = await generateWrappedTenantKey(masterKey);
  const unwrapped = await unwrapTenantKey(masterKey, wrapped);

  assert.equal(unwrapped.byteLength, 32);
  await assert.rejects(
    unwrapTenantKey(decodeMasterKey(Buffer.alloc(32, 8).toString('base64')), wrapped),
  );
});

test('protected values use fresh envelope material and decrypt exactly', async () => {
  const masterKey = decodeMasterKey(masterKeyBase64);
  const wrappedTenantKey = await generateWrappedTenantKey(masterKey);
  const tenantKey = await unwrapTenantKey(masterKey, wrappedTenantKey);

  const first = await encryptProtectedValue(tenantKey, 'super-secret-value', fieldContext);
  const second = await encryptProtectedValue(tenantKey, 'super-secret-value', fieldContext);

  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.notEqual(first.nonce, second.nonce);
  assert.notEqual(first.wrappedDataKey, second.wrappedDataKey);
  assert.equal(await decryptProtectedValue(tenantKey, first, fieldContext), 'super-secret-value');
  await assert.rejects(decryptProtectedValue(tenantKey, first, 'tenant:other/item:200/field:300'));
});

test('tampered protected values cannot be decrypted', async () => {
  const masterKey = decodeMasterKey(masterKeyBase64);
  const tenantKey = await unwrapTenantKey(masterKey, await generateWrappedTenantKey(masterKey));
  const encrypted = await encryptProtectedValue(tenantKey, 'super-secret-value', fieldContext);
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  ciphertext[0] ^= 1;

  await assert.rejects(
    decryptProtectedValue(tenantKey, {
      ...encrypted,
      ciphertext: ciphertext.toString('base64'),
    }, fieldContext),
  );
});

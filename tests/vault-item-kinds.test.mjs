import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVaultCreateFields,
  createVaultItemFormDefaults,
  filterVaultItemsByCategory,
  filterVaultItemsByEnvironment,
  VAULT_PROVIDER_PLACEHOLDER,
} from '../src/apps/vault/vaultItemKinds.ts';

test('new Vault items keep blank reference and provider values without branded defaults', () => {
  const form = createVaultItemFormDefaults();
  const productionForm = createVaultItemFormDefaults('production');
  assert.equal(form.environment, 'development');
  assert.equal(productionForm.environment, 'production');
  assert.equal(form.referenceName, '');
  assert.equal(form.providerKey, '');
  assert.equal(form.projectWorkspace, '');
  assert.equal(form.projectId, '');
  assert.equal(form.switchboardProjectId, '');
  assert.equal(form.serviceUrl, '');
  assert.equal(form.purpose, '');
  assert.equal(form.description, '');
  assert.equal(VAULT_PROVIDER_PLACEHOLDER, 'Provider name');
});

test('password items keep website and username plaintext but protect the password', () => {
  assert.deepEqual(
    buildVaultCreateFields({
      kind: 'password',
      websiteUrl: 'https://example.test/login',
      username: 'person@example.test',
      referenceName: '',
    }),
    [
      { fieldKey: 'website_url', label: 'Website', fieldKind: 'plaintext', plaintextValue: 'https://example.test/login', isRequired: false, sortOrder: 0 },
      { fieldKey: 'username', label: 'Username', fieldKind: 'plaintext', plaintextValue: 'person@example.test', isRequired: false, sortOrder: 1 },
      { fieldKey: 'PASSWORD', label: 'Password', fieldKind: 'protected', plaintextValue: null, isRequired: true, sortOrder: 2 },
    ],
  );
});

test('API secrets use the runtime reference name without a website field', () => {
  assert.deepEqual(
    buildVaultCreateFields({
      kind: 'api_secret',
      websiteUrl: 'https://gateway.example.test',
      username: '',
      referenceName: 'JOBZCAFE_AI_GATEWAY_TOKEN',
    }),
    [
      { fieldKey: 'JOBZCAFE_AI_GATEWAY_TOKEN', label: 'Protected value', fieldKind: 'protected', plaintextValue: null, isRequired: true, sortOrder: 0 },
    ],
  );
});

test('Vault categories separate passwords from application secrets', () => {
  const items = [
    { id: 'password', item_type: 'login' },
    { id: 'secret', item_type: 'credential' },
  ];
  assert.deepEqual(filterVaultItemsByCategory(items, 'passwords').map((item) => item.id), ['password']);
  assert.deepEqual(filterVaultItemsByCategory(items, 'api_secrets').map((item) => item.id), ['secret']);
  assert.equal(filterVaultItemsByCategory(items, 'all').length, 2);
});

test('API secrets can be separated by development and production environment', () => {
  const items = [
    { id: 'dev', environment: 'development' },
    { id: 'prod', environment: 'production' },
  ];
  assert.deepEqual(filterVaultItemsByEnvironment(items, 'development').map((item) => item.id), ['dev']);
  assert.deepEqual(filterVaultItemsByEnvironment(items, 'production').map((item) => item.id), ['prod']);
});

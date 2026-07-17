export type VaultItemKind = 'password' | 'api_secret';
export type VaultCategory = 'all' | 'passwords' | 'api_secrets';
export type VaultEnvironment = 'development' | 'production';

export function createVaultItemFormDefaults() {
  return {
    displayName: '',
    kind: 'api_secret' as VaultItemKind,
    environment: 'development' as VaultEnvironment,
    websiteUrl: '',
    username: '',
    providerKey: '',
    description: '',
    referenceName: '',
    protectedValue: '',
  };
}

export interface VaultCreateField {
  fieldKey: string;
  label: string;
  fieldKind: 'plaintext' | 'protected';
  plaintextValue: string | null;
  isRequired: boolean;
  sortOrder: number;
}

export function buildVaultCreateFields(input: {
  kind: VaultItemKind;
  websiteUrl: string;
  username: string;
  referenceName: string;
}): VaultCreateField[] {
  const fields: VaultCreateField[] = [];
  const websiteUrl = input.websiteUrl.trim();
  const username = input.username.trim();

  if (input.kind === 'password' && websiteUrl) {
    fields.push({
      fieldKey: 'website_url',
      label: 'Website',
      fieldKind: 'plaintext',
      plaintextValue: websiteUrl,
      isRequired: false,
      sortOrder: fields.length,
    });
  }

  if (input.kind === 'password' && username) {
    fields.push({
      fieldKey: 'username',
      label: 'Username',
      fieldKind: 'plaintext',
      plaintextValue: username,
      isRequired: false,
      sortOrder: fields.length,
    });
  }

  fields.push({
    fieldKey: input.kind === 'password' ? 'PASSWORD' : input.referenceName,
    label: input.kind === 'password' ? 'Password' : 'Protected value',
    fieldKind: 'protected',
    plaintextValue: null,
    isRequired: true,
    sortOrder: fields.length,
  });

  return fields;
}

export function filterVaultItemsByCategory<T extends { item_type: string }>(
  items: readonly T[],
  category: VaultCategory,
): T[] {
  if (category === 'passwords') return items.filter((item) => item.item_type === 'login');
  if (category === 'api_secrets') return items.filter((item) => item.item_type !== 'login');
  return [...items];
}

export function filterVaultItemsByEnvironment<T extends { environment: string }>(
  items: readonly T[],
  environment: VaultEnvironment,
): T[] {
  return items.filter((item) => item.environment === environment);
}

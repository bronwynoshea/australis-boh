export function normalizeVaultReferenceName(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

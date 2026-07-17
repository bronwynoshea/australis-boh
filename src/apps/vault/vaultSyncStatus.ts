export type VaultSyncStatusInput = {
  state: string;
  last_synced_at: string | null;
};

export function getVaultSyncDisplayStatus(binding: VaultSyncStatusInput): string {
  if (binding.state === 'error') return 'needs_attention';
  if (binding.state === 'paused' || binding.state === 'disabled') return binding.state;
  if (binding.last_synced_at) return 'synced';
  return 'not_synced';
}

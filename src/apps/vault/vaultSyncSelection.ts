export type VaultRunForSelection = {
  binding_id: string;
};

export type VaultBindingForSelection = {
  state: string;
};

export function filterActiveVaultBindings<T extends VaultBindingForSelection>(bindings: readonly T[]): T[] {
  return bindings.filter((binding) => binding.state !== 'disabled');
}

export function getVaultConnectionDisplay(itemName: string, targetName: string, destinationKey: string) {
  return {
    title: itemName || 'Vault item',
    destination: targetName || 'Destination',
    secretName: destinationKey,
  };
}

export function filterVaultRunsByBinding<T extends VaultRunForSelection>(runs: T[], bindingId: string | null): T[] {
  if (!bindingId) return [];
  return runs.filter((run) => run.binding_id === bindingId);
}

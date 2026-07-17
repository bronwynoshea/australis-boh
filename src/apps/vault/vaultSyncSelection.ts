export type VaultRunForSelection = {
  binding_id: string;
};

export type VaultBindingForSelection = {
  state: string;
};

export function filterActiveVaultBindings<T extends VaultBindingForSelection>(bindings: T[]): T[] {
  return bindings.filter((binding) => binding.state !== 'disabled');
}

export function filterVaultRunsByBinding<T extends VaultRunForSelection>(runs: T[], bindingId: string | null): T[] {
  if (!bindingId) return [];
  return runs.filter((run) => run.binding_id === bindingId);
}

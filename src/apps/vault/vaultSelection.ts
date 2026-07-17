export function resolveVaultSelection(
  items: ReadonlyArray<{ id: string }>,
  currentSelection: string | null,
): string | null {
  if (currentSelection && items.some((item) => item.id === currentSelection)) {
    return currentSelection;
  }
  return items[0]?.id ?? null;
}

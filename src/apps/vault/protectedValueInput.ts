export function getProtectedVaultValueInputProps(revealed: boolean) {
  return {
    type: 'text',
    autoComplete: 'off',
    'data-1p-ignore': true,
    'data-lpignore': 'true',
    spellCheck: false,
    style: { WebkitTextSecurity: revealed ? 'none' : 'disc' },
  } as const;
}

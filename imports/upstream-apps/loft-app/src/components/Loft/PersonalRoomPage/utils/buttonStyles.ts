// Shared button styles for PersonalRoom components
export const getIconButtonClass = (isActive: boolean, activeColor: 'green' | 'cafe' = 'green', inactiveColor: 'red' | 'gray' = 'red') => {
  const baseClass = 'p-3 !rounded-lg transition-all border flex items-center justify-center';
  
  if (activeColor === 'green' && inactiveColor === 'red') {
    return `${baseClass} ${
      isActive 
        ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20' 
        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20'
    }`;
  }
  
  if (activeColor === 'green' && inactiveColor === 'gray') {
    return `${baseClass} ${
      isActive 
        ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 hover:bg-green-500/20' 
        : 'bg-[var(--loft-surface-2)] text-[var(--loft-text)] border-[var(--loft-border)] hover:bg-[var(--loft-surface-strong)]'
    }`;
  }
  
  if (activeColor === 'cafe') {
    return `${baseClass} ${
      isActive 
        ? 'bg-cafe/15 text-cafe border border-cafe/30 hover:bg-cafe/25' 
        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20'
    }`;
  }
  
  return baseClass;
};

export const getDefaultIconButtonClass = () => {
  return 'p-3 !rounded-lg bg-[var(--loft-surface-2)] text-[var(--loft-text)] border border-[var(--loft-border)] hover:bg-[var(--loft-surface-strong)] transition-all';
};

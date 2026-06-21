import type { ThemeMode } from './hooks/useCurrentTheme';

type ModuleName = 'Counter' | 'Tablez' | 'Patron';

interface ModuleStyling {
  style: Record<string, any>;
  theme: ThemeMode;
}

/**
 * Get module-specific styling based on theme.
 * Currently returns theme-aware configuration that can be extended
 * for module-specific styling needs.
 */
export function getModuleStyling(module: ModuleName, theme: ThemeMode): ModuleStyling {
  return {
    style: {
      // Module-specific styles can be added here if needed
      // For now, Tailwind's dark: classes handle theming automatically
    },
    theme,
  };
}




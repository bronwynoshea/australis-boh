import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

export function getDocumentTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useCurrentTheme(): ThemeMode {
  const [theme, setTheme] = useState<ThemeMode>(() => getDocumentTheme());

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(getDocumentTheme());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}




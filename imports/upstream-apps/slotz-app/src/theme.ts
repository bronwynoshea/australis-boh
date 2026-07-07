export type SlotzTheme = 'light' | 'dark';

export const getDocumentTheme = (): SlotzTheme => {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

export const syncSlotzThemeTokens = (theme: SlotzTheme = getDocumentTheme()) => {
  if (typeof document === 'undefined') return theme;
  document.documentElement.dataset.theme = theme;
  return theme;
};

export const setTheme = (theme: SlotzTheme) => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('slotz-theme', theme);
    localStorage.setItem('bohTheme', theme);
  }
};

export const applySavedTheme = () => {
  const savedTheme = typeof localStorage !== 'undefined' && localStorage.getItem('bohTheme') === 'dark' ? 'dark' : getDocumentTheme();
  setTheme(savedTheme);
};

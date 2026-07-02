export type SlotzTheme = 'light' | 'dark';

export const setTheme = (theme: SlotzTheme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('slotz-theme', theme);
};

export const applySavedTheme = () => {
  const savedTheme = localStorage.getItem('slotz-theme') === 'light' ? 'light' : 'dark';
  setTheme(savedTheme);
};

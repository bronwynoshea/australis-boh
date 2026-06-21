const BOH_LOGIN_KEY = 'bohIsLoggedIn';
const BOH_EMAIL_KEY = 'bohUserEmail';
const BOH_THEME_KEY = 'bohTheme';
const APP_CONTEXT_KEY = 'app_context';

export function setBohLogin(email: string, theme?: string) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(BOH_LOGIN_KEY, 'true');
  window.localStorage.setItem(BOH_EMAIL_KEY, email);
  if (theme) {
    window.localStorage.setItem(BOH_THEME_KEY, theme);
  }
  window.localStorage.setItem(APP_CONTEXT_KEY, 'boh');
}

export function clearBohLogin() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(BOH_LOGIN_KEY);
  window.localStorage.removeItem(BOH_EMAIL_KEY);
  window.localStorage.removeItem(BOH_THEME_KEY);

  // Only clear app_context if it is currently 'boh'
  const existing = window.localStorage.getItem(APP_CONTEXT_KEY);
  if (existing === 'boh') {
    window.localStorage.removeItem(APP_CONTEXT_KEY);
  }
}

export function isBohLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;

  const flag = window.localStorage.getItem(BOH_LOGIN_KEY);
  return flag === 'true';
}

export function getBohUserEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(BOH_EMAIL_KEY);
}

export function setBohTheme(theme: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BOH_THEME_KEY, theme);
}

export function getBohTheme(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(BOH_THEME_KEY);
}


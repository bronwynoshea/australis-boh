import Cookies from 'js-cookie';

type CookieStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const shouldUseJobzCafeDomain = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.endsWith('jobzcafe.com');
};

const shouldUseLocalStorage = () => {
  if (typeof window === 'undefined') return false;
  return !shouldUseJobzCafeDomain();
};

const cookieOptions = () => {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const opts: Cookies.CookieAttributes = {
    path: '/',
    sameSite: 'Lax',
    secure,
    expires: 7,
  };

  if (shouldUseJobzCafeDomain()) {
    opts.domain = '.jobzcafe.com';
  }

  return opts;
};

export const authCookieStorage: CookieStorage = {
  getItem: (key) => {
    if (shouldUseLocalStorage()) {
      const localValue = window.localStorage.getItem(key);
      if (localValue) return localValue;
      const cookieValue = Cookies.get(key);
      if (cookieValue) {
        window.localStorage.setItem(key, cookieValue);
      }
      return cookieValue ?? null;
    }
    const v = Cookies.get(key);
    return v ?? null;
  },
  setItem: (key, value) => {
    if (shouldUseLocalStorage()) {
      window.localStorage.setItem(key, value);
      return;
    }
    Cookies.set(key, value, cookieOptions());
  },
  removeItem: (key) => {
    if (shouldUseLocalStorage()) {
      window.localStorage.removeItem(key);
      return;
    }
    Cookies.remove(key, cookieOptions());
  },
};

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
    const v = Cookies.get(key);
    return v ?? null;
  },
  setItem: (key, value) => {
    Cookies.set(key, value, cookieOptions());
  },
  removeItem: (key) => {
    Cookies.remove(key, cookieOptions());
  },
};
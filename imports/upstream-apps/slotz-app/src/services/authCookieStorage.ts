type CookieStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

type CookieAttributes = {
  path?: string;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
  expires?: number;
  domain?: string;
};

const shouldUseJobzCafeDomain = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.endsWith('jobzcafe.com');
};

const cookieOptions = (): CookieAttributes => {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const opts: CookieAttributes = {
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

const encode = (value: string) => encodeURIComponent(value).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent);

const serializeCookie = (key: string, value: string, options: CookieAttributes) => {
  const segments = [`${encode(key)}=${encode(value)}`];
  if (options.expires) {
    const expiresAt = new Date(Date.now() + options.expires * 24 * 60 * 60 * 1000);
    segments.push(`Expires=${expiresAt.toUTCString()}`);
  }
  if (options.path) segments.push(`Path=${options.path}`);
  if (options.domain) segments.push(`Domain=${options.domain}`);
  if (options.sameSite) segments.push(`SameSite=${options.sameSite}`);
  if (options.secure) segments.push('Secure');
  return segments.join('; ');
};

export const authCookieStorage: CookieStorage = {
  getItem: (key) => {
    if (typeof document === 'undefined') return null;
    const encodedKey = `${encode(key)}=`;
    const cookie = document.cookie
      .split('; ')
      .find((part) => part.startsWith(encodedKey));
    return cookie ? decodeURIComponent(cookie.slice(encodedKey.length)) : null;
  },
  setItem: (key, value) => {
    if (typeof document === 'undefined') return;
    document.cookie = serializeCookie(key, value, cookieOptions());
  },
  removeItem: (key) => {
    if (typeof document === 'undefined') return;
    document.cookie = serializeCookie(key, '', { ...cookieOptions(), expires: -1 });
  },
};

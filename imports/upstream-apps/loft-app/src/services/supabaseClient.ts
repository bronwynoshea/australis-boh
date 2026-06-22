import { createClient } from '@supabase/supabase-js';
import { authCookieStorage } from './authCookieStorage';

export const AUTH_STORAGE_KEY = 'jobzcafe.supabase.auth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Loft Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: authCookieStorage,
      storageKey: AUTH_STORAGE_KEY,
    },
  }
);

if (typeof window !== 'undefined') {
  (window as any).__loftSupabase = supabase;
}

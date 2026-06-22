import { createClient } from '@supabase/supabase-js';
import { authCookieStorage } from './authCookieStorage';

const SUPABASE_URL = import.meta.env.VITE_SLOTZ_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SLOTZ_SUPABASE_PUBLISHABLE_KEY;

const getSupabaseProjectId = (supabaseUrl?: string): string => {
  try {
    return new URL(supabaseUrl || '').hostname.split('.')[0] || 'unknown';
  } catch {
    return 'unknown';
  }
};

const SUPABASE_PROJECT_ID =
  import.meta.env.VITE_SLOTZ_SUPABASE_PROJECT_ID || getSupabaseProjectId(SUPABASE_URL);

export const AUTH_STORAGE_KEY = `jobzcafe.slotz.${SUPABASE_PROJECT_ID}.auth`;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_SLOTZ_SUPABASE_URL or VITE_SLOTZ_SUPABASE_PUBLISHABLE_KEY. Please check your environment.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authCookieStorage,
    storageKey: AUTH_STORAGE_KEY,
  },
});

// Debug helper (development only)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).__slotzSupabase = supabase;
}

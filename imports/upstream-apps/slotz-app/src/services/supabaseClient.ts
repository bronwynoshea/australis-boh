import { createClient } from '@supabase/supabase-js';
import { supabase as bohSupabase } from '../../../../../src/lib/supabase';
import { authCookieStorage } from './authCookieStorage';

const SUPABASE_URL = import.meta.env.VITE_SLOTZ_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SLOTZ_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const USE_BOH_AUTH_STORAGE = !import.meta.env.VITE_SLOTZ_SUPABASE_URL && Boolean(import.meta.env.VITE_SUPABASE_URL);

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
  throw new Error('Missing SLOTZ/BOH Supabase environment variables. Please check VITE_SLOTZ_SUPABASE_* or VITE_SUPABASE_* configuration.');
}

export const supabase = USE_BOH_AUTH_STORAGE
  ? bohSupabase
  : createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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

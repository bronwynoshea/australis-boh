import { supabase as bohSupabase } from '../../../../../src/lib/supabase';

export const cellarSupabaseUrl =
  import.meta.env.VITE_CELLAR_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL;
export const cellarSupabasePublishableKey =
  import.meta.env.VITE_CELLAR_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!cellarSupabaseUrl || !cellarSupabasePublishableKey) {
  console.warn('[Cellar] Supabase URL and publishable key are required.');
}

export const supabase = bohSupabase;

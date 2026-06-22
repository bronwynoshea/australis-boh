import { createClient } from '@supabase/supabase-js';

export const cellarSupabaseUrl =
  import.meta.env.VITE_CELLAR_SUPABASE_URL;
export const cellarSupabasePublishableKey =
  import.meta.env.VITE_CELLAR_SUPABASE_PUBLISHABLE_KEY;

if (!cellarSupabaseUrl || !cellarSupabasePublishableKey) {
  console.warn('[Cellar] VITE_CELLAR_SUPABASE_URL and VITE_CELLAR_SUPABASE_PUBLISHABLE_KEY are required.');
}

export const supabase = createClient(
  cellarSupabaseUrl || 'https://placeholder.supabase.co',
  cellarSupabasePublishableKey || 'placeholder-key',
);

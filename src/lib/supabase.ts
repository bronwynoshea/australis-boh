import { createClient } from '@supabase/supabase-js';

// Supabase client configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// Runtime validation
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is required. Please check your environment variables.');
}

if (!supabasePublishableKey) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is required. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);


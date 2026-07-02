import { supabase } from '../../../../../src/lib/supabase';

export const AUTH_STORAGE_KEY = 'jobzcafe.supabase.auth';

// BOH-native Loft must reuse the already-authenticated BOH Supabase client.
// The standalone Loft repo used its own cookie-backed client; inside BOH that
// creates a second auth store and causes the imported app to think the user is
// signed out even when the BOH shell has a valid session.
export { supabase };

if (typeof window !== 'undefined') {
  (window as any).__loftSupabase = supabase;
}

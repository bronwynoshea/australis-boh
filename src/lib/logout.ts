import type { NavigateFunction } from 'react-router-dom';
import { supabase } from './supabase';
import { clearBohLogin } from './bohAuth';

/**
 * Performs a complete logout for BOH:
 * - Signs out from Supabase auth
 * - Clears ONLY BOH-related localStorage keys (not Cafe keys)
 * - Redirects to /boh/login
 */
export async function performBohLogout(_navigate: NavigateFunction): Promise<void> {
  // Clear BOH-specific client state first
  clearBohLogin();

  // Best-effort Supabase sign-out (ignore errors so logout still proceeds)
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Error signing out of Supabase:', err);
  }

  // Force a full reload so App re-reads isBohLoggedIn and routes to /boh/login
  window.location.href = '/boh/login';
}

/**
 * Legacy function name for backwards compatibility
 * @deprecated Use performBohLogout instead
 */
export async function performLogout(): Promise<void> {
  clearBohLogin();
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Error signing out of Supabase:', err);
  }
  window.location.href = '/boh/login';
}


import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { User } from '@supabase/supabase-js';

interface StaffProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  slug: string;
  avatar_url?: string;
  timezone: string;
  app_context: string;
}

interface AuthState {
  user: User | null;
  profile: StaffProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export function useAuth(): AuthState {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user || null;

        if (user) {
          // Fetch staff profile
          const { data: profileData, error } = await supabase
            .from('scheduling_staff_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (error) {
            console.error('Profile fetch error:', error);
          }

          setAuthState({
            user,
            profile: profileData,
            loading: false,
            isAuthenticated: true,
          });
        } else {
          setAuthState({
            user: null,
            profile: null,
            loading: false,
            isAuthenticated: false,
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthState({
          user: null,
          profile: null,
          loading: false,
          isAuthenticated: false,
        });
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
                const user = session?.user || null;

        if (user) {
          const { data: profileData } = await supabase
            .from('scheduling_staff_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          setAuthState({
            user,
            profile: profileData,
            loading: false,
            isAuthenticated: true,
          });
        } else {
          setAuthState({
            user: null,
            profile: null,
            loading: false,
            isAuthenticated: false,
          });
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return authState;
}
import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';

interface UserProfile {
  id: string;
  display_name?: string;
  avatar_url?: string;
  personal_room_id?: string;
  email?: string;
}

interface AuthState {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const getAuthState = async () => {
      try {
        // Get current user session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[useAuth] Session error:', sessionError);
          throw sessionError;
        }
        
        if (!isMounted) return;

        const user = sessionData?.session?.user || null;
        
        if (user) {
          // Create basic profile from user data first
          const basicProfile: UserProfile = {
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url,
          };

          // Try to get additional profile data from profiles table (if it exists)
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();

            if (profileError) {
              // Use basic profile if table doesn't exist or user not found
              if (isMounted) {
                setAuthState({
                  user,
                  profile: basicProfile,
                  loading: false,
                });
              }
            } else if (profileData) {
              // Merge with basic profile
              const mergedProfile: UserProfile = {
                ...basicProfile,
                ...profileData,
              };
              
              if (isMounted) {
                setAuthState({
                  user,
                  profile: mergedProfile,
                  loading: false,
                });
              }
            } else {
              if (isMounted) {
                setAuthState({
                  user,
                  profile: basicProfile,
                  loading: false,
                });
              }
            }
          } catch (profileError) {
            if (isMounted) {
              setAuthState({
                user,
                profile: basicProfile,
                loading: false,
              });
            }
          }
        } else {
          if (isMounted) {
            setAuthState({
              user: null,
              profile: null,
              loading: false,
            });
          }
        }
      } catch (error) {
        console.error('[useAuth] Auth state error:', error);
        if (isMounted) {
          setAuthState({
            user: null,
            profile: null,
            loading: false,
          });
        }
      }
    };

    getAuthState();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        const user = session?.user || null;
        
        if (user) {
          const basicProfile: UserProfile = {
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url,
          };

          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();

            if (profileError) {
              setAuthState({
                user,
                profile: basicProfile,
                loading: false,
              });
            } else if (profileData) {
              const mergedProfile: UserProfile = {
                ...basicProfile,
                ...profileData,
              };
              
              setAuthState({
                user,
                profile: mergedProfile,
                loading: false,
              });
            } else {
              setAuthState({
                user,
                profile: basicProfile,
                loading: false,
              });
            }
          } catch (profileError) {
            setAuthState({
              user,
              profile: basicProfile,
              loading: false,
            });
          }
        } else {
          setAuthState({
            user: null,
            profile: null,
            loading: false,
          });
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return authState;
}

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

export interface BohUserApp {
  app_id: string;
  permission_level: 'view' | 'edit' | 'admin';
}

export interface AppWithAccess {
  id: string;
  slug: string;
  name: string;
  description: string;
  route: string;
  external_url: string;
  type: 'internal_tool' | 'external_app';
  is_active: boolean;
  boh_user_app: Array<{ permission_level: 'view' | 'edit' | 'admin' }>;
}

export interface BohAccess {
  bohUser: { id: string; auth_user_id: string } | null;
  userApps: BohUserApp[];
  appsWithAccess: AppWithAccess[];
  internalApps: AppWithAccess[];
  externalApps: AppWithAccess[];
  isSuperAdmin: boolean;
  isLoading: boolean;
  error: string | null;
}

const readRoleCode = (role: unknown): string | null => {
  if (!role) return null;

  if (Array.isArray(role)) {
    return readRoleCode(role[0]);
  }

  if (typeof role === 'object' && 'code' in role) {
    const code = (role as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }

  return null;
};

const describeAccessError = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const candidate = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [candidate.message, candidate.details, candidate.hint, candidate.code]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ');
  }
  return 'Unable to load BOH access.';
};

/**
 * Hook to load current user's BOH access.
 * 
 * - Checks boh_user table for current auth user
 * - Checks boh_user_role for super_admin role
 * - If super_admin: returns all active apps
 * - Otherwise: returns apps from boh_user_app
 */
export function useBohAccess(): BohAccess {
  const [bohUser, setBohUser] = useState<{ id: string; auth_user_id: string } | null>(null);
  const [userApps, setUserApps] = useState<BohUserApp[]>([]);
  const [appsWithAccess, setAppsWithAccess] = useState<AppWithAccess[]>([]);
  const [internalApps, setInternalApps] = useState<AppWithAccess[]>([]);
  const [externalApps, setExternalApps] = useState<AppWithAccess[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bootstrapInFlightRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function loadAccess() {
      // Prevent multiple loads
      if (bootstrapInFlightRef.current) {
        return;
      }
      bootstrapInFlightRef.current = true;

      try {
        setIsLoading(true);
        setError(null);

        // Load all active apps with admin access
        const { data: allApps, error: allAppsError } = await supabase
          .from('boh_app')
          .select('id, name, slug, description, route, external_url, type, location, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (allAppsError || !allApps) {
          if (mounted) {
            setBohUser(null);
            setUserApps([]);
            setAppsWithAccess([]);
            setInternalApps([]);
            setExternalApps([]);
            setIsSuperAdmin(false);
            setIsLoading(false);
          }
          bootstrapInFlightRef.current = false;
          return;
        }

        // Give all apps admin access for now
        const userAppsData = allApps.map((app) => ({
          app_id: app.id,
          permission_level: 'admin' as const,
        }));
        
        if (mounted) {
          setBohUser({ id: 'temp', auth_user_id: 'temp' }); // Temp user
          setUserApps(userAppsData);
          setIsSuperAdmin(true); // Everyone is super admin for now
          
          // Show all apps with admin access
          const appsWithAccess = allApps.map((app) => ({
            ...app,
            boh_user_app: [{ permission_level: 'admin' as const }],
          }));
          setAppsWithAccess(appsWithAccess);
          setInternalApps(appsWithAccess.filter(app => app.type === 'internal_tool'));
          setExternalApps(appsWithAccess.filter(app => app.type === 'external_app'));
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setBohUser(null);
          setUserApps([]);
          setAppsWithAccess([]);
          setInternalApps([]);
          setExternalApps([]);
          setIsSuperAdmin(false);
          setIsLoading(false);
          setError(describeAccessError(err));
        }
      } finally {
        bootstrapInFlightRef.current = false;
      }
    }

    async function loadAccessWithSession(session: any) {
      if (!session) {
        if (mounted) {
          setBohUser(null);
          setUserApps([]);
          setAppsWithAccess([]);
          setInternalApps([]);
          setExternalApps([]);
          setIsSuperAdmin(false);
          setIsLoading(false);
        }
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // BOH access must be linked through auth_user_id. No email fallback:
        // mismatched auth links should be fixed in BOH user data, not hidden here.
        const { data: bohUserData, error: bohUserError } = await supabase
          .from('boh_user')
          .select('id, auth_user_id')
          .eq('auth_user_id', session.user.id)
          .eq('app_context', 'boh')
          .maybeSingle();

        if (bohUserError) {
          throw bohUserError;
        }

        if (!bohUserData) {
          if (mounted) {
            setBohUser(null);
            setUserApps([]);
            setAppsWithAccess([]);
            setInternalApps([]);
            setExternalApps([]);
            setIsSuperAdmin(false);
            setIsLoading(false);
            setError('No BOH user matched the current session.');
          }
          return;
        }

        setBohUser(bohUserData);

        // Check for super_admin role
        const { data: rolesData, error: rolesError } = await supabase
          .from('boh_user_role')
          .select('role:boh_role!boh_user_roles_role_id_fkey(code)')
          .eq('user_id', bohUserData.id)
          .eq('app_context', 'boh');

        if (rolesError) {
          console.warn('[useBohAccess] Super admin role lookup failed; continuing with direct app grants.', rolesError);
        }

        const isSuperAdminCheck = !rolesError && (rolesData?.some(
          (r: any) => readRoleCode(r.role) === 'super_admin'
        ) ?? false);

        setIsSuperAdmin(isSuperAdminCheck);

        // Load all apps with correct access
        const { data: allApps, error: allAppsError } = await supabase
          .from('boh_app')
          .select('id, name, slug, description, route, external_url, type, location, is_active')
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (allAppsError || !allApps) {
          if (mounted) {
            setUserApps([]);
            setAppsWithAccess([]);
            setInternalApps([]);
            setExternalApps([]);
            setIsLoading(false);
            setError(allAppsError?.message ?? 'Unable to load BOH apps.');
          }
          return;
        }

        if (isSuperAdminCheck) {
          // Super admin gets access to all apps
          const userAppsData = allApps.map((app) => ({
            app_id: app.id,
            permission_level: 'admin' as const,
          }));
          
          if (mounted) {
            setUserApps(userAppsData);
            
            const appsWithAccess = allApps.map((app) => ({
              ...app,
              boh_user_app: [{ permission_level: 'admin' as const }],
            }));
            setAppsWithAccess(appsWithAccess);
            setInternalApps(appsWithAccess.filter(app => app.type === 'internal_tool'));
            setExternalApps(appsWithAccess.filter(app => app.type === 'external_app'));
          }
        } else {
          // Regular user - get their assigned apps
          const { data: userAppsData, error: userAppsError } = await supabase
            .from('boh_user_app')
            .select('app_id, permission_level')
            .eq('user_id', bohUserData.id)
            .eq('app_context', 'boh');

          if (userAppsError) {
            throw userAppsError;
          }

          if (mounted) {
            setUserApps(userAppsData || []);

            const assignedApps = userAppsData || [];
            const appsWithAccess = allApps.map(app => {
              const userApp = assignedApps.find(ua => ua.app_id === app.id);
              return {
                ...app,
                boh_user_app: userApp ? [{ permission_level: userApp.permission_level }] : []
              };
            });
            
            setAppsWithAccess(appsWithAccess);
            setInternalApps(appsWithAccess.filter(app => app.type === 'internal_tool'));
            setExternalApps(appsWithAccess.filter(app => app.type === 'external_app'));
          }
        }
        
        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setBohUser(null);
          setUserApps([]);
          setAppsWithAccess([]);
          setInternalApps([]);
          setExternalApps([]);
          setIsSuperAdmin(false);
          setIsLoading(false);
          setError(describeAccessError(err));
        }
      }
    }

    // Get initial session and load access properly
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadAccessWithSession(session);
      } else {
        // No session - clear everything
        if (mounted) {
          setBohUser(null);
          setUserApps([]);
          setAppsWithAccess([]);
          setInternalApps([]);
          setExternalApps([]);
          setIsSuperAdmin(false);
          setIsLoading(false);
        }
        bootstrapInFlightRef.current = false;
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Reset and reload on auth changes
      bootstrapInFlightRef.current = false;
      if (session) {
        loadAccessWithSession(session);
      } else {
        // No session - clear everything
        if (mounted) {
          setBohUser(null);
          setUserApps([]);
          setAppsWithAccess([]);
          setInternalApps([]);
          setExternalApps([]);
          setIsSuperAdmin(false);
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    bohUser,
    userApps,
    appsWithAccess,
    internalApps,
    externalApps,
    isSuperAdmin,
    isLoading,
    error,
  };
}


// Shared authentication and authorization helpers for BOH Edge Functions
// Provides standardized auth patterns for protected user and admin functions
// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// Types
// ============================================================================

export interface AuthContext {
  authUser: {
    id: string;
    email?: string;
    [key: string]: any;
  };
  bohUser: {
    id: string;
    auth_user_id: string;
    primary_role_hint?: string;
    [key: string]: any;
  } | null;
  isSuperAdmin: boolean;
}

export interface AuthResult {
  success: true;
  context: AuthContext;
  supabaseUrl: string;
  secretKey: string;
  serviceClient: ReturnType<typeof createClient>;
}

export interface AuthFailure {
  success: false;
  error: string;
  status: 401 | 403 | 500;
}

export type AuthResultType = AuthResult | AuthFailure;

// ============================================================================
// Environment
// ============================================================================

function getEnvVars(): { supabaseUrl: string; publishableKey: string; secretKey: string } | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SB_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const secretKey =
    Deno.env.get("SB_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey || !secretKey) {
    console.error("[auth] Missing required environment variables: SUPABASE_URL, publishable/anon key, or service role key");
    return null;
  }

  return { supabaseUrl, publishableKey, secretKey };
}

// ============================================================================
// Core Authentication
// ============================================================================

/**
 * Validates JWT token and returns authenticated user
 * This is the foundation for both protected-user and admin-internal patterns
 */
export async function validateJwt(
  req: Request,
  supabaseUrl: string,
  publishableKey: string
): Promise<{ user: any; error: null } | { user: null; error: string }> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return { user: null, error: "Missing Authorization header" };
  }

  // Create client with user's auth token
  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  // Verify JWT
  const { data: authData, error: authError } = await userClient.auth.getUser();

  if (authError || !authData?.user) {
    console.error("[auth] JWT validation failed:", authError?.message || "No user found");
    return { user: null, error: "Invalid or expired token" };
  }

  return { user: authData.user, error: null };
}

/**
 * Resolves BOH user from auth user ID
 */
export async function resolveBohUser(
  serviceClient: ReturnType<typeof createClient>,
  authUserId: string
): Promise<{ bohUser: any; error: null } | { bohUser: null; error: string }> {
  const { data: bohUserData, error: bohUserError } = await serviceClient
    .from("boh_user")
    .select("id, auth_user_id, primary_role_hint, app_context")
    .eq("auth_user_id", authUserId)
    .eq("app_context", "boh")
    .maybeSingle();

  if (bohUserError) {
    console.error("[auth] Error resolving BOH user:", bohUserError.message);
    return { bohUser: null, error: "Failed to resolve user identity" };
  }

  return { bohUser: bohUserData, error: null };
}

/**
 * Checks if a BOH user has super_admin role
 */
export async function checkSuperAdmin(
  serviceClient: ReturnType<typeof createClient>,
  bohUserId: string,
  primaryRoleHint?: string
): Promise<boolean> {
  // Quick check via primary_role_hint
  if (primaryRoleHint === "super_admin") {
    return true;
  }

  // Full role table check
  const { data: roleData } = await serviceClient
    .from("boh_user_role")
    .select("role:boh_role(code)")
    .eq("user_id", bohUserId)
    .eq("app_context", "boh");

  return roleData?.some((r: any) => r.role?.code === "super_admin") ?? false;
}

// ============================================================================
// Pattern A: Protected User
// ============================================================================

/**
 * requireUser - Standard auth for protected user functions
 * 
 * Pattern A: Validates JWT, resolves BOH user, returns full context
 * Use for: Functions requiring authenticated users with boh_user resolution
 * 
 * @example
 * const auth = await requireUser(req);
 * if (!auth.success) return jsonResponse(req, { error: auth.error }, auth.status);
 * const { context, serviceClient } = auth;
 */
export async function requireUser(req: Request): Promise<AuthResultType> {
  const env = getEnvVars();
  if (!env) {
    return { success: false, error: "Server misconfiguration", status: 500 };
  }

  const { supabaseUrl, publishableKey, secretKey } = env;

  // Step 1: Validate JWT
  const jwtResult = await validateJwt(req, supabaseUrl, publishableKey);
  if (jwtResult.error) {
    return { success: false, error: `Unauthorized - ${jwtResult.error}`, status: 401 };
  }

  // Step 2: Create service client
  const serviceClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  // Step 3: Resolve BOH user
  const bohResult = await resolveBohUser(serviceClient, jwtResult.user.id);
  if (bohResult.error) {
    return { success: false, error: bohResult.error, status: 401 };
  }

  // Step 4: Check super_admin status (optional info for protected functions)
  const isSuperAdmin = bohResult.bohUser
    ? await checkSuperAdmin(serviceClient, bohResult.bohUser.id, bohResult.bohUser.primary_role_hint)
    : false;

  return {
    success: true,
    context: {
      authUser: jwtResult.user,
      bohUser: bohResult.bohUser,
      isSuperAdmin,
    },
    supabaseUrl,
    secretKey,
    serviceClient,
  };
}

/**
 * requireUserOnly - Lightweight auth that only validates JWT
 * 
 * Use for: Functions that only need the auth user (no boh_user resolution needed)
 * Note: Most BOH functions should use requireUser() for full identity
 * 
 * @example
 * const auth = await requireUserOnly(req);
 * if (!auth.success) return jsonResponse(req, { error: auth.error }, auth.status);
 * const { authUser, serviceClient } = auth;
 */
export async function requireUserOnly(req: Request): Promise<
  | { success: true; authUser: any; supabaseUrl: string; secretKey: string; serviceClient: ReturnType<typeof createClient> }
  | AuthFailure
> {
  const env = getEnvVars();
  if (!env) {
    return { success: false, error: "Server misconfiguration", status: 500 };
  }

  const { supabaseUrl, publishableKey, secretKey } = env;

  const jwtResult = await validateJwt(req, supabaseUrl, publishableKey);
  if (jwtResult.error) {
    return { success: false, error: `Unauthorized - ${jwtResult.error}`, status: 401 };
  }

  const serviceClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  return {
    success: true,
    authUser: jwtResult.user,
    supabaseUrl,
    secretKey,
    serviceClient,
  };
}

// ============================================================================
// Pattern B: Admin/Internal
// ============================================================================

/**
 * requireAdmin - Standard auth for admin functions
 * 
 * Pattern B: Validates JWT, resolves BOH user, enforces super_admin role
 * Use for: Functions requiring super_admin privileges
 * 
 * @example
 * const auth = await requireAdmin(req);
 * if (!auth.success) return jsonResponse(req, { error: auth.error }, auth.status);
 * const { context, serviceClient } = auth;
 */
export async function requireAdmin(req: Request): Promise<AuthResultType> {
  const env = getEnvVars();
  if (!env) {
    return { success: false, error: "Server misconfiguration", status: 500 };
  }

  const { supabaseUrl, publishableKey, secretKey } = env;

  // Step 1: Validate JWT
  const jwtResult = await validateJwt(req, supabaseUrl, publishableKey);
  if (jwtResult.error) {
    return { success: false, error: `Unauthorized - ${jwtResult.error}`, status: 401 };
  }

  // Step 2: Create service client
  const serviceClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  // Step 3: Resolve BOH user
  const bohResult = await resolveBohUser(serviceClient, jwtResult.user.id);
  if (bohResult.error) {
    return { success: false, error: bohResult.error, status: 401 };
  }

  if (!bohResult.bohUser) {
    return { success: false, error: "User not found in BOH system", status: 401 };
  }

  // Step 4: Enforce super_admin role
  const isSuperAdmin = await checkSuperAdmin(
    serviceClient,
    bohResult.bohUser.id,
    bohResult.bohUser.primary_role_hint
  );

  if (!isSuperAdmin) {
    return { success: false, error: "Forbidden - Admin access required", status: 403 };
  }

  return {
    success: true,
    context: {
      authUser: jwtResult.user,
      bohUser: bohResult.bohUser,
      isSuperAdmin: true,
    },
    supabaseUrl,
    secretKey,
    serviceClient,
  };
}

// ============================================================================
// Pattern C: Public/Webhook (API Key Auth)
// ============================================================================

/**
 * requireApiKey - Standard auth for public webhook functions
 * 
 * Pattern C: Validates API key from header or query param
 * Use for: External webhooks, public endpoints with API key protection
 * 
 * @example
 * const auth = await requireApiKey(req, "MY_API_KEY");
 * if (!auth.success) return jsonResponse(req, { error: auth.error }, auth.status);
 * const { serviceClient } = auth;
 */
export async function requireApiKey(
  req: Request,
  envKeyName: string,
  options: { headerName?: string; queryParamName?: string } = {}
): Promise<
  | { success: true; supabaseUrl: string; secretKey: string; serviceClient: ReturnType<typeof createClient> }
  | AuthFailure
> {
  const env = getEnvVars();
  if (!env) {
    return { success: false, error: "Server misconfiguration", status: 500 };
  }

  const expectedKey = Deno.env.get(envKeyName);
  if (!expectedKey) {
    console.error(`[auth] Missing API key environment variable: ${envKeyName}`);
    return { success: false, error: "Server misconfiguration", status: 500 };
  }

  // Check header
  const headerKey = req.headers.get(options.headerName || "X-API-Key");
  if (headerKey && headerKey === expectedKey) {
    return createServiceClientResult(env);
  }

  // Check query param
  if (options.queryParamName) {
    const url = new URL(req.url);
    const queryKey = url.searchParams.get(options.queryParamName);
    if (queryKey && queryKey === expectedKey) {
      return createServiceClientResult(env);
    }
  }

  return { success: false, error: "Unauthorized - Invalid or missing API key", status: 401 };
}

function createServiceClientResult(env: { supabaseUrl: string; publishableKey: string; secretKey: string }) {
  const serviceClient = createClient(env.supabaseUrl, env.secretKey, {
    auth: { persistSession: false },
  });

  return {
    success: true as const,
    supabaseUrl: env.supabaseUrl,
    secretKey: env.secretKey,
    serviceClient,
  };
}

// ============================================================================
// Legacy Helpers (for backward compatibility during migration)
// ============================================================================

/**
 * @deprecated Use requireUser() instead
 * Legacy helper for functions still using the old getAuthUser pattern
 */
export async function getAuthUser(req: Request): Promise<{ user: any; serviceClient: any } | null> {
  const result = await requireUser(req);
  if (!result.success) return null;
  return {
    user: result.context.bohUser || result.context.authUser,
    serviceClient: result.serviceClient,
  };
}

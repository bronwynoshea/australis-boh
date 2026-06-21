// @ts-nocheck
// New Keep authentication helper using validateAuth pattern
// This replaces the old getAuthContext pattern

import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateAuth, resolveBohUser } from "./auth.ts";

export interface KeepAuthContext {
  authUser: any;
  bohUser: any;
  isSuperAdmin: boolean;
  serviceClient: ReturnType<typeof createClient>;
}

/**
 * Validates authentication and returns Keep auth context
 * Uses new pattern: validateAuth with publishable key + auth.getUser()
 */
export async function getKeepAuthContext(req: Request): Promise<KeepAuthContext | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SB_PUBLISHABLE_KEY");
  const secretKey = Deno.env.get("SB_SECRET_KEY");

  if (!supabaseUrl || !publishableKey || !secretKey) {
    console.error("[keep-auth] Missing Supabase environment variables");
    return null;
  }

  // Validate auth with publishable key
  const { user: authUser, error: authError } = await validateAuth(req, supabaseUrl, publishableKey);
  
  if (authError || !authUser) {
    console.warn("[keep-auth] Auth validation failed:", authError);
    return null;
  }

  // Create service client for database operations
  const serviceClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  // Resolve BOH user
  const { bohUser, error: bohUserError } = await resolveBohUser(serviceClient, authUser.id);
  
  if (bohUserError || !bohUser) {
    console.warn("[keep-auth] BOH user not found:", bohUserError);
    return null;
  }

  // Check if user is super admin
  let isSuperAdmin = bohUser.primary_role_hint === "super_admin";
  if (!isSuperAdmin) {
    const { data: roleData } = await serviceClient
      .from("boh_user_role")
      .select("role:boh_role(code)")
      .eq("user_id", bohUser.id)
      .eq("app_context", "boh");
    isSuperAdmin = roleData?.some((r: any) => r.role?.code === "super_admin") ?? false;
  }

  return {
    authUser,
    bohUser,
    isSuperAdmin,
    serviceClient,
  };
}

// Re-export checkKeepAccess and logKeepActivity from old keep-auth.ts
// These functions are still valid and don't need changes
export { checkKeepAccess, logKeepActivity } from "./keep-auth.ts";

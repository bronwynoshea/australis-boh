// @ts-nocheck
// Standardized Keep auth helper - replaces old getAuthContext pattern
// Use this in all Keep Edge functions for consistent authentication

import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateJwt, resolveBohUser } from "./auth.ts";

export interface KeepAuthResult {
  bohUser: any;
  isSuperAdmin: boolean;
  serviceClient: ReturnType<typeof createClient>;
}

/**
 * Standard Keep authentication flow
 * Returns BOH user, super admin status, and service client
 * Use this instead of getAuthContext
 */
export async function authenticateKeepRequest(req: Request): Promise<KeepAuthResult | null> {
  // Get environment variables
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SB_PUBLISHABLE_KEY");
  const secretKey = Deno.env.get("SB_SECRET_KEY");

  if (!supabaseUrl || !publishableKey || !secretKey) {
    console.error("[keep-auth] Missing environment variables");
    return null;
  }

  // Validate JWT with publishable key
  const { user: authUser, error: authError } = await validateJwt(req, supabaseUrl, publishableKey);
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

  // Check super admin status
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
    bohUser,
    isSuperAdmin,
    serviceClient,
  };
}

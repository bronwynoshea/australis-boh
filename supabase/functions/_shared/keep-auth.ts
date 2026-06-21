// @ts-nocheck
// Shared authentication and authorization helpers for Keep module
// Extracts user from validated JWT (edge runtime already validates)

import { createClient } from "jsr:@supabase/supabase-js@2";

export interface AuthContext {
  authUser: any;
  bohUser: any;
  isSuperAdmin: boolean;
}

// Helper to decode base64url
function base64UrlDecode(str: string): string {
  // Add padding if needed
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + padding;
  return atob(base64);
}

// Extract user ID from JWT payload
function extractUserFromJWT(authHeader: string): string | null {
  try {
    const token = authHeader.replace('Bearer ', '');
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload.sub || null;
  } catch (e) {
    console.error("[auth] Failed to decode JWT:", e.message);
    return null;
  }
}

export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("SB_SECRET_KEY");

  if (!supabaseUrl || !secretKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    console.log("[auth] No authorization header");
    return null;
  }

  // Extract auth user ID from JWT (edge runtime already validated it)
  const authUserId = extractUserFromJWT(authHeader);
  console.log("[auth] Extracted auth user ID:", authUserId);
  if (!authUserId) return null;

  // Create admin client for database queries
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  // Resolve BOH user from auth user
  console.log("[auth] Looking up boh_user for auth_id:", authUserId);
  const { data: bohUserData, error: bohUserError } = await adminClient
    .from("boh_user")
    .select("id, primary_role_hint, app_context")
    .eq("auth_user_id", authUserId)
    .eq("app_context", "boh")
    .maybeSingle();
  
  console.log("[auth] boh_user lookup:", { found: !!bohUserData, error: bohUserError?.message });
  if (bohUserError || !bohUserData) return null;

  // Check if user is super admin
  let isSuperAdmin = bohUserData.primary_role_hint === "super_admin";
  if (!isSuperAdmin) {
    const { data: roleData } = await adminClient
      .from("boh_user_role")
      .select("role:boh_role(code)")
      .eq("user_id", bohUserData.id)
      .eq("app_context", "boh");
    isSuperAdmin = roleData?.some((r: any) => r.role?.code === "super_admin") ?? false;
  }

  return {
    authUser: { id: authUserId },
    bohUser: bohUserData,
    isSuperAdmin,
  };
}

export async function checkKeepAccess(
  bohUserId: string,
  sectionSlug: string,
  accessLevel: string,
  requireWrite = false
): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("SB_SECRET_KEY");

  if (!supabaseUrl || !secretKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  // Check for super admin
  const { data: roleData } = await adminClient
    .from("boh_user_role")
    .select("role:boh_role(code)")
    .eq("user_id", bohUserId)
    .eq("app_context", "boh");
  const isSuperAdmin = roleData?.some((r: any) => r.role?.code === "super_admin") ?? false;

  if (isSuperAdmin) return true;

  // Check for explicit user access override
  const { data: userAccessData } = await adminClient
    .from("keep_user_access")
    .select("id")
    .eq("user_id", bohUserId)
    .eq("section_slug", sectionSlug)
    .maybeSingle();

  if (userAccessData) return true;

  // For write access, check app-level permissions
  if (requireWrite) {
    const { data: appData } = await adminClient
      .from("boh_app")
      .select("id")
      .eq("slug", sectionSlug)
      .eq("app_context", "boh")
      .maybeSingle();

    if (appData) {
      const { data: userAppData } = await adminClient
        .from("boh_user_app")
        .select("permission_level")
        .eq("user_id", bohUserId)
        .eq("app_id", appData.id)
        .eq("app_context", "boh")
        .in("permission_level", ["edit", "admin"])
        .maybeSingle();

      if (userAppData) return true;
    }
  }

  // Check access level rules
  if (accessLevel === "all") return true;

  if (accessLevel === "section_admins") {
    // Check if user has admin access to the app matching this section
    const { data: appData } = await adminClient
      .from("boh_app")
      .select("id")
      .eq("slug", sectionSlug)
      .eq("app_context", "boh")
      .maybeSingle();

    if (appData) {
      const { data: userAppData } = await adminClient
        .from("boh_user_app")
        .select("permission_level")
        .eq("user_id", bohUserId)
        .eq("app_id", appData.id)
        .eq("app_context", "boh")
        .eq("permission_level", "admin")
        .maybeSingle();

      if (userAppData) return true;
    }
  }

  if (accessLevel === "super_admin_only") {
    return false; // Already checked super admin above
  }

  return false;
}

export async function logKeepActivity(
  bohUserId: string,
  action: string,
  sectionSlug?: string,
  driveFileId?: string,
  driveFileName?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("SB_SECRET_KEY");

  if (!supabaseUrl || !secretKey) return;

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  await adminClient.from("keep_activity").insert({
    user_id: bohUserId,
    action,
    section_slug: sectionSlug,
    drive_file_id: driveFileId,
    drive_file_name: driveFileName,
    metadata: metadata || {},
  });
}

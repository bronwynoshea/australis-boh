// supabase/functions/boh-save-access/index.ts
// Securely apply role + app access changes for BOH users
// REFACTORED: Uses shared auth, CORS, and response helpers
// @ts-nocheck

import { requireAdmin } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, successResponse, errorResponse, badRequest } from "../_shared/responses.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  // Authenticate and authorize admin (shared helper)
  const auth = await requireAdmin(req);
  if (!auth.success) {
    console.error("[boh-save-access] Admin auth failed:", auth.error);
    return jsonResponse(req, { success: false, error: auth.error }, auth.status);
  }

  const { context, serviceClient: supabaseAdmin } = auth;
  console.log("[boh-save-access] Admin saving access:", context.authUser.email);

  let payload;
  try {
    payload = await req.json();
  } catch (error) {
    console.error("[boh-save-access] Invalid JSON", error);
    return badRequest(req, "Invalid JSON body");
  }

  const input = payload ?? {};
  if (!input.userId || !Array.isArray(input.roleIds) || !Array.isArray(input.appGrants)) {
    return badRequest(req, "Missing required fields");
  }

  try {
    const targetUserId = input.userId as string;
    const roleIds: string[] = input.roleIds;
    const appGrants: Array<{ app_id: string; permission_level: string }> = input.appGrants;

    // Replace boh_user_role entries
    const { error: deleteRolesError } = await supabaseAdmin
      .from("boh_user_role")
      .delete()
      .eq("user_id", targetUserId)
      .eq("app_context", "boh");

    if (deleteRolesError) throw deleteRolesError;

    if (roleIds.length > 0) {
      const roleRows = roleIds.map((roleId) => ({
        user_id: targetUserId,
        role_id: roleId,
        app_context: "boh",
      }));

      const { error: insertRolesError } = await supabaseAdmin
        .from("boh_user_role")
        .insert(roleRows);

      if (insertRolesError) throw insertRolesError;
    }

    const { data: roleMetadata, error: roleMetadataError } = await supabaseAdmin
      .from("boh_role")
      .select("id, code")
      .in("id", roleIds.length ? roleIds : ["00000000-0000-0000-0000-000000000000"]);

    if (roleMetadataError) throw roleMetadataError;

    const targetIsSuperAdmin = roleMetadata?.some((role) => role.code === "super_admin") ?? false;

    if (targetIsSuperAdmin) {
      const { error: deleteAppsError } = await supabaseAdmin
        .from("boh_user_app")
        .delete()
        .eq("user_id", targetUserId)
        .eq("app_context", "boh");
      if (deleteAppsError) throw deleteAppsError;
    } else {
      const { error: deleteAppsError } = await supabaseAdmin
        .from("boh_user_app")
        .delete()
        .eq("user_id", targetUserId)
        .eq("app_context", "boh");
      if (deleteAppsError) throw deleteAppsError;

      if (appGrants.length > 0) {
        const grantRows = appGrants.map((grant) => ({
          user_id: targetUserId,
          app_id: grant.app_id,
          permission_level: grant.permission_level,
          app_context: "boh",
        }));

        const { error: insertAppsError } = await supabaseAdmin
          .from("boh_user_app")
          .insert(grantRows);

        if (insertAppsError) throw insertAppsError;
      }
    }

    const nextPrimaryHint = targetIsSuperAdmin
      ? "super_admin"
      : roleMetadata?.[0]?.code ?? null;

    const { error: updateUserError } = await supabaseAdmin
      .from("boh_user")
      .update({ primary_role_hint: nextPrimaryHint })
      .eq("id", targetUserId);

    if (updateUserError) throw updateUserError;

    const refreshedUserData = await fetchEffectiveUserRecord(supabaseAdmin, targetUserId);

    return successResponse(req, { user: refreshedUserData });
  } catch (error) {
    console.error("[boh-save-access] Unexpected error", error);
    return errorResponse(req, error?.message ?? "Unexpected error", 500);
  }
});

async function fetchEffectiveUserRecord(client: any, userId: string) {
  const { data, error } = await client
    .from("boh_user")
    .select(`
      id,
      email,
      full_name,
      first_name,
      last_name,
      status,
      primary_role_hint,
      boh_user_role (
        id,
        role_id,
        role:boh_role (
          id,
          code,
          label
        )
      ),
      boh_user_app (
        id,
        app_id,
        permission_level,
        app_context,
        app:boh_app (
          id,
          slug,
          name,
          is_active
        )
      )
    `)
    .eq("id", userId)
    .eq("app_context", "boh")
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("Unable to refresh user");
  }

  const { data: appsData, error: appsError } = await client
    .from("boh_app")
    .select("id, slug, name, is_active")
    .eq("app_context", "boh")
    .eq("is_active", true);

  if (appsError) {
    throw appsError;
  }

  return mapAccessUserRow(data, appsData ?? []);
}

function mapAccessUserRow(row: any, apps: any[]) {
  const roles = (row.boh_user_role ?? []).map((assignment: any) => ({
    assignmentId: assignment.id,
    role_id: assignment.role_id,
    code: assignment.role?.code ?? "",
    label: assignment.role?.label ?? assignment.role?.code ?? "Role",
  }));

  const isSuperAdmin = roles.some((role) => role.code === "super_admin");

  let grants;
  if (isSuperAdmin) {
    grants = apps.map((app) => ({
      assignmentId: `super_admin-${row.id}-${app.id}`,
      app_id: app.id,
      permission_level: "admin",
      app: {
        id: app.id,
        slug: app.slug ?? "",
        name: app.name ?? "Unknown app",
      },
      source: "super_admin",
    }));
  } else {
    grants = (row.boh_user_app ?? [])
      .filter((assignment: any) => assignment.app_context === "boh")
      .map((assignment: any) => ({
        assignmentId: assignment.id,
        app_id: assignment.app?.id ?? assignment.app_id,
        permission_level: assignment.permission_level,
        app: {
          id: assignment.app?.id ?? assignment.app_id,
          slug: assignment.app?.slug ?? "",
          name: assignment.app?.name ?? "Unknown app",
        },
        source: "explicit",
      }));
  }

  const accessScope = isSuperAdmin ? "all" : "custom";
  let accessSummary = "No app access";
  if (isSuperAdmin) {
    accessSummary = "Full access (Super Admin)";
  } else if (grants.length > 0) {
    accessSummary = `Access to ${grants.length} app${grants.length === 1 ? "" : "s"}`;
  }

  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    first_name: row.first_name,
    last_name: row.last_name,
    status: row.status,
    primary_role_hint: row.primary_role_hint,
    roles,
    apps: grants,
    warnings: [],
    is_super_admin: isSuperAdmin,
    access_scope: accessScope,
    access_summary: accessSummary,
  };
}

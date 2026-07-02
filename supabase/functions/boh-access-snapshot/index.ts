// supabase/functions/boh-access-snapshot/index.ts
// This Edge Function fetches the Access admin snapshot using the service role key
// so that privileged tables remain locked down via RLS while Access admins still
// see the UI data they need.
// REFACTORED: Uses shared auth, CORS, and response helpers
// @ts-nocheck

import { requireAdmin } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, successResponse, errorResponse } from "../_shared/responses.ts";

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
    console.error("[boh-access-snapshot] Admin auth failed:", auth.error);
    return jsonResponse(req, { success: false, error: auth.error }, auth.status);
  }

  const { context, serviceClient: supabaseAdmin } = auth;
  const currentTenantId = context.bohUser?.tenant_id;
  if (!currentTenantId) {
    return jsonResponse(req, { success: false, error: "Admin user is missing tenant context" }, 403);
  }
  console.log("[boh-access-snapshot] Admin access by", context.authUser.email);

  try {
    const [usersResult, invitesResult, appsResult, rolesResult] = await Promise.all([
      supabaseAdmin
        .from("boh_user")
        .select(`
          id,
          email,
          full_name,
          first_name,
          last_name,
          status,
          primary_role_hint,
          app_context,
          boh_user_role (
            id,
            role_id,
            tenant_id,
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
            tenant_id,
            app:boh_app (
              id,
              slug,
              name
            )
          )
        `)
        .eq("app_context", "boh")
        .eq("tenant_id", currentTenantId)
        .order("full_name", { ascending: true }),
      supabaseAdmin
        .from("boh_invite")
        .select(`
          id,
          email,
          role_hint,
          apps,
          status,
          invited_by,
          invited_user_id,
          first_name,
          last_name,
          created_at,
          last_sent_at,
          accepted_at
        `)
        .eq("app_context", "boh")
        .eq("tenant_id", currentTenantId)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("boh_tenant_app")
        .select("app:boh_app!boh_tenant_app_app_id_fkey(id, slug, name, description, route, external_url, type, is_active)")
        .eq("tenant_id", currentTenantId)
        .in("status", ["enabled", "coming_soon"]),
      supabaseAdmin
        .from("boh_role")
        .select("id, code, label, description")
        .eq("app_context", "boh")
        .order("label", { ascending: true }),
    ]);

    if (usersResult.error) throw usersResult.error;
    if (invitesResult.error) throw invitesResult.error;
    if (appsResult.error) throw appsResult.error;
    if (rolesResult.error) throw rolesResult.error;

    const apps = (appsResult.data ?? [])
      .map((row: any) => Array.isArray(row.app) ? row.app[0] : row.app)
      .filter((app: any) => app?.is_active !== false);
    const users = (usersResult.data ?? []).map((row) => mapAccessUserRow(row, apps, currentTenantId));
    const userLookup = new Map(users.map((user) => [user.id, user]));
    const invites = (invitesResult.data ?? []).map((row) => mapAccessInviteRow(row, userLookup));
    const roles = rolesResult.data ?? [];

    const { conflicts, userWarnings, inviteWarnings } = detectAccessConflicts(users, invites);

    const payload = {
      users: users.map((user) => ({
        ...user,
        warnings: userWarnings.get(user.id) ?? user.warnings,
      })),
      invites: invites.map((invite) => ({
        ...invite,
        warnings: inviteWarnings.get(invite.id) ?? invite.warnings,
      })),
      apps,
      roles,
      conflicts,
    };

    return successResponse(req, payload);
  } catch (error) {
    console.error("[boh-access-snapshot] Unexpected error", error);
    return errorResponse(req, error?.message ?? "Unexpected error", 500);
  }
});

function mapAccessUserRow(row: any, apps: any[], tenantId: string) {
  const enabledAppIds = new Set(apps.map((app) => app.id));
  const roles = (row.boh_user_role ?? [])
    .filter((assignment: any) => assignment.tenant_id === tenantId)
    .map((assignment: any) => ({
      assignmentId: assignment.id,
      role_id: assignment.role_id,
      code: assignment.role?.code ?? "",
      label: assignment.role?.label ?? assignment.role?.code ?? "Role",
    }));

  const isSuperAdmin = roles.some((role) => role.code === "super_admin");

  let appGrants;
  if (isSuperAdmin) {
    appGrants = apps.map((app) => ({
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
    appGrants = (row.boh_user_app ?? [])
      .filter((assignment: any) =>
        assignment.app_context === "boh" &&
        assignment.tenant_id === tenantId &&
        enabledAppIds.has(assignment.app?.id ?? assignment.app_id)
      )
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
  } else if (appGrants.length > 0) {
    accessSummary = `Access to ${appGrants.length} app${appGrants.length === 1 ? "" : "s"}`;
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
    apps: appGrants,
    warnings: [],
    is_super_admin: isSuperAdmin,
    access_scope: accessScope,
    access_summary: accessSummary,
  };
}

function mapAccessInviteRow(row: any, userLookup: Map<string, any>) {
  const invitedByUser = row.invited_by ? userLookup.get(row.invited_by) ?? null : null;
  const invitedUser = row.invited_user_id ? userLookup.get(row.invited_user_id) ?? null : null;

  return {
    id: row.id,
    email: row.email,
    role_hint: row.role_hint,
    apps: row.apps,
    status: row.status,
    invited_by: row.invited_by,
    invited_by_user: invitedByUser ? { full_name: invitedByUser.full_name ?? null } : null,
    invited_user_id: row.invited_user_id,
    invited_user: invitedUser
      ? {
          id: invitedUser.id,
          full_name: invitedUser.full_name ?? null,
          email: invitedUser.email ?? null,
          status: invitedUser.status ?? null,
        }
      : null,
    first_name: row.first_name,
    last_name: row.last_name,
    created_at: row.created_at,
    last_sent_at: row.last_sent_at,
    accepted_at: row.accepted_at,
    warnings: [],
  };
}

function detectAccessConflicts(users: any[], invites: any[]) {
  const conflicts: any[] = [];
  const userWarnings = new Map<string, string[]>();
  const inviteWarnings = new Map<string, string[]>();

  const usersByEmail = new Map<string, any>();
  users.forEach((user) => {
    const email = normalizeEmail(user.email);
    if (email) {
      usersByEmail.set(email, user);
    }
  });

  const pendingInvites = invites.filter((invite) => invite.status === "pending");
  const acceptedInvites = invites.filter((invite) => invite.status === "accepted");

  const acceptedByUserId = new Map<string, any[]>();
  acceptedInvites.forEach((invite) => {
    if (!invite.invited_user_id) return;
    const list = acceptedByUserId.get(invite.invited_user_id) ?? [];
    list.push(invite);
    acceptedByUserId.set(invite.invited_user_id, list);
  });

  pendingInvites.forEach((invite) => {
    const normalizedEmail = normalizeEmail(invite.email);
    if (normalizedEmail && usersByEmail.has(normalizedEmail)) {
      const matchedUser = usersByEmail.get(normalizedEmail)!;
      conflicts.push({
        type: "possible_duplicate_credential",
        userId: matchedUser.id,
        inviteId: invite.id,
        description: `Pending invite ${invite.email} matches active user ${matchedUser.full_name ?? matchedUser.email}.`,
      });
      pushWarning(userWarnings, matchedUser.id, "Pending invite uses this email.");
      pushWarning(inviteWarnings, invite.id, "Email already belongs to an active BOH user.");
    }

    if (invite.invited_user_id) {
      conflicts.push({
        type: "pending_alternate_email",
        userId: invite.invited_user_id,
        inviteId: invite.id,
        description: "Invite references an existing BOH user but uses a different email.",
      });
      pushWarning(userWarnings, invite.invited_user_id, "Alternate email invite is still pending.");
      pushWarning(inviteWarnings, invite.id, "Invite is linked to an existing BOH user.");
    } else if (invite.first_name && invite.last_name) {
      const match = users.find(
        (user) =>
          user.first_name?.toLowerCase() === invite.first_name?.toLowerCase() &&
          user.last_name?.toLowerCase() === invite.last_name?.toLowerCase(),
      );
      if (match) {
        conflicts.push({
          type: "possible_duplicate_credential",
          userId: match.id,
          inviteId: invite.id,
          description: "Pending invite matches an existing user name.",
        });
        pushWarning(userWarnings, match.id, "Name matches a pending invite.");
        pushWarning(inviteWarnings, invite.id, "Name matches an active BOH user.");
      }
    }

    if (invite.invited_user_id && acceptedByUserId.has(invite.invited_user_id)) {
      conflicts.push({
        type: "pending_alternate_email",
        userId: invite.invited_user_id,
        inviteId: invite.id,
        description: "Additional invite detected for a user who has already accepted access.",
      });
      pushWarning(inviteWarnings, invite.id, "Another invite for this user is already accepted.");
    }
  });

  return { conflicts, userWarnings, inviteWarnings };
}

function pushWarning(target: Map<string, string[]>, key: string, message: string) {
  const existing = target.get(key) ?? [];
  existing.push(message);
  target.set(key, existing);
}

function normalizeEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase();
}


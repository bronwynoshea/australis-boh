// supabase/functions/boh-manual-accept-invite/index.ts
// NOTE: This file runs in Supabase's Deno Edge Function environment, not in the
// Vite/TypeScript build. We disable TS checking locally to avoid false errors
// for Deno globals and jsr imports.
// REFACTORED: Uses shared auth, CORS, and response helpers
// @ts-nocheck

import { requireAdmin } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, successResponse, errorResponse, badRequest } from "../_shared/responses.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  // Authenticate and authorize admin (shared helper)
  const auth = await requireAdmin(req);
  if (!auth.success) {
    console.error("[boh-manual-accept-invite] Admin auth failed:", auth.error);
    return jsonResponse(req, { success: false, error: auth.error }, auth.status);
  }

  const { context, serviceClient: supabaseAdmin } = auth;
  const currentTenantId = context.bohUser?.tenant_id;
  if (!currentTenantId) {
    return jsonResponse(req, { success: false, error: "Admin user is missing tenant context" }, 403);
  }
  console.log("[boh-manual-accept-invite] Admin manual accept:", context.authUser.email);

  // -----------------------------
  // 1) Parse and validate payload
  // -----------------------------
  let body:
    | {
        inviteId: string;
      }
    | undefined;

  try {
    body = await req.json();
  } catch (_err) {
    console.error("[boh-manual-accept-invite] Invalid JSON body");
    return badRequest(req, "Invalid JSON body");
  }

  const { inviteId } = body ?? {};

  if (!inviteId) {
    return badRequest(req, "Missing inviteId");
  }

  // -----------------------------
  // 2) Proceed with admin context
  // -----------------------------
  // 3) Get the invite details
  // -----------------------------
  console.log("[boh-manual-accept-invite] Looking for invite:", inviteId);
  
  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("boh_invite")
    .select("*")
    .eq("id", inviteId)
    .eq("tenant_id", currentTenantId)
    .single();

  console.log("[boh-manual-accept-invite] Invite lookup result:", { invite, inviteError });

  if (inviteError || !invite) {
    console.error("[boh-manual-accept-invite] Invite not found:", inviteError);
    return errorResponse(req, "Invite not found", 404);
  }

  if (invite.status !== "pending") {
    console.log("[boh-manual-accept-invite] Invite status:", invite.status);
    return badRequest(req, "Invite is not pending");
  }

  // -----------------------------
  // 4) Find or create BOH user record
  // -----------------------------
  console.log("[boh-manual-accept-invite] Looking for existing BOH user with email:", invite.email);
  
  let bohUserId: string;

  // Check if BOH user already exists
  const { data: existingBohUser, error: existingError } = await supabaseAdmin
    .from("boh_user")
    .select("id")
    .eq("email", invite.email)
    .eq("tenant_id", currentTenantId)
    .eq("app_context", "boh")
    .maybeSingle();

  console.log("[boh-manual-accept-invite] Existing BOH user check:", { existingBohUser, existingError });

  if (existingError && existingError.code !== "PGRST116") {
    console.error("[boh-manual-accept-invite] Error checking existing BOH user:", existingError);
    return errorResponse(req, "Error checking existing user", 500);
  }

  if (existingBohUser) {
    // BOH user already exists
    console.log("[boh-manual-accept-invite] Using existing BOH user:", existingBohUser.id);
    bohUserId = existingBohUser.id;
  } else {
    // Need to create BOH user record - we'll use a simpler approach
    console.log("[boh-manual-accept-invite] Creating new BOH user for email:", invite.email);
    
    // Try to find the auth user ID first by using the auth admin API
    let authUserId: string | null = null;
    
    try {
      // Use the auth admin API to list users and find by email
      const { data: authUsers, error: authListError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (!authListError && authUsers.users) {
        const foundUser = authUsers.users.find(u => u.email === invite.email);
        if (foundUser) {
          authUserId = foundUser.id;
          console.log("[boh-manual-accept-invite] Found auth user ID:", authUserId);
        }
      }
    } catch (err) {
      console.log("[boh-manual-accept-invite] Could not fetch auth users:", err);
    }
    
    // Create the BOH user record
    const { data: newUser, error: createError } = await supabaseAdmin
      .from("boh_user")
      .insert({
        auth_user_id: authUserId, // May be null if we couldn't find it
        email: invite.email,
        first_name: invite.first_name,
        last_name: invite.last_name,
        full_name: invite.first_name && invite.last_name 
          ? `${invite.first_name} ${invite.last_name}`
          : invite.email,
        status: "active",
        primary_role_hint: invite.role_hint || "staff",
        tenant_id: currentTenantId,
        app_context: "boh",
      })
      .select("id")
      .single();

    console.log("[boh-manual-accept-invite] BOH user creation result:", { newUser, createError });

    if (createError || !newUser) {
      console.error("[boh-manual-accept-invite] Error creating BOH user:", createError);
      return errorResponse(req, "Failed to create BOH user record: " + (createError?.message || "Unknown error"), 500);
    }

    bohUserId = newUser.id;
  }

  // -----------------------------
  // 5) Assign role from the invite
  // -----------------------------
  if (invite.role_hint) {
    console.log("[boh-manual-accept-invite] Assigning role:", invite.role_hint);
    
    // Get the role details
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("boh_role")
      .select("id, code, label")
      .eq("code", invite.role_hint)
      .eq("app_context", "boh")
      .single();

    console.log("[boh-manual-accept-invite] Role lookup result:", { roleData, roleError });

    if (!roleError && roleData) {
      // Assign the role to the user
      const { error: roleAssignError } = await supabaseAdmin
        .from("boh_user_role")
        .insert({
          user_id: bohUserId,
          role_id: roleData.id,
          tenant_id: currentTenantId,
          app_context: "boh",
        });

      console.log("[boh-manual-accept-invite] Role assignment result:", { roleAssignError });

      if (roleAssignError) {
        console.error("[boh-manual-accept-invite] Error assigning role:", roleAssignError);
        // Don't fail the whole process, just log the error
      } else {
        console.log("[boh-manual-accept-invite] Successfully assigned role:", invite.role_hint);
      }
    } else {
      console.log("[boh-manual-accept-invite] Role not found:", invite.role_hint);
    }
  } else {
    console.log("[boh-manual-accept-invite] No role_hint in invite");
  }

  // -----------------------------
  // 6) Assign apps from the invite
  // -----------------------------
  if (invite.apps && Array.isArray(invite.apps) && invite.apps.length > 0) {
    console.log("[boh-manual-accept-invite] Assigning apps:", invite.apps);
    
    // Get app details for the slugs in the invite
    const { data: appDetails, error: appError } = await supabaseAdmin
      .from("boh_tenant_app")
      .select("app:boh_app!boh_tenant_app_app_id_fkey(id, slug)")
      .eq("tenant_id", currentTenantId)
      .in("status", ["enabled", "coming_soon"]);

    if (!appError && appDetails && appDetails.length > 0) {
      const enabledApps = appDetails
        .map((row: any) => Array.isArray(row.app) ? row.app[0] : row.app)
        .filter((app: any) => app && invite.apps.includes(app.slug));
      // Create app access records
      const appAccessRecords = enabledApps.map(app => ({
        user_id: bohUserId,
        app_id: app.id,
        permission_level: "edit", // Default permission level
        tenant_id: currentTenantId,
        app_context: "boh",
      }));

      if (appAccessRecords.length === 0) {
        console.log("[boh-manual-accept-invite] No tenant-enabled apps matched invite slugs:", invite.apps);
      } else {
        const { error: accessError } = await supabaseAdmin
          .from("boh_user_app")
          .insert(appAccessRecords);

        if (accessError) {
          console.error("[boh-manual-accept-invite] Error assigning apps:", accessError);
          // Don't fail the whole process, just log the error
        } else {
          console.log("[boh-manual-accept-invite] Successfully assigned apps");
        }
      }
    } else {
      console.log("[boh-manual-accept-invite] No active apps found for slugs:", invite.apps);
    }
  }

  // -----------------------------
  // 6) Update the invite status
  // -----------------------------
  const { error: updateError } = await supabaseAdmin
    .from("boh_invite")
    .update({
      status: "accepted",
      invited_user_id: bohUserId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", inviteId)
    .eq("tenant_id", currentTenantId);

  if (updateError) {
    console.error("[boh-manual-accept-invite] Error updating invite:", updateError);
    return errorResponse(req, "Error updating invite status", 500);
  }

  // -----------------------------
  // 7) Send email notification to user
  // -----------------------------
  try {
    console.log("[boh-manual-accept-invite] Sending email notification to:", invite.email);
    
    const { error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(invite.email, {
      redirectTo: `https://boh.jobzcafe.com/boh`,
      data: {
        action: 'manual_accept_notification',
        message: 'Your access has been manually approved by an administrator. You can now sign in to Back of House.',
      },
    });

    if (emailError) {
      console.error("[boh-manual-accept-invite] Error sending notification email:", emailError);
      // Don't fail the whole process, just log the error
    } else {
      console.log("[boh-manual-accept-invite] Successfully sent notification email");
    }
  } catch (err) {
    console.error("[boh-manual-accept-invite] Exception sending email:", err);
  }

  // -----------------------------
  // 8) Return success
  // -----------------------------
  return successResponse(req, { 
    message: "Invite manually accepted and user created/linked"
  });
});

// Edge Function: keep-quick-link-admin
// Admin-only operations for managing Crew Links (link_scope = 'crew')
// Uses BOH Pattern B manual auth (auth.getUser with bearer token)
// @ts-nocheck

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateKeepRequest } from "../_shared/keep-auth-helper.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Method not allowed" }, 405);
  }

  try {
    // 1. Authenticate
    const keepAuth = await authenticateKeepRequest(req);
    if (!keepAuth) {
      console.warn("[keep-quick-link-admin] Auth failed");
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    const userId = keepAuth.bohUser.id;
    const isSuperAdmin = keepAuth.isSuperAdmin;

    // 2. Verify super admin access (only super admins can manage crew links)
    if (!isSuperAdmin) {
      console.warn("[keep-quick-link-admin] Forbidden: user is not super admin", userId);
      return jsonResponse(req, { success: false, error: "Forbidden: Super admin access required" }, 403);
    }

    // 3. Parse request body
    const body = await req.json();
    const { action } = body;

    if (!action || !['add_crew', 'remove_crew'].includes(action)) {
      return jsonResponse(req, { success: false, error: "Invalid action. Must be 'add_crew' or 'remove_crew'" }, 400);
    }

    // 4. Handle actions
    if (action === 'add_crew') {
      const {
        target_type,
        target_id,
        label,
        subtitle,
        description,
        sort_order = 0,
        area = 'workspace',
      } = body;

      // Validate required fields
      if (!target_type || !target_id || !label) {
        return jsonResponse(req, { success: false, error: "Missing required fields: target_type, target_id, label" }, 400);
      }

      if (!['file', 'folder'].includes(target_type)) {
        return jsonResponse(req, { success: false, error: "Invalid target_type. Must be 'file' or 'folder'" }, 400);
      }

      if (!['workspace', 'gold_library'].includes(area)) {
        return jsonResponse(req, { success: false, error: "Invalid area. Must be 'workspace' or 'gold_library'" }, 400);
      }

      // Insert crew link
      const { data: link, error: insertError } = await keepAuth.serviceClient
        .from('keep_quick_link')
        .insert({
          link_scope: 'crew',
          target_type,
          target_id,
          label,
          subtitle,
          description,
          sort_order,
          area,
          is_active: true,
          user_id: null, // Crew links have no user_id
          created_by: bohUser.id,
        })
        .select('id, link_scope, target_type, target_id, label, subtitle, description, sort_order')
        .single();

      if (insertError) {
        // Check for duplicate error (unique index violation)
        if (insertError.code === '23505') {
          return jsonResponse(req, { success: false, error: "This item is already in Crew Links" }, 409);
        }
        console.error("[keep-quick-link-admin] Insert error:", insertError);
        return jsonResponse(req, { success: false, error: "Failed to add crew link" }, 500);
      }

      return jsonResponse(req, {
        success: true,
        link,
      });
    }

    if (action === 'remove_crew') {
      const { link_id } = body;

      if (!link_id) {
        return jsonResponse(req, { success: false, error: "Missing required field: link_id" }, 400);
      }

      // Delete crew link
      const { error: deleteError } = await keepAuth.serviceClient
        .from('keep_quick_link')
        .delete()
        .eq('id', link_id)
        .eq('link_scope', 'crew');

      if (deleteError) {
        console.error("[keep-quick-link-admin] Delete error:", deleteError);
        return jsonResponse(req, { success: false, error: "Failed to remove crew link" }, 500);
      }

      return jsonResponse(req, {
        success: true,
        message: "Crew link removed successfully",
      });
    }

    // Should not reach here
    return jsonResponse(req, { success: false, error: "Invalid action" }, 400);

  } catch (error) {
    console.error("[keep-quick-link-admin] Unexpected error:", {
      message: error.message,
      stack: error.stack,
    });
    return jsonResponse(req, { success: false, error: error.message || "Internal server error" }, 500);
  }
});

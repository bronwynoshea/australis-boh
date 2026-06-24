// Edge Function: keep-folder-by-id
// Returns a single folder by ID from public.keep_folder table
// Uses BOH Pattern B manual auth (auth.getUser with bearer token)
// @ts-nocheck

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateKeepRequest } from "../_shared/keep-auth-helper.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return jsonResponse(req, { success: false, error: "Method not allowed" }, 405);
  }

  try {
    // 1. Authenticate
    const keepAuth = await authenticateKeepRequest(req);
    if (!keepAuth) {
      console.warn("[keep-folder-by-id] Auth failed");
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    const currentTenantId = keepAuth.bohUser.tenant_id;
    if (!currentTenantId) {
      console.warn("[keep-folder-by-id] Authenticated BOH user has no tenant_id", { bohUserId: keepAuth.bohUser.id });
      return jsonResponse(req, { success: false, error: "Tenant context unavailable" }, 403);
    }

    // 2. Parse query params
    const url = new URL(req.url);
    const folderId = url.searchParams.get("folder_id");
    const includeInactive = url.searchParams.get("include_inactive") === "true";

    if (!folderId) {
      return jsonResponse(
        req,
        { success: false, error: "folder_id is required" },
        400
      );
    }

    // Validate folder_id format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(folderId)) {
      return jsonResponse(
        req,
        { success: false, error: "Invalid folder_id format. Must be a valid UUID" },
        400
      );
    }

    // 3. Build query
    let query = keepAuth.serviceClient
      .from("keep_folder")
      .select(`
        id,
        parent_id,
        tenant_id,
        name,
        slug,
        area,
        folder_type,
        path,
        sort_order,
        is_system_folder,
        allow_user_created_children,
        is_active
      `)
      .eq("id", folderId)
      .eq("tenant_id", currentTenantId);

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    // 5. Execute query
    const { data: folder, error } = await query.single();

    if (error) {
      console.error("[keep-folder-by-id] Database query error:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return jsonResponse(
        req,
        { success: false, error: "Failed to fetch folder" },
        500
      );
    }

    if (!folder) {
      return jsonResponse(
        req,
        { success: false, error: "Folder not found" },
        404
      );
    }

    // 6. Return response
    return jsonResponse(req, {
      success: true,
      folder,
    });

  } catch (error) {
    console.error("[keep-folder-by-id] Unexpected error:", {
      message: error.message,
      stack: error.stack,
    });
    return jsonResponse(
      req,
      { success: false, error: error.message || "Internal server error" },
      500
    );
  }
});

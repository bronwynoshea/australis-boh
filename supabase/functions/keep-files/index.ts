// Edge Function: keep-files
// Returns files from public.keep_file table
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
      console.warn("[keep-files] Auth failed");
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    console.debug("[keep-files] Authenticated user:", {
      bohUserId: keepAuth.bohUser.id,
    });

    // 2. Parse query params
    const url = new URL(req.url);
    const folderId = url.searchParams.get("folder_id");
    const area = url.searchParams.get("area");
    const lifecycleStatus = url.searchParams.get("lifecycle_status");
    const includeInactive = url.searchParams.get("include_inactive") === "true";

    console.log("[keep-files] Query params:", { folderId, area, lifecycleStatus, includeInactive });

    // Validate area if provided
    if (area && area !== "workspace" && area !== "gold_library") {
      return jsonResponse(
        req,
        { success: false, error: "Invalid area. Must be 'workspace' or 'gold_library'" },
        400
      );
    }

    // Validate folder_id format if provided
    if (folderId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(folderId)) {
      return jsonResponse(
        req,
        { success: false, error: "Invalid folder_id format. Must be a valid UUID" },
        400
      );
    }

    // 3. Build query
    const currentTenantId = keepAuth.bohUser.tenant_id;
    if (!currentTenantId) {
      console.warn("[keep-files] Authenticated BOH user has no tenant_id", { bohUserId: keepAuth.bohUser.id });
      return jsonResponse(req, { success: false, error: "Tenant context unavailable" }, 403);
    }

    let query = keepAuth.serviceClient
      .from("keep_file")
      .select(`
        id,
        folder_id,
        tenant_id,
        file_name,
        file_ext,
        mime_type,
        file_size_bytes,
        storage_bucket,
        storage_path,
        area,
        lifecycle_status,
        source_file_id,
        is_current,
        is_active,
        uploaded_by,
        created_at,
        updated_at,
        uploader:boh_user!uploaded_by(full_name, email),
        folder:keep_folder!folder_id(name, path)
      `);

    // Apply filters
    query = query.eq("tenant_id", currentTenantId);

    if (folderId) {
      query = query.eq("folder_id", folderId);
    }

    if (area) {
      query = query.eq("area", area);
    }

    if (lifecycleStatus) {
      query = query.eq("lifecycle_status", lifecycleStatus);
    }

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    // Default to current files only
    query = query.eq("is_current", true);

    // Order by updated_at desc, then file_name asc
    query = query.order("updated_at", { ascending: false }).order("file_name", { ascending: true });

    // 5. Execute query
    const { data: files, error } = await query;

    if (error) {
      console.error("[keep-files] Database query error:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return jsonResponse(
        req,
        { success: false, error: "Failed to fetch files" },
        500
      );
    }

    console.debug("[keep-files] Query successful:", {
      count: files?.length || 0,
      filters: { folderId, area, lifecycleStatus, includeInactive },
    });

    const goldCopiesBySourceId = new Map();
    if (area === "workspace" && files?.length) {
      const workspaceFileIds = files.map((file: any) => file.id);
      const { data: goldCopies, error: goldCopiesError } = await keepAuth.serviceClient
        .from("keep_file")
        .select("id, source_file_id, lifecycle_status")
        .eq("tenant_id", currentTenantId)
        .eq("area", "gold_library")
        .eq("is_active", true)
        .in("source_file_id", workspaceFileIds);

      if (goldCopiesError) {
        console.error("[keep-files] Failed to fetch Gold Library copy status:", {
          code: goldCopiesError.code,
          message: goldCopiesError.message,
        });
      } else {
        (goldCopies || []).forEach((copy: any) => {
          if (!copy.source_file_id) return;
          goldCopiesBySourceId.set(copy.source_file_id, copy);
        });
      }
    }

    // 6. Transform files to include uploaded_by_name from uploader join
    const transformedFiles = (files || []).map((file: any) => {
      const goldCopy = goldCopiesBySourceId.get(file.id);
      console.log("[keep-files] File join debug:", {
        file_id: file.id,
        uploaded_by: file.uploaded_by,
        uploader: file.uploader,
        full_name: file.uploader?.full_name,
        email: file.uploader?.email
      });
      return {
        ...file,
        uploaded_by_name: file.uploader?.full_name || file.uploader?.email || null,
        folder_name: file.folder?.name || null,
        folder_path: file.folder?.path || null,
        has_gold_library_copy: Boolean(goldCopy),
        gold_library_file_id: goldCopy?.id || null,
        gold_library_status: goldCopy?.lifecycle_status || null,
      };
    });

    // 7. Return response
    return jsonResponse(req, {
      success: true,
      files: transformedFiles,
    });

  } catch (error) {
    console.error("[keep-files] Unexpected error:", {
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

// Edge Function: keep-search
// Searches Keep folders and files for the selected area.
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
    const keepAuth = await authenticateKeepRequest(req);
    if (!keepAuth) {
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    const currentTenantId = keepAuth.bohUser.tenant_id;
    if (!currentTenantId) {
      console.warn("[keep-search] Authenticated BOH user has no tenant_id", { bohUserId: keepAuth.bohUser.id });
      return jsonResponse(req, { success: false, error: "Tenant context unavailable" }, 403);
    }

    const url = new URL(req.url);
    const area = url.searchParams.get("area");
    const rawQuery = (url.searchParams.get("q") || "").trim();

    if (area !== "workspace" && area !== "gold_library") {
      return jsonResponse(req, { success: false, error: "Invalid area" }, 400);
    }

    if (rawQuery.length < 2) {
      return jsonResponse(req, { success: true, folders: [], files: [] });
    }

    const searchTerm = rawQuery.replace(/[%_]/g, "\\$&");
    const pattern = `%${searchTerm}%`;

    const { data: folders, error: foldersError } = await keepAuth.serviceClient
      .from("keep_folder")
      .select("id, parent_id, tenant_id, name, slug, area, folder_type, path, sort_order, is_system_folder, allow_user_created_children, is_active")
      .eq("tenant_id", currentTenantId)
      .eq("area", area)
      .eq("is_active", true)
      .or(`name.ilike.${pattern},path.ilike.${pattern}`)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(30);

    if (foldersError) {
      console.error("[keep-search] Folder search failed:", foldersError);
      return jsonResponse(req, { success: false, error: "Failed to search folders" }, 500);
    }

    const { data: files, error: filesError } = await keepAuth.serviceClient
      .from("keep_file")
      .select(`
        id,
        folder_id,
        tenant_id,
        file_name,
        file_ext,
        mime_type,
        file_size_bytes,
        area,
        lifecycle_status,
        uploaded_by,
        created_at,
        updated_at,
        uploader:boh_user!uploaded_by(full_name, email)
      `)
      .eq("tenant_id", currentTenantId)
      .eq("area", area)
      .eq("is_active", true)
      .eq("is_current", true)
      .or(`file_name.ilike.${pattern},file_ext.ilike.${pattern},storage_path.ilike.${pattern}`)
      .order("updated_at", { ascending: false })
      .order("file_name", { ascending: true })
      .limit(50);

    if (filesError) {
      console.error("[keep-search] File search failed:", filesError);
      return jsonResponse(req, { success: false, error: "Failed to search files" }, 500);
    }

    const transformedFiles = (files || []).map((file: any) => ({
      ...file,
      uploaded_by_name: file.uploader?.full_name || file.uploader?.email || null,
    }));

    return jsonResponse(req, {
      success: true,
      folders: folders || [],
      files: transformedFiles,
    });
  } catch (error) {
    console.error("[keep-search] Unexpected error:", error);
    return jsonResponse(req, { success: false, error: error.message || "Internal server error" }, 500);
  }
});

// Edge Function: keep-delete-folder
// Soft-deletes Workspace folders, descendant folders, and current file records.
// Uses BOH Pattern B manual auth.
// @ts-nocheck

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateKeepRequest } from "../_shared/keep-auth-helper.ts";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Method not allowed" }, 405);
  }

  try {
    const keepAuth = await authenticateKeepRequest(req);
    if (!keepAuth) {
      console.warn("[keep-delete-folder] Auth failed");
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    const currentTenantId = keepAuth.bohUser.tenant_id;
    if (!currentTenantId) {
      console.warn("[keep-delete-folder] Authenticated BOH user has no tenant_id", { bohUserId: keepAuth.bohUser.id });
      return jsonResponse(req, { success: false, error: "Tenant context unavailable" }, 403);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { success: false, error: "Invalid JSON body" }, 400);
    }

    const { folderId } = body;
    if (!folderId || typeof folderId !== "string") {
      return jsonResponse(req, { success: false, error: "folderId is required" }, 400);
    }

    if (!isUuid(folderId)) {
      return jsonResponse(req, { success: false, error: "Invalid folderId format" }, 400);
    }

    const { data: folder, error: folderError } = await keepAuth.serviceClient
      .from("keep_folder")
      .select("id, parent_id, tenant_id, name, path, area, is_system_folder, is_active")
      .eq("id", folderId)
      .eq("tenant_id", currentTenantId)
      .maybeSingle();

    if (folderError) {
      console.error("[keep-delete-folder] Failed to fetch folder:", folderError);
      return jsonResponse(req, { success: false, error: "Failed to validate folder" }, 500);
    }

    if (!folder || !folder.is_active) {
      return jsonResponse(req, { success: false, error: "Folder not found" }, 404);
    }

    if (folder.area !== "workspace") {
      return jsonResponse(req, { success: false, error: "Only Workspace folders can be deleted here" }, 403);
    }

    if (folder.is_system_folder || !folder.parent_id) {
      return jsonResponse(req, { success: false, error: "System folders cannot be deleted" }, 403);
    }

    const { data: descendantFolders, error: descendantsError } = await keepAuth.serviceClient
      .from("keep_folder")
      .select("id")
      .eq("tenant_id", currentTenantId)
      .eq("area", "workspace")
      .eq("is_active", true)
      .like("path", `${folder.path}/%`);

    if (descendantsError) {
      console.error("[keep-delete-folder] Failed to fetch descendants:", descendantsError);
      return jsonResponse(req, { success: false, error: "Failed to inspect folder contents" }, 500);
    }

    const folderIds = [folder.id, ...((descendantFolders || []).map((item) => item.id))];

    const { data: activeFiles, error: filesError } = await keepAuth.serviceClient
      .from("keep_file")
      .select("id, uploaded_by")
      .in("folder_id", folderIds)
      .eq("tenant_id", currentTenantId)
      .eq("area", "workspace")
      .eq("is_active", true)
      .eq("is_current", true);

    if (filesError) {
      console.error("[keep-delete-folder] Failed to fetch files:", filesError);
      return jsonResponse(req, { success: false, error: "Failed to inspect folder files" }, 500);
    }

    const hasOtherUsersFiles = (activeFiles || []).some((file) => file.uploaded_by !== keepAuth.bohUser.id);
    if (hasOtherUsersFiles && !keepAuth.isSuperAdmin) {
      return jsonResponse(
        req,
        { success: false, error: "Only a super admin can delete a folder containing files uploaded by other users" },
        403,
      );
    }

    const now = new Date().toISOString();

    const { error: fileUpdateError } = await keepAuth.serviceClient
      .from("keep_file")
      .update({
        is_active: false,
        is_current: false,
        updated_at: now,
      })
      .in("folder_id", folderIds)
      .eq("tenant_id", currentTenantId)
      .eq("area", "workspace")
      .eq("is_active", true);

    if (fileUpdateError) {
      console.error("[keep-delete-folder] Failed to mark files deleted:", fileUpdateError);
      return jsonResponse(req, { success: false, error: "Failed to delete folder files" }, 500);
    }

    const { error: folderUpdateError } = await keepAuth.serviceClient
      .from("keep_folder")
      .update({
        is_active: false,
      })
      .in("id", folderIds)
      .eq("tenant_id", currentTenantId);

    if (folderUpdateError) {
      console.error("[keep-delete-folder] Failed to mark folders deleted:", folderUpdateError);
      return jsonResponse(req, { success: false, error: "Failed to delete folder" }, 500);
    }

    const { error: activityError } = await keepAuth.serviceClient
      .from("keep_file_activity")
      .insert({
        folder_id: folder.id,
        user_id: keepAuth.bohUser.id,
        action: "delete_folder",
        metadata: {
          folder_name: folder.name,
          folder_path: folder.path,
          deleted_folder_count: folderIds.length,
          deleted_file_count: activeFiles?.length || 0,
          deleted_by_permission: keepAuth.isSuperAdmin ? "super_admin" : "owner",
        },
      });

    if (activityError) {
      console.warn("[keep-delete-folder] Failed to log activity:", activityError);
    }

    console.info("[keep-delete-folder] Folder deleted successfully:", {
      folderId: folder.id,
      folderCount: folderIds.length,
      fileCount: activeFiles?.length || 0,
      userId: keepAuth.bohUser.id,
    });

    return jsonResponse(req, {
      success: true,
      message: "Folder deleted successfully",
      deletedFolderCount: folderIds.length,
      deletedFileCount: activeFiles?.length || 0,
    });
  } catch (error) {
    console.error("[keep-delete-folder] Unexpected error:", {
      message: error.message,
      stack: error.stack,
    });
    return jsonResponse(req, { success: false, error: error.message || "Internal server error" }, 500);
  }
});

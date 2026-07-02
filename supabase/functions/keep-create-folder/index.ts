// Edge Function: keep-create-folder
// Creates a new folder in Workspace
// Uses BOH Pattern B manual auth (getAuthContext)
// @ts-nocheck

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateKeepRequest } from "../_shared/keep-auth-helper.ts";

// Helper to convert name to kebab-case slug
function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

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
      console.warn("[keep-create-folder] Auth failed");
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    const userId = keepAuth.bohUser.id;
    const currentTenantId = keepAuth.bohUser.tenant_id;
    if (!currentTenantId) {
      console.warn("[keep-create-folder] Authenticated BOH user has no tenant_id", { bohUserId: userId });
      return jsonResponse(req, { success: false, error: "Tenant context unavailable" }, 403);
    }

    console.debug("[keep-create-folder] Authenticated user:", {
      bohUserId: userId,
      isSuperAdmin: keepAuth.isSuperAdmin,
    });

    // 2. Parse and validate input
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { success: false, error: "Invalid JSON body" }, 400);
    }

    const { parent_id, name } = body;

    if (!parent_id || typeof parent_id !== "string") {
      return jsonResponse(req, { success: false, error: "parent_id is required" }, 400);
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return jsonResponse(req, { success: false, error: "name is required" }, 400);
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parent_id)) {
      return jsonResponse(req, { success: false, error: "Invalid parent_id format" }, 400);
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return jsonResponse(req, { success: false, error: "Folder name too long (max 100 characters)" }, 400);
    }

    // 3. Validate parent folder
    const { data: parentFolder, error: parentError } = await keepAuth.serviceClient
      .from("keep_folder")
      .select("id, tenant_id, name, area, path, allow_user_created_children, is_active")
      .eq("id", parent_id)
      .eq("tenant_id", currentTenantId)
      .maybeSingle();

    if (parentError) {
      console.error("[keep-create-folder] Error fetching parent folder:", parentError);
      return jsonResponse(req, { success: false, error: "Failed to validate parent folder" }, 500);
    }

    if (!parentFolder) {
      return jsonResponse(req, { success: false, error: "Parent folder not found" }, 400);
    }

    if (!parentFolder.is_active) {
      return jsonResponse(req, { success: false, error: "Parent folder is not active" }, 403);
    }

    if (!parentFolder.allow_user_created_children) {
      return jsonResponse(req, { success: false, error: "Folder creation not allowed in this location" }, 403);
    }

    // Allow folder creation in workspace for all users
    // Allow folder creation in gold_library only for super admins
    if (parentFolder.area === "gold_library" && !keepAuth.isSuperAdmin) {
      return jsonResponse(req, { success: false, error: "Folder creation in Gold Library requires admin privileges" }, 403);
    }

    // 5. Generate slug and path
    const slug = toKebabCase(trimmedName);
    if (!slug) {
      return jsonResponse(req, { success: false, error: "Invalid folder name" }, 400);
    }

    const newPath = `${parentFolder.path}/${slug}`;

    // 6. Get next sort_order under this parent
    const { data: siblingFolders, error: siblingError } = await keepAuth.serviceClient
      .from("keep_folder")
      .select("sort_order")
      .eq("parent_id", parent_id)
      .eq("tenant_id", currentTenantId)
      .order("sort_order", { ascending: false })
      .limit(1);

    if (siblingError) {
      console.error("[keep-create-folder] Error fetching sibling folders:", siblingError);
      return jsonResponse(req, { success: false, error: "Failed to determine sort order" }, 500);
    }

    const nextSortOrder = siblingFolders && siblingFolders.length > 0
      ? (siblingFolders[0].sort_order || 0) + 10
      : 10;

    // 7. Check for duplicate slug under same parent
    const { data: existingFolder, error: existingError } = await keepAuth.serviceClient
      .from("keep_folder")
      .select("id")
      .eq("parent_id", parent_id)
      .eq("tenant_id", currentTenantId)
      .eq("slug", slug)
      .maybeSingle();

    if (existingError) {
      console.error("[keep-create-folder] Error checking for existing folder:", existingError);
      return jsonResponse(req, { success: false, error: "Failed to check for duplicates" }, 500);
    }

    if (existingFolder) {
      return jsonResponse(req, { success: false, error: "A folder with this name already exists" }, 409);
    }

    // 8. Insert new folder
    const newFolder = {
      parent_id,
      tenant_id: currentTenantId,
      name: trimmedName,
      slug,
      area: parentFolder.area,
      folder_type: "folder",
      path: newPath,
      sort_order: nextSortOrder,
      is_system_folder: false,
      allow_user_created_children: true,
      is_active: true,
    };

    const { data: insertedFolder, error: insertError } = await keepAuth.serviceClient
      .from("keep_folder")
      .insert(newFolder)
      .select()
      .single();

    if (insertError) {
      console.error("[keep-create-folder] Error inserting folder:", insertError);
      return jsonResponse(req, { success: false, error: "Failed to create folder" }, 500);
    }

    // 9. Log activity
    const { error: activityError } = await keepAuth.serviceClient
      .from("keep_file_activity")
      .insert({
        folder_id: insertedFolder.id,
        user_id: userId,
        action: "create_folder",
        metadata: {
          parent_id,
          folder_name: trimmedName,
          path: newPath,
        },
      });

    if (activityError) {
      console.warn("[keep-create-folder] Failed to log activity:", activityError);
      // Don't fail the request if logging fails
    }

    console.log("[keep-create-folder] Folder created successfully:", {
      folderId: insertedFolder.id,
      name: trimmedName,
      path: newPath,
      userId: keepAuth.bohUser.id,
    });

    // 10. Return success response
    return jsonResponse(req, {
      success: true,
      folder: insertedFolder,
    });

  } catch (error) {
    console.error("[keep-create-folder] Unexpected error:", {
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

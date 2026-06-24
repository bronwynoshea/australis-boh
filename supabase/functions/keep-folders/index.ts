// Edge Function: keep-folders
// Returns folders from public.keep_folder table
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
      console.warn("[keep-folders] Auth failed");
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    console.debug("[keep-folders] Authenticated user:", {
      bohUserId: keepAuth.bohUser.id,
      isSuperAdmin: keepAuth.isSuperAdmin,
    });

    // 2. Parse query params
    const url = new URL(req.url);
    const area = url.searchParams.get("area");
    const parentId = url.searchParams.get("parent_id");
    const includeInactive = url.searchParams.get("include_inactive") === "true";
    const includeAll = url.searchParams.get("include_all") === "true";

    // Validate area if provided
    if (area && area !== "workspace" && area !== "gold_library") {
      return jsonResponse(
        req,
        { success: false, error: "Invalid area. Must be 'workspace' or 'gold_library'" },
        400
      );
    }

    // Validate parent_id format if provided
    if (parentId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parentId)) {
      return jsonResponse(
        req,
        { success: false, error: "Invalid parent_id format. Must be a valid UUID" },
        400
      );
    }

    // 3. Build query
    const currentTenantId = keepAuth.bohUser.tenant_id;
    if (!currentTenantId) {
      console.warn("[keep-folders] Authenticated BOH user has no tenant_id", { bohUserId: keepAuth.bohUser.id });
      return jsonResponse(req, { success: false, error: "Tenant context unavailable" }, 403);
    }

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
      `);

    // Apply filters
    query = query.eq("tenant_id", currentTenantId);

    if (area) {
      query = query.eq("area", area);
    }

    // Only filter by parent_id if not requesting all folders
    if (!includeAll) {
      if (parentId) {
        query = query.eq("parent_id", parentId);
      } else {
        // Return root folders (no parent)
        query = query.is("parent_id", null);
      }
    }

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    // Order by sort_order, then name
    query = query.order("sort_order", { ascending: true }).order("name", { ascending: true });

    // 5. Execute query
    const { data: folders, error } = await query;

    if (error) {
      console.error("[keep-folders] Database query error:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return jsonResponse(
        req,
        { success: false, error: "Failed to fetch folders" },
        500
      );
    }

    console.debug("[keep-folders] Query successful:", {
      count: folders?.length || 0,
      filters: { area, parentId, includeInactive },
    });

    let enrichedFolders = folders || [];

    if ((area === "workspace" || area === "gold_library") && enrichedFolders.length > 0) {
      try {
        const folderIds = enrichedFolders.map((folder: any) => folder.id);
        const { data: areaFolders, error: areaFoldersError } = await keepAuth.serviceClient
          .from("keep_folder")
          .select("id, parent_id")
          .eq("tenant_id", currentTenantId)
          .eq("area", area)
          .eq("is_active", true);

        if (areaFoldersError) {
          console.error("[keep-folders] Failed to fetch folder tree for file counts:", areaFoldersError);
        } else {
          const childrenByParent = new Map();
          (areaFolders || []).forEach((folder: any) => {
            if (!folder.parent_id) return;
            const children = childrenByParent.get(folder.parent_id) || [];
            children.push(folder.id);
            childrenByParent.set(folder.parent_id, children);
          });

          const descendantIdsByFolder = new Map();
          const allRelevantFolderIds = new Set();

          const collectDescendants = (rootId: string) => {
            const cached = descendantIdsByFolder.get(rootId);
            if (cached) return cached;

            const ids = new Set([rootId]);
            const stack = [rootId];
            while (stack.length > 0) {
              const parentId = stack.pop();
              const children = childrenByParent.get(parentId) || [];
              children.forEach((childId: string) => {
                if (!ids.has(childId)) {
                  ids.add(childId);
                  stack.push(childId);
                }
              });
            }

            descendantIdsByFolder.set(rootId, ids);
            return ids;
          };

          folderIds.forEach((folderId: string) => {
            collectDescendants(folderId).forEach((id: string) => allRelevantFolderIds.add(id));
          });

          const { data: areaFiles, error: areaFilesError } = await keepAuth.serviceClient
            .from("keep_file")
            .select("id, folder_id")
            .eq("tenant_id", currentTenantId)
            .eq("area", area)
            .eq("is_active", true)
            .eq("is_current", true)
            .in("folder_id", Array.from(allRelevantFolderIds));

          if (areaFilesError) {
            console.error("[keep-folders] Failed to fetch folder file counts:", areaFilesError);
          } else {
            const workspaceFileIds = area === "workspace"
              ? (areaFiles || []).map((file: any) => file.id)
              : [];
            let goldCopiesBySourceId = new Map();

            if (workspaceFileIds.length > 0) {
              const { data: goldCopies, error: goldCopiesError } = await keepAuth.serviceClient
                .from("keep_file")
                .select("id, source_file_id, lifecycle_status")
                .eq("tenant_id", currentTenantId)
                .eq("area", "gold_library")
                .eq("is_active", true)
                .in("source_file_id", workspaceFileIds);

              if (goldCopiesError) {
                console.error("[keep-folders] Failed to fetch Gold copy status:", goldCopiesError);
              } else {
                goldCopiesBySourceId = new Map(
                  (goldCopies || [])
                    .filter((copy: any) => copy.source_file_id)
                    .map((copy: any) => [copy.source_file_id, copy])
                );
              }
            }

            enrichedFolders = enrichedFolders.map((folder: any) => {
              const descendantIds = collectDescendants(folder.id);
              const folderFiles = (areaFiles || []).filter((file: any) => descendantIds.has(file.folder_id));
              const goldCopies = folderFiles
                .map((file: any) => goldCopiesBySourceId.get(file.id))
                .filter(Boolean);
              const fileCount = folderFiles.length;
              const goldCopyCount = goldCopies.length;

              let goldStatus = null;
              if (area === "workspace" && fileCount > 0 && goldCopyCount > 0) {
                if (goldCopyCount < fileCount) {
                  goldStatus = "partial";
                } else if (goldCopies.some((copy: any) => copy.lifecycle_status === "pending_review")) {
                  goldStatus = "pending_review";
                } else if (goldCopies.every((copy: any) => copy.lifecycle_status === "approved")) {
                  goldStatus = "approved";
                } else if (goldCopies.some((copy: any) => copy.lifecycle_status === "rejected")) {
                  goldStatus = "rejected";
                } else {
                  goldStatus = goldCopies[0]?.lifecycle_status || null;
                }
              }

              return {
                ...folder,
                file_count: fileCount,
                gold_library_copy_count: goldCopyCount,
                has_gold_library_copy: goldCopyCount > 0,
                gold_library_status: goldStatus,
              };
            });
          }
        }
      } catch (statusError) {
        console.error("[keep-folders] Failed to enrich Workspace folders with Gold status:", statusError);
      }
    }

    // 6. Return response
    return jsonResponse(req, {
      success: true,
      folders: enrichedFolders,
    });

  } catch (error) {
    console.error("[keep-folders] Unexpected error:", {
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

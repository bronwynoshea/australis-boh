// Edge Function: keep-submit-to-gold
// Submits Workspace files or folders into Gold Library pending review.
// Uses BOH Pattern B manual auth (auth.getUser with bearer token)
// @ts-nocheck

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateKeepRequest } from "../_shared/keep-auth-helper.ts";
import { resolveStorageBucket } from "../_shared/keep-storage.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 180);
}

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

function buildFolderCacheKey(parentId: string | null, name: string): string {
  return `${parentId || "root"}:${name.trim().toLowerCase()}`;
}

async function getNextSortOrder(serviceClient, parentId: string): Promise<number> {
  const { data } = await serviceClient
    .from("keep_folder")
    .select("sort_order")
    .eq("parent_id", parentId)
    .order("sort_order", { ascending: false })
    .limit(1);

  return data && data.length > 0 ? (data[0].sort_order || 0) + 10 : 10;
}

async function ensureGoldChildFolder(keepAuth, parentFolder, folderName: string, folderCache: Map<string, any>) {
  const currentTenantId = keepAuth.bohUser.tenant_id;
  const trimmedName = folderName.trim();
  const cacheKey = buildFolderCacheKey(parentFolder.id, trimmedName);
  const cachedFolder = folderCache.get(cacheKey);
  if (cachedFolder) return cachedFolder;

  const slug = toKebabCase(trimmedName);
  if (!slug) {
    throw new Error(`Invalid folder name: ${folderName}`);
  }

  const { data: existingFolder, error: existingError } = await keepAuth.serviceClient
    .from("keep_folder")
    .select("id, parent_id, tenant_id, name, slug, area, folder_type, path, sort_order, is_system_folder, allow_user_created_children, is_active")
    .eq("parent_id", parentFolder.id)
    .eq("tenant_id", currentTenantId)
    .eq("slug", slug)
    .eq("area", "gold_library")
    .eq("is_active", true)
    .maybeSingle();

  if (existingError) {
    console.error("[keep-submit-to-gold] Failed to check Gold Library folder:", existingError);
    throw new Error("Failed to check Gold Library destination folders");
  }

  if (existingFolder) {
    folderCache.set(cacheKey, existingFolder);
    return existingFolder;
  }

  const newFolder = {
    parent_id: parentFolder.id,
    tenant_id: currentTenantId,
    name: trimmedName,
    slug,
    area: "gold_library",
    folder_type: "folder",
    path: `${parentFolder.path}/${slug}`,
    sort_order: await getNextSortOrder(keepAuth.serviceClient, parentFolder.id),
    is_system_folder: false,
    allow_user_created_children: true,
    is_active: true,
  };

  const { data: insertedFolder, error: insertError } = await keepAuth.serviceClient
    .from("keep_folder")
    .insert(newFolder)
    .select("id, parent_id, tenant_id, name, slug, area, folder_type, path, sort_order, is_system_folder, allow_user_created_children, is_active")
    .single();

  if (insertError || !insertedFolder) {
    console.error("[keep-submit-to-gold] Failed to create Gold Library folder:", insertError);
    throw new Error("Failed to create Gold Library destination folder");
  }

  await keepAuth.serviceClient.from("keep_file_activity").insert({
    folder_id: insertedFolder.id,
    user_id: keepAuth.bohUser.id,
    action: "create_folder",
    metadata: {
      created_from_workspace_submit: true,
      parent_id: parentFolder.id,
      folder_name: trimmedName,
      path: insertedFolder.path,
    },
  });

  folderCache.set(cacheKey, insertedFolder);
  return insertedFolder;
}

async function duplicateGoldFileExists(keepAuth, targetFolderId: string, sourceFile): Promise<boolean> {
  const currentTenantId = keepAuth.bohUser.tenant_id;
  let duplicateQuery = keepAuth.serviceClient
    .from("keep_file")
    .select("id")
    .eq("folder_id", targetFolderId)
    .eq("tenant_id", currentTenantId)
    .eq("file_name", sourceFile.file_name)
    .eq("area", "gold_library")
    .eq("is_active", true);

  duplicateQuery = sourceFile.file_ext
    ? duplicateQuery.eq("file_ext", sourceFile.file_ext)
    : duplicateQuery.is("file_ext", null);

  const { data: duplicateFile, error: duplicateError } = await duplicateQuery.maybeSingle();

  if (duplicateError) {
    console.error("[keep-submit-to-gold] Duplicate check failed:", duplicateError);
    throw new Error("Failed to check Gold Library destination");
  }

  return Boolean(duplicateFile);
}

async function submitOneFileToGold(keepAuth, sourceFile, destinationFolder, batchMetadata = {}) {
  const currentTenantId = keepAuth.bohUser.tenant_id;
  if (sourceFile.area !== "workspace") {
    throw new Error("Only Workspace files can be submitted to Gold Library");
  }

  if (!sourceFile.is_active || !sourceFile.is_current) {
    throw new Error("Only active current Workspace files can be submitted to Gold Library");
  }

  if (sourceFile.uploaded_by !== keepAuth.bohUser.id && !keepAuth.isSuperAdmin) {
    throw new Error("You can only submit files you uploaded");
  }

  if (await duplicateGoldFileExists(keepAuth, destinationFolder.id, sourceFile)) {
    throw new Error(`A file named ${sourceFile.file_name}${sourceFile.file_ext ? `.${sourceFile.file_ext}` : ""} already exists in the selected Gold Library folder`);
  }

  const sourceBucket = sourceFile.storage_bucket || resolveStorageBucket("workspace");
  const targetBucket = resolveStorageBucket("gold_library");
  const extensionSuffix = sourceFile.file_ext ? `.${sanitizeFilenamePart(sourceFile.file_ext)}` : "";
  const originalFilename = `${sanitizeFilenamePart(sourceFile.file_name)}${extensionSuffix}`;

  const { data: sourceBlob, error: downloadError } = await keepAuth.serviceClient.storage
    .from(sourceBucket)
    .download(sourceFile.storage_path);

  if (downloadError || !sourceBlob) {
    console.error("[keep-submit-to-gold] Failed to read Workspace file:", downloadError);
    throw new Error("Failed to read Workspace file");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const targetPath = `${destinationFolder.path}/${timestamp}-${crypto.randomUUID()}-${originalFilename}`;
  const fileBuffer = await sourceBlob.arrayBuffer();

  const { error: uploadError } = await keepAuth.serviceClient.storage
    .from(targetBucket)
    .upload(targetPath, fileBuffer, {
      contentType: sourceFile.mime_type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    console.error("[keep-submit-to-gold] Failed to write Gold Library file:", uploadError);
    throw new Error("Failed to write Gold Library file");
  }

  const { data: goldFile, error: insertError } = await keepAuth.serviceClient
    .from("keep_file")
    .insert({
      folder_id: destinationFolder.id,
      tenant_id: currentTenantId,
      file_name: sourceFile.file_name,
      file_ext: sourceFile.file_ext,
      mime_type: sourceFile.mime_type,
      file_size_bytes: sourceFile.file_size_bytes,
      storage_bucket: targetBucket,
      storage_path: targetPath,
      area: "gold_library",
      lifecycle_status: "pending_review",
      source_file_id: sourceFile.id,
      uploaded_by: keepAuth.bohUser.id,
      is_current: true,
      is_active: true,
    })
    .select("id")
    .single();

  if (insertError || !goldFile) {
    console.error("[keep-submit-to-gold] Failed to create Gold Library record:", insertError);
    await keepAuth.serviceClient.storage.from(targetBucket).remove([targetPath]);
    throw new Error("Failed to create Gold Library record");
  }

  await keepAuth.serviceClient.from("keep_file_version").insert({
    file_id: goldFile.id,
    version_number: 1,
    storage_bucket: targetBucket,
    storage_path: targetPath,
    file_size_bytes: sourceFile.file_size_bytes,
    mime_type: sourceFile.mime_type,
    uploaded_by: keepAuth.bohUser.id,
    change_reason: "Submitted from Workspace",
  });

  await keepAuth.serviceClient.from("keep_file_activity").insert({
    file_id: goldFile.id,
    folder_id: destinationFolder.id,
    user_id: keepAuth.bohUser.id,
    action: "submit_to_gold_review",
    metadata: {
      source_file_id: sourceFile.id,
      source_bucket: sourceBucket,
      source_path: sourceFile.storage_path,
      target_bucket: targetBucket,
      target_path: targetPath,
      ...batchMetadata,
    },
  });

  return {
    id: goldFile.id,
    lifecycleStatus: "pending_review",
    sourceFileId: sourceFile.id,
    destinationFolderId: destinationFolder.id,
  };
}

function collectDescendantFolderIds(allFolders, rootFolderId: string): Set<string> {
  const byParent = new Map<string, any[]>();
  for (const folder of allFolders || []) {
    if (!folder.parent_id) continue;
    const children = byParent.get(folder.parent_id) || [];
    children.push(folder);
    byParent.set(folder.parent_id, children);
  }

  const folderIds = new Set<string>([rootFolderId]);
  const stack = [rootFolderId];
  while (stack.length > 0) {
    const parentId = stack.pop();
    const children = byParent.get(parentId) || [];
    for (const child of children) {
      if (!folderIds.has(child.id)) {
        folderIds.add(child.id);
        stack.push(child.id);
      }
    }
  }

  return folderIds;
}

function getRelativeFolderNames(sourceFolder, fileFolder, folderById): string[] {
  const names: string[] = [];
  let current = fileFolder;

  while (current && current.id !== sourceFolder.id) {
    names.unshift(current.name);
    current = current.parent_id ? folderById.get(current.parent_id) : null;
  }

  return names;
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
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    const currentTenantId = keepAuth.bohUser.tenant_id;
    if (!currentTenantId) {
      console.warn("[keep-submit-to-gold] Authenticated BOH user has no tenant_id", { bohUserId: keepAuth.bohUser.id });
      return jsonResponse(req, { success: false, error: "Tenant context unavailable" }, 403);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { success: false, error: "Invalid JSON body" }, 400);
    }

    const fileId = body?.fileId;
    const folderId = body?.folderId;
    const destinationFolderId = body?.destinationFolderId;

    if (!destinationFolderId || (!fileId && !folderId) || (fileId && folderId)) {
      return jsonResponse(req, { success: false, error: "Provide destinationFolderId and exactly one of fileId or folderId" }, 400);
    }

    if (!uuidPattern.test(destinationFolderId) || (fileId && !uuidPattern.test(fileId)) || (folderId && !uuidPattern.test(folderId))) {
      return jsonResponse(req, { success: false, error: "Invalid id format" }, 400);
    }

    const { data: destinationFolder, error: folderError } = await keepAuth.serviceClient
      .from("keep_folder")
      .select("id, parent_id, tenant_id, name, slug, area, folder_type, path, sort_order, is_system_folder, allow_user_created_children, is_active")
      .eq("id", destinationFolderId)
      .eq("tenant_id", currentTenantId)
      .eq("area", "gold_library")
      .eq("is_active", true)
      .single();

    if (folderError || !destinationFolder) {
      return jsonResponse(req, { success: false, error: "Gold Library destination folder not found" }, 404);
    }

    if (fileId) {
      const { data: sourceFile, error: sourceError } = await keepAuth.serviceClient
        .from("keep_file")
        .select("id, folder_id, tenant_id, file_name, file_ext, mime_type, file_size_bytes, storage_bucket, storage_path, area, lifecycle_status, uploaded_by, is_current, is_active")
        .eq("id", fileId)
        .eq("tenant_id", currentTenantId)
        .maybeSingle();

      if (sourceError) {
        console.error("[keep-submit-to-gold] Failed to load source file:", sourceError);
        return jsonResponse(req, { success: false, error: "Failed to load Workspace file" }, 500);
      }

      if (!sourceFile) {
        return jsonResponse(req, { success: false, error: "File not found" }, 404);
      }

      const goldFile = await submitOneFileToGold(keepAuth, sourceFile, destinationFolder);

      return jsonResponse(req, {
        success: true,
        file: goldFile,
      });
    }

    const { data: sourceFolder, error: sourceFolderError } = await keepAuth.serviceClient
      .from("keep_folder")
      .select("id, parent_id, tenant_id, name, slug, area, folder_type, path, sort_order, is_system_folder, allow_user_created_children, is_active")
      .eq("id", folderId)
      .eq("tenant_id", currentTenantId)
      .eq("area", "workspace")
      .eq("is_active", true)
      .maybeSingle();

    if (sourceFolderError) {
      console.error("[keep-submit-to-gold] Failed to load Workspace folder:", sourceFolderError);
      return jsonResponse(req, { success: false, error: "Failed to load Workspace folder" }, 500);
    }

    if (!sourceFolder) {
      return jsonResponse(req, { success: false, error: "Workspace folder not found" }, 404);
    }

    const { data: workspaceFolders, error: workspaceFoldersError } = await keepAuth.serviceClient
      .from("keep_folder")
      .select("id, parent_id, tenant_id, name, slug, area, path, is_active")
      .eq("tenant_id", currentTenantId)
      .eq("area", "workspace")
      .eq("is_active", true);

    if (workspaceFoldersError) {
      console.error("[keep-submit-to-gold] Failed to load Workspace folders:", workspaceFoldersError);
      return jsonResponse(req, { success: false, error: "Failed to load Workspace folder tree" }, 500);
    }

    const folderById = new Map((workspaceFolders || []).map((folder) => [folder.id, folder]));
    folderById.set(sourceFolder.id, sourceFolder);
    const descendantFolderIds = collectDescendantFolderIds(workspaceFolders || [], sourceFolder.id);
    const descendantIds = Array.from(descendantFolderIds);

    const { data: sourceFiles, error: sourceFilesError } = await keepAuth.serviceClient
      .from("keep_file")
      .select("id, folder_id, tenant_id, file_name, file_ext, mime_type, file_size_bytes, storage_bucket, storage_path, area, lifecycle_status, uploaded_by, is_current, is_active")
      .in("folder_id", descendantIds)
      .eq("tenant_id", currentTenantId)
      .eq("area", "workspace")
      .eq("is_active", true)
      .eq("is_current", true)
      .order("file_name", { ascending: true });

    if (sourceFilesError) {
      console.error("[keep-submit-to-gold] Failed to load Workspace folder files:", sourceFilesError);
      return jsonResponse(req, { success: false, error: "Failed to load Workspace folder files" }, 500);
    }

    if (!sourceFiles || sourceFiles.length === 0) {
      return jsonResponse(req, { success: false, error: "No active files found in this Workspace folder" }, 404);
    }

    if (!keepAuth.isSuperAdmin) {
      const unauthorizedFile = sourceFiles.find((file) => file.uploaded_by !== keepAuth.bohUser.id);
      if (unauthorizedFile) {
        return jsonResponse(req, { success: false, error: "You can only submit folders containing files you uploaded" }, 403);
      }
    }

    const folderCache = new Map<string, any>();
    folderCache.set(buildFolderCacheKey(destinationFolder.parent_id, destinationFolder.name), destinationFolder);

    const rootGoldFolder = await ensureGoldChildFolder(keepAuth, destinationFolder, sourceFolder.name, folderCache);
    const targetFolderBySourceFolderId = new Map<string, any>([[sourceFolder.id, rootGoldFolder]]);

    for (const sourceFile of sourceFiles) {
      const sourceFileFolder = folderById.get(sourceFile.folder_id) || sourceFolder;
      const relativeFolderNames = getRelativeFolderNames(sourceFolder, sourceFileFolder, folderById);
      let targetFolder = targetFolderBySourceFolderId.get(sourceFile.folder_id);

      if (!targetFolder) {
        targetFolder = rootGoldFolder;
        let currentSourceFolderId = sourceFolder.id;
        for (const folderName of relativeFolderNames) {
          targetFolder = await ensureGoldChildFolder(keepAuth, targetFolder, folderName, folderCache);
          const matchingSourceChild = (workspaceFolders || []).find((folder) =>
            folder.parent_id === currentSourceFolderId && folder.name === folderName
          );
          if (matchingSourceChild) {
            currentSourceFolderId = matchingSourceChild.id;
            targetFolderBySourceFolderId.set(currentSourceFolderId, targetFolder);
          }
        }
        targetFolderBySourceFolderId.set(sourceFile.folder_id, targetFolder);
      }
    }

    const duplicateNames: string[] = [];
    for (const sourceFile of sourceFiles) {
      const targetFolder = targetFolderBySourceFolderId.get(sourceFile.folder_id) || rootGoldFolder;
      if (await duplicateGoldFileExists(keepAuth, targetFolder.id, sourceFile)) {
        duplicateNames.push(`${sourceFile.file_name}${sourceFile.file_ext ? `.${sourceFile.file_ext}` : ""}`);
      }
    }

    if (duplicateNames.length > 0) {
      return jsonResponse(req, {
        success: false,
        error: `Gold Library already has ${duplicateNames.length} file${duplicateNames.length === 1 ? "" : "s"} with matching names in the target folder tree`,
        duplicates: duplicateNames,
      }, 409);
    }

    const batchId = crypto.randomUUID();
    const submittedFiles = [];
    for (const sourceFile of sourceFiles) {
      const targetFolder = targetFolderBySourceFolderId.get(sourceFile.folder_id) || rootGoldFolder;
      const submittedFile = await submitOneFileToGold(keepAuth, sourceFile, targetFolder, {
        batch_id: batchId,
        submitted_as_folder: true,
        source_root_folder_id: sourceFolder.id,
        source_root_folder_name: sourceFolder.name,
      });
      submittedFiles.push(submittedFile);
    }

    await keepAuth.serviceClient.from("keep_file_activity").insert({
      folder_id: rootGoldFolder.id,
      user_id: keepAuth.bohUser.id,
      action: "submit_folder_to_gold_review",
      metadata: {
        batch_id: batchId,
        source_folder_id: sourceFolder.id,
        source_folder_name: sourceFolder.name,
        destination_folder_id: destinationFolder.id,
        submitted_file_count: submittedFiles.length,
      },
    });

    return jsonResponse(req, {
      success: true,
      folder: {
        id: rootGoldFolder.id,
        lifecycleStatus: "pending_review",
        sourceFolderId: sourceFolder.id,
        submittedFileCount: submittedFiles.length,
      },
      files: submittedFiles,
    });
  } catch (error) {
    console.error("[keep-submit-to-gold] Unexpected error:", error);
    return jsonResponse(req, { success: false, error: error.message || "Internal server error" }, 500);
  }
});

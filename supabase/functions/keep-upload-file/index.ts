// Edge Function: keep-upload-file
// Handles file upload to Supabase Storage and database record creation
// Uses BOH Pattern B manual auth (auth.getUser with bearer token)
// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { validateJwt, resolveBohUser } from "../_shared/auth.ts";
import { resolveStorageBucket } from "../_shared/keep-storage.ts";

// Parse multipart/form-data and extract file and fields
async function parseMultipartFormData(req: Request): Promise<{ file: File | null; folderId: string | null; relativePath: string | null }> {
  const contentType = req.headers.get("content-type");
  if (!contentType || !contentType.includes("multipart/form-data")) {
    return { file: null, folderId: null, relativePath: null };
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folderId = formData.get("folder_id") as string | null;
  const relativePath = formData.get("relative_path") as string | null;

  return { file, folderId, relativePath };
}

// Extract file extension from filename
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : "";
}

// Extract file name without extension
function getFileNameWithoutExt(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

function sanitizePathSegments(path: string | null): string[] {
  if (!path) return [];

  const normalized = path.replace(/\\/g, "/");
  const segments = normalized
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (
    normalized.startsWith("/") ||
    normalized.includes("://") ||
    segments.some((segment) => segment === "." || segment === ".." || segment.includes("\0"))
  ) {
    throw new Error("Invalid relative path");
  }

  return segments.map((segment) => segment.replace(/[<>:"|?*\x00-\x1F]/g, "_").substring(0, 100));
}

async function resolveDestinationFolder(serviceClient, baseFolder, relativePath: string | null) {
  const segments = sanitizePathSegments(relativePath);
  const folderSegments = segments.length > 1 ? segments.slice(0, -1) : [];
  let currentFolder = baseFolder;

  for (const segment of folderSegments) {
    const folderName = segment.trim();
    const slug = toKebabCase(folderName);

    if (!folderName || !slug) {
      throw new Error("Invalid folder name in relative path");
    }

    const { data: existingFolder, error: existingError } = await serviceClient
      .from("keep_folder")
      .select("id, name, area, path, allow_user_created_children, is_active")
      .eq("parent_id", currentFolder.id)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (existingError) {
      console.error("[keep-upload-file] Failed to resolve nested folder:", existingError);
      throw new Error("Failed to resolve destination folder");
    }

    if (existingFolder) {
      currentFolder = existingFolder;
      continue;
    }

    const { data: siblingFolders, error: siblingError } = await serviceClient
      .from("keep_folder")
      .select("sort_order")
      .eq("parent_id", currentFolder.id)
      .order("sort_order", { ascending: false })
      .limit(1);

    if (siblingError) {
      console.error("[keep-upload-file] Failed to determine nested folder sort order:", siblingError);
      throw new Error("Failed to create destination folder");
    }

    const nextSortOrder = siblingFolders && siblingFolders.length > 0
      ? (siblingFolders[0].sort_order || 0) + 10
      : 10;

    const { data: insertedFolder, error: insertError } = await serviceClient
      .from("keep_folder")
      .insert({
        parent_id: currentFolder.id,
        name: folderName,
        slug,
        area: currentFolder.area,
        folder_type: "folder",
        path: `${currentFolder.path}/${slug}`,
        sort_order: nextSortOrder,
        is_system_folder: false,
        allow_user_created_children: true,
        is_active: true,
      })
      .select("id, name, area, path, allow_user_created_children, is_active")
      .single();

    if (insertError || !insertedFolder) {
      console.error("[keep-upload-file] Failed to create nested folder:", insertError);
      throw new Error("Failed to create destination folder");
    }

    currentFolder = insertedFolder;
  }

  return currentFolder;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Method not allowed" }, 405);
  }

  try {
    // 1. Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SB_PUBLISHABLE_KEY");
    const secretKey = Deno.env.get("SB_SECRET_KEY");

    if (!supabaseUrl || !publishableKey || !secretKey) {
      console.error("[keep-upload-file] Missing Supabase environment variables");
      return jsonResponse(req, { success: false, error: "Server misconfiguration" }, 500);
    }

    // 2. Validate auth
    const { user: authUser, error: authError } = await validateJwt(req, supabaseUrl, publishableKey);
    if (authError || !authUser) {
      console.warn("[keep-upload-file] Auth failed:", authError);
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    // 3. Create service client
    const serviceClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false },
    });

    // 4. Resolve BOH user
    const { bohUser, error: bohUserError } = await resolveBohUser(serviceClient, authUser.id);
    if (bohUserError || !bohUser) {
      console.warn("[keep-upload-file] BOH user not found:", bohUserError);
      return jsonResponse(req, { success: false, error: "User not found" }, 404);
    }

    const userId = bohUser.id;
    console.debug("[keep-upload-file] Authenticated user:", { userId });

    // 2. Parse multipart form data
    const { file, folderId, relativePath } = await parseMultipartFormData(req);

    if (!file) {
      return jsonResponse(req, { success: false, error: "Missing file" }, 400);
    }

    if (!folderId) {
      return jsonResponse(req, { success: false, error: "Missing folder_id" }, 400);
    }

    // Validate folder_id format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(folderId)) {
      return jsonResponse(req, { success: false, error: "Invalid folder_id format" }, 400);
    }

    console.debug("[keep-upload-file] Upload request:", {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      folderId,
      relativePath,
    });

    // 5. Validate folder and get folder data
    const { data: folder, error: folderError } = await serviceClient
      .from("keep_folder")
      .select("id, path, area, is_active, allow_user_created_children")
      .eq("id", folderId)
      .single();

    if (folderError || !folder) {
      console.error("[keep-upload-file] Folder not found:", { folderId, error: folderError });
      return jsonResponse(req, { success: false, error: "Folder not found" }, 404);
    }

    if (!folder.is_active) {
      console.warn("[keep-upload-file] Folder is inactive:", { folderId });
      return jsonResponse(req, { success: false, error: "Folder is inactive" }, 400);
    }

    // For Gold Library, allow uploads regardless of allow_user_created_children
    // since governance workflow handles approval
    if (folder.area !== "gold_library" && !folder.allow_user_created_children) {
      console.warn("[keep-upload-file] Folder does not allow user uploads:", { folderId });
      return jsonResponse(req, { success: false, error: "Upload not allowed in this folder" }, 403);
    }

    console.debug("[keep-upload-file] Folder validated:", {
      folderId: folder.id,
      path: folder.path,
      area: folder.area,
    });

    let destinationFolder;
    try {
      destinationFolder = await resolveDestinationFolder(serviceClient, folder, relativePath);
    } catch (pathError) {
      console.warn("[keep-upload-file] Invalid relative path:", { relativePath, error: pathError.message });
      return jsonResponse(req, { success: false, error: pathError.message || "Invalid relative path" }, 400);
    }

    console.debug("[keep-upload-file] Destination folder resolved:", {
      folderId: destinationFolder.id,
      path: destinationFolder.path,
      area: destinationFolder.area,
    });

    // Extract file metadata early for duplicate check. Folder uploads can arrive
    // with a path-like filename, so derive display metadata from the relative path
    // basename when present.
    const relativeSegments = sanitizePathSegments(relativePath);
    const displayFilename = relativeSegments.length > 0
      ? relativeSegments[relativeSegments.length - 1]
      : basename(file.name);
    const fileExt = getFileExtension(displayFilename);
    const fileNameWithoutExt = getFileNameWithoutExt(displayFilename);

    // 5a. Check for duplicate file in destination folder
    const { data: existingFile, error: duplicateCheckError } = await serviceClient
      .from("keep_file")
      .select("id, lifecycle_status")
      .eq("folder_id", destinationFolder.id)
      .eq("file_name", fileNameWithoutExt)
      .eq("file_ext", fileExt)
      .eq("is_active", true)
      .maybeSingle();

    if (duplicateCheckError) {
      console.error("[keep-upload-file] Duplicate check failed:", duplicateCheckError);
      return jsonResponse(req, { success: false, error: "Failed to check for duplicates" }, 500);
    }

    if (existingFile) {
      console.warn("[keep-upload-file] Duplicate file detected:", {
        existingFileId: existingFile.id,
        fileName: `${fileNameWithoutExt}.${fileExt}`,
        folderId,
      });
      return jsonResponse(
        req,
        {
          success: false,
          error: `A file named "${fileNameWithoutExt}.${fileExt}" already exists in this folder. Please rename your file or delete the existing one first.`,
        },
        409
      );
    }

    // 5. Build storage path. Folder uploads preserve nested paths; single-file uploads keep the existing timestamp pattern.
    const timestamp = Math.floor(Date.now() / 1000);
    const originalFilename = displayFilename.replace(/[^a-zA-Z0-9._-]/g, "_"); // Sanitize filename
    const storagePath = relativePath
      ? `${destinationFolder.path}/${originalFilename}`
      : `${destinationFolder.path}/${timestamp}-${originalFilename}`;
    
    // Resolve bucket based on area (two-bucket architecture)
    const storageBucket = resolveStorageBucket(destinationFolder.area);

    // Extract remaining file metadata
    const fileSize = file.size;
    const mimeType = file.type || "application/octet-stream";

    console.log("[keep-upload-file] Storage routing:", { 
      area: destinationFolder.area,
      bucket: storageBucket, 
      path: storagePath,
      fileName: file.name,
    });

    // 6. Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await serviceClient.storage
      .from(storageBucket)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[keep-upload-file] Storage upload failed:", {
        name: uploadError.name,
        message: uploadError.message,
        statusCode: uploadError.statusCode,
        error: uploadError,
      });
      return jsonResponse(req, { 
        success: false, 
        error: `Storage upload failed: ${uploadError.message}`,
        details: uploadError.name,
      }, 500);
    }

    console.debug("[keep-upload-file] File uploaded to storage successfully");

    // 7. Insert into keep_file
    // Gold Library files start in pending_review status, Workspace files in draft
    const initialLifecycleStatus = destinationFolder.area === "gold_library" ? "pending_review" : "draft";

    const { data: fileRecord, error: fileInsertError } = await serviceClient
      .from("keep_file")
      .insert({
        folder_id: destinationFolder.id,
        file_name: fileNameWithoutExt,
        file_ext: fileExt,
        mime_type: mimeType,
        file_size_bytes: fileSize,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        area: destinationFolder.area,
        lifecycle_status: initialLifecycleStatus,
        uploaded_by: userId,
        is_current: true,
        is_active: true,
      })
      .select()
      .single();

    if (fileInsertError || !fileRecord) {
      console.error("[keep-upload-file] Failed to insert keep_file record:", {
        code: fileInsertError?.code,
        message: fileInsertError?.message,
      });

      // Attempt to clean up storage upload
      await serviceClient.storage.from(storageBucket).remove([storagePath]);

      return jsonResponse(req, { success: false, error: "Failed to create file record" }, 500);
    }

    console.debug("[keep-upload-file] keep_file record created:", { fileId: fileRecord.id });

    // 8. Insert into keep_file_version
    const { error: versionInsertError } = await serviceClient.from("keep_file_version").insert({
      file_id: fileRecord.id,
      version_number: 1,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      file_size_bytes: fileSize,
      mime_type: mimeType,
      uploaded_by: userId,
    });

    if (versionInsertError) {
      console.error("[keep-upload-file] Failed to insert keep_file_version:", {
        code: versionInsertError.code,
        message: versionInsertError.message,
      });
      // Continue - file record exists, version is secondary
    } else {
      console.debug("[keep-upload-file] keep_file_version record created");
    }

    // 9. Insert into keep_file_activity
    const { error: activityInsertError } = await serviceClient.from("keep_file_activity").insert({
      file_id: fileRecord.id,
      folder_id: destinationFolder.id,
      user_id: userId,
      action: "upload",
      metadata: {
        file_name: file.name,
        file_size_bytes: fileSize,
        mime_type: mimeType,
        relative_path: relativePath,
      },
    });

    if (activityInsertError) {
      console.error("[keep-upload-file] Failed to insert keep_file_activity:", {
        code: activityInsertError.code,
        message: activityInsertError.message,
      });
      // Continue - activity logging is secondary
    } else {
      console.debug("[keep-upload-file] keep_file_activity record created");
    }

    console.info("[keep-upload-file] Upload completed successfully:", {
      fileId: fileRecord.id,
      fileName: file.name,
      userId,
    });

    // 10. Return response
    return jsonResponse(req, {
      success: true,
      file: fileRecord,
    });
  } catch (error) {
    console.error("[keep-upload-file] Unexpected error:", {
      message: error.message,
      stack: error.stack,
    });
    return jsonResponse(req, { success: false, error: error.message || "Internal server error" }, 500);
  }
});

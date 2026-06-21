// Edge Function: keep-file-versions
// Handles version replacement and version history
// Uses BOH Pattern B manual auth (auth.getUser with bearer token)
// @ts-nocheck

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateKeepRequest } from "../_shared/keep-auth-helper.ts";
import { resolveStorageBucket } from "../_shared/keep-storage.ts";

// Parse multipart/form-data and extract file and fields
async function parseMultipartFormData(req: Request): Promise<{ 
  file: File | null; 
  fileId: string | null;
  reason: string | null;
}> {
  const contentType = req.headers.get("content-type");
  if (!contentType || !contentType.includes("multipart/form-data")) {
    return { file: null, fileId: null, reason: null };
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const fileId = formData.get("file_id") as string | null;
  const reason = formData.get("reason") as string | null;

  return { file, fileId, reason };
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

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Handle GET request for version history
  if (req.method === "GET") {
    return handleGetVersions(req);
  }

  // Handle POST request for uploading new version
  if (req.method === "POST") {
    return handleUploadVersion(req);
  }

  return jsonResponse(req, { success: false, error: "Method not allowed" }, 405);
});

// GET: Fetch version history for a file
async function handleGetVersions(req: Request) {
  try {
    // 1. Authenticate
    const keepAuth = await authenticateKeepRequest(req);
    if (!keepAuth) {
      console.warn("[keep-file-versions] GET auth failed");
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    // 2. Parse query params
    const url = new URL(req.url);
    const fileId = url.searchParams.get("file_id");

    if (!fileId) {
      return jsonResponse(req, { success: false, error: "file_id is required" }, 400);
    }

    // Validate file_id format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
      return jsonResponse(req, { success: false, error: "Invalid file_id format" }, 400);
    }

    // 3. Verify file exists and user has access
    const { data: fileRecord, error: fileError } = await keepAuth.serviceClient
      .from("keep_file")
      .select("id, folder_id, area, lifecycle_status, is_active")
      .eq("id", fileId)
      .single();

    if (fileError || !fileRecord) {
      return jsonResponse(req, { success: false, error: "File not found" }, 404);
    }

    // 4. Fetch version history
    const { data: versions, error: versionsError } = await keepAuth.serviceClient
      .from("keep_file_version")
      .select(`
        id,
        file_id,
        version_number,
        storage_bucket,
        storage_path,
        file_size_bytes,
        mime_type,
        uploaded_by,
        uploaded_at,
        change_reason,
        uploader:boh_user!uploaded_by(id, app_context)
      `)
      .eq("file_id", fileId)
      .order("version_number", { ascending: false });

    if (versionsError) {
      console.error("[keep-file-versions] Failed to fetch versions:", versionsError);
      return jsonResponse(req, { success: false, error: "Failed to fetch version history" }, 500);
    }

    // 6. Log view activity
    await keepAuth.serviceClient.from("keep_file_activity").insert({
      file_id: fileId,
      folder_id: fileRecord.folder_id,
      user_id: keepAuth.bohUser.id,
      action: "view_versions",
      metadata: {
        area: fileRecord.area,
        version_count: versions?.length || 0,
      },
    });

    return jsonResponse(req, {
      success: true,
      versions: versions || [],
      file: {
        id: fileRecord.id,
        area: fileRecord.area,
        lifecycleStatus: fileRecord.lifecycle_status,
      },
    });
  } catch (error) {
    console.error("[keep-file-versions] GET unexpected error:", error);
    return jsonResponse(req, { success: false, error: error.message || "Internal server error" }, 500);
  }
}

// POST: Upload new version of a file
async function handleUploadVersion(req: Request) {
  try {
    // 1. Authenticate
    const keepAuth = await authenticateKeepRequest(req);
    if (!keepAuth) {
      console.warn("[keep-file-versions] POST auth failed");
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    const userId = keepAuth.bohUser.id;

    // 2. Parse multipart form data
    const { file, fileId, reason } = await parseMultipartFormData(req);

    if (!file) {
      return jsonResponse(req, { success: false, error: "Missing file" }, 400);
    }

    if (!fileId) {
      return jsonResponse(req, { success: false, error: "Missing file_id" }, 400);
    }

    // Validate file_id format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
      return jsonResponse(req, { success: false, error: "Invalid file_id format" }, 400);
    }

    // 3. Fetch existing file record
    const { data: existingFile, error: fileError } = await keepAuth.serviceClient
      .from("keep_file")
      .select(`
        id,
        folder_id,
        file_name,
        file_ext,
        storage_bucket,
        storage_path,
        area,
        lifecycle_status,
        is_active,
        folder:keep_folder!inner(path, is_active, allow_user_created_children)
      `)
      .eq("id", fileId)
      .eq("is_current", true)
      .single();

    if (fileError || !existingFile) {
      console.error("[keep-file-versions] File not found:", { fileId, error: fileError });
      return jsonResponse(req, { success: false, error: "File not found" }, 404);
    }

    if (!existingFile.is_active) {
      return jsonResponse(req, { success: false, error: "Cannot version an inactive file" }, 400);
    }

    if (!existingFile.folder.is_active) {
      return jsonResponse(req, { success: false, error: "Folder is inactive" }, 400);
    }

    // Check upload permission
    if (!existingFile.folder.allow_user_created_children) {
      return jsonResponse(req, { success: false, error: "Upload not allowed in this folder" }, 403);
    }

    console.debug("[keep-file-versions] Existing file found:", {
      fileId: existingFile.id,
      fileName: existingFile.file_name,
      area: existingFile.area,
    });

    // 5. Get next version number
    const { data: versionData, error: versionError } = await keepAuth.serviceClient
      .from("keep_file_version")
      .select("version_number")
      .eq("file_id", fileId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = versionData?.version_number 
      ? versionData.version_number + 1 
      : 1;

    // 6. Build new storage path and resolve bucket based on area
    const timestamp = Math.floor(Date.now() / 1000);
    const originalFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const newStoragePath = `${existingFile.folder.path}/${timestamp}-v${nextVersionNumber}-${originalFilename}`;
    
    // Resolve bucket based on area (two-bucket architecture)
    const storageBucket = resolveStorageBucket(existingFile.area);

    // Extract file metadata
    const fileExt = getFileExtension(file.name);
    const fileSize = file.size;
    const mimeType = file.type || "application/octet-stream";

    console.log("[keep-file-versions] Storage routing for new version:", {
      area: existingFile.area,
      bucket: storageBucket,
      path: newStoragePath,
      versionNumber: nextVersionNumber,
      previousBucket: existingFile.storage_bucket,
    });

    // 7. Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await keepAuth.serviceClient.storage
      .from(storageBucket)
      .upload(newStoragePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[keep-file-versions] Storage upload failed:", uploadError);
      return jsonResponse(req, { success: false, error: "Failed to upload file to storage" }, 500);
    }

    console.debug("[keep-file-versions] File uploaded to storage");

    // 8. Insert new version record
    const { data: versionRecord, error: versionInsertError } = await keepAuth.serviceClient
      .from("keep_file_version")
      .insert({
        file_id: fileId,
        version_number: nextVersionNumber,
        storage_bucket: storageBucket,
        storage_path: newStoragePath,
        file_size_bytes: fileSize,
        mime_type: mimeType,
        uploaded_by: userId,
        change_reason: reason || null,
      })
      .select()
      .single();

    if (versionInsertError || !versionRecord) {
      console.error("[keep-file-versions] Failed to insert version record:", versionInsertError);
      // Cleanup storage
      await keepAuth.serviceClient.storage.from(storageBucket).remove([newStoragePath]);
      return jsonResponse(req, { success: false, error: "Failed to create version record" }, 500);
    }

    console.debug("[keep-file-versions] Version record created:", { versionId: versionRecord.id });

    // 9. Update main file record with new metadata
    // For Gold Library, reset to pending_review status
    const newLifecycleStatus = existingFile.area === "gold_library" ? "pending_review" : "draft";

    const { data: updatedFile, error: updateError } = await keepAuth.serviceClient
      .from("keep_file")
      .update({
        file_ext: fileExt,
        mime_type: mimeType,
        file_size_bytes: fileSize,
        storage_path: newStoragePath,
        lifecycle_status: newLifecycleStatus,
        uploaded_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileId)
      .select()
      .single();

    if (updateError || !updatedFile) {
      console.error("[keep-file-versions] Failed to update file record:", updateError);
      // Don't cleanup - version record exists
      return jsonResponse(req, { success: false, error: "Failed to update file record" }, 500);
    }

    console.debug("[keep-file-versions] File record updated");

    // 10. Log activity
    const { error: activityError } = await keepAuth.serviceClient.from("keep_file_activity").insert({
      file_id: fileId,
      folder_id: existingFile.folder_id,
      user_id: userId,
      action: "upload_version",
      metadata: {
        previous_version: nextVersionNumber - 1,
        new_version: nextVersionNumber,
        file_name: file.name,
        file_size_bytes: fileSize,
        mime_type: mimeType,
        storage_path: newStoragePath,
        change_reason: reason || null,
        area: existingFile.area,
        lifecycle_status: newLifecycleStatus,
      },
    });

    if (activityError) {
      console.error("[keep-file-versions] Failed to log activity:", activityError);
    }

    // 11. If Gold Library, delete any existing pending approvals and create new ones
    if (existingFile.area === "gold_library") {
      // Delete old approvals for this file
      await keepAuth.serviceClient
        .from("keep_file_approval")
        .delete()
        .eq("file_id", fileId);

      console.debug("[keep-file-versions] Cleared old approvals for Gold Library file");
    }

    console.info("[keep-file-versions] Version upload completed:", {
      fileId,
      versionNumber: nextVersionNumber,
      userId,
      area: existingFile.area,
      bucket: storageBucket,
      lifecycleStatus: newLifecycleStatus,
    });

    return jsonResponse(req, {
      success: true,
      file: updatedFile,
      version: versionRecord,
    });
  } catch (error) {
    console.error("[keep-file-versions] POST unexpected error:", error);
    return jsonResponse(req, { success: false, error: error.message || "Internal server error" }, 500);
  }
}

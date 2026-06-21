// Edge Function: keep-move-file
// Moves pending Gold Library files between Gold folders during review.
// Uses BOH Pattern B manual auth (auth.getUser with bearer token)
// @ts-nocheck

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateKeepRequest } from "../_shared/keep-auth-helper.ts";
import { resolveStorageBucket } from "../_shared/keep-storage.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() || "";
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

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { success: false, error: "Invalid JSON body" }, 400);
    }

    const fileId = body?.fileId;
    const destinationFolderId = body?.destinationFolderId;

    if (!fileId || !destinationFolderId) {
      return jsonResponse(req, { success: false, error: "fileId and destinationFolderId are required" }, 400);
    }

    if (!uuidPattern.test(fileId) || !uuidPattern.test(destinationFolderId)) {
      return jsonResponse(req, { success: false, error: "Invalid id format" }, 400);
    }

    const { data: fileRecord, error: fileError } = await keepAuth.serviceClient
      .from("keep_file")
      .select("id, folder_id, file_name, file_ext, storage_bucket, storage_path, area, lifecycle_status, uploaded_by, is_current, is_active")
      .eq("id", fileId)
      .eq("is_current", true)
      .eq("is_active", true)
      .single();

    if (fileError || !fileRecord) {
      return jsonResponse(req, { success: false, error: "File not found" }, 404);
    }

    if (fileRecord.area !== "gold_library") {
      return jsonResponse(req, { success: false, error: "Only Gold Library files can be moved with this function" }, 400);
    }

    if (fileRecord.lifecycle_status !== "pending_review") {
      return jsonResponse(req, { success: false, error: "Only pending review files can be moved" }, 400);
    }

    const { data: destinationFolder, error: folderError } = await keepAuth.serviceClient
      .from("keep_folder")
      .select("id, path, area, is_active")
      .eq("id", destinationFolderId)
      .eq("area", "gold_library")
      .eq("is_active", true)
      .single();

    if (folderError || !destinationFolder) {
      return jsonResponse(req, { success: false, error: "Gold Library destination folder not found" }, 404);
    }

    if (fileRecord.folder_id === destinationFolder.id) {
      return jsonResponse(req, { success: true, file: fileRecord });
    }

    const { data: duplicateFile, error: duplicateError } = await keepAuth.serviceClient
      .from("keep_file")
      .select("id")
      .eq("folder_id", destinationFolder.id)
      .eq("file_name", fileRecord.file_name)
      .eq("file_ext", fileRecord.file_ext)
      .eq("area", "gold_library")
      .eq("is_active", true)
      .neq("id", fileRecord.id)
      .maybeSingle();

    if (duplicateError) {
      console.error("[keep-move-file] Duplicate check failed:", duplicateError);
      return jsonResponse(req, { success: false, error: "Failed to check destination" }, 500);
    }

    if (duplicateFile) {
      return jsonResponse(req, { success: false, error: "A file with this name already exists in the selected folder" }, 409);
    }

    const bucket = fileRecord.storage_bucket || resolveStorageBucket("gold_library");
    const currentObjectName = basename(fileRecord.storage_path);
    if (!currentObjectName || currentObjectName.includes("..")) {
      return jsonResponse(req, { success: false, error: "Invalid existing storage path" }, 400);
    }

    const targetPath = `${destinationFolder.path}/${currentObjectName}`;

    const { error: moveError } = await keepAuth.serviceClient.storage
      .from(bucket)
      .move(fileRecord.storage_path, targetPath);

    if (moveError) {
      console.error("[keep-move-file] Storage move failed:", moveError);
      return jsonResponse(req, { success: false, error: "Failed to move stored file" }, 500);
    }

    const { data: updatedFile, error: updateError } = await keepAuth.serviceClient
      .from("keep_file")
      .update({
        folder_id: destinationFolder.id,
        storage_path: targetPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileRecord.id)
      .select("id, folder_id, storage_bucket, storage_path")
      .single();

    if (updateError || !updatedFile) {
      console.error("[keep-move-file] Database update failed:", updateError);
      await keepAuth.serviceClient.storage.from(bucket).move(targetPath, fileRecord.storage_path);
      return jsonResponse(req, { success: false, error: "Failed to update file destination" }, 500);
    }

    await keepAuth.serviceClient
      .from("keep_file_version")
      .update({ storage_path: targetPath, storage_bucket: bucket })
      .eq("file_id", fileRecord.id)
      .eq("storage_path", fileRecord.storage_path);

    await keepAuth.serviceClient.from("keep_file_activity").insert({
      file_id: fileRecord.id,
      folder_id: destinationFolder.id,
      user_id: keepAuth.bohUser.id,
      action: "move_file",
      metadata: {
        from_folder_id: fileRecord.folder_id,
        to_folder_id: destinationFolder.id,
        from_path: fileRecord.storage_path,
        to_path: targetPath,
      },
    });

    return jsonResponse(req, { success: true, file: updatedFile });
  } catch (error) {
    console.error("[keep-move-file] Unexpected error:", error);
    return jsonResponse(req, { success: false, error: error.message || "Internal server error" }, 500);
  }
});

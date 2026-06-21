// Edge Function: keep-file-download
// Provides secure download access to Keep files from Supabase Storage
// Uses BOH Pattern B manual auth (auth.getUser with bearer token)
// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { validateJwt, resolveBohUser } from "../_shared/auth.ts";

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
      console.error("[keep-file-download] Missing Supabase environment variables");
      return jsonResponse(req, { success: false, error: "Server misconfiguration" }, 500);
    }

    // 2. Validate auth with publishable key
    console.log("[keep-file-download] Starting auth validation...");
    const { user: authUser, error: authError } = await validateJwt(req, supabaseUrl, publishableKey);
    
    if (authError || !authUser) {
      console.warn("[keep-file-download] Auth failed:", authError);
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    // 3. Create service client for database operations
    const serviceClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false },
    });

    // 4. Resolve BOH user
    const { bohUser, error: bohUserError } = await resolveBohUser(serviceClient, authUser.id);
    
    if (bohUserError || !bohUser) {
      console.warn("[keep-file-download] BOH user not found:", bohUserError);
      return jsonResponse(req, { success: false, error: "User not found" }, 404);
    }

    const userId = bohUser.id;
    console.log("[keep-file-download] Authenticated user:", { authUserId: authUser.id, bohUserId: userId });

    // 2. Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { success: false, error: "Invalid JSON body" }, 400);
    }

    const { fileId, action = "download" } = body;

    if (!fileId) {
      return jsonResponse(req, { success: false, error: "fileId is required" }, 400);
    }

    // Validate file_id format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
      return jsonResponse(req, { success: false, error: "Invalid file_id format" }, 400);
    }

    // 5. Fetch file record with folder info for permissions
    const { data: fileRecord, error: fileError } = await serviceClient
      .from("keep_file")
      .select(`
        id,
        folder_id,
        file_name,
        file_ext,
        mime_type,
        file_size_bytes,
        storage_bucket,
        storage_path,
        area,
        lifecycle_status,
        is_active,
        uploaded_by,
        folder:keep_folder!inner(area, is_active, allow_user_created_children)
      `)
      .eq("id", fileId)
      .eq("is_current", true)
      .single();

    if (fileError || !fileRecord) {
      console.error("[keep-file-download] File not found:", { fileId, error: fileError });
      return jsonResponse(req, { success: false, error: "File not found" }, 404);
    }

    // Check file is active
    if (!fileRecord.is_active) {
      console.warn("[keep-file-download] File is inactive:", { fileId });
      return jsonResponse(req, { success: false, error: "File is inactive" }, 400);
    }

    // For Gold Library, check lifecycle status - only allow download if approved
    if (fileRecord.area === "gold_library" && fileRecord.lifecycle_status !== "approved") {
      console.warn("[keep-file-download] Gold Library file not approved:", { 
        fileId, 
        lifecycleStatus: fileRecord.lifecycle_status 
      });
      return jsonResponse(
        req, 
        { success: false, error: "File is pending approval and cannot be downloaded" }, 
        403
      );
    }

    console.debug("[keep-file-download] File record found:", {
      fileId,
      fileName: fileRecord.file_name,
      storageBucket: fileRecord.storage_bucket,
      storagePath: fileRecord.storage_path,
    });

    const downloadFileName = `${fileRecord.file_name}.${fileRecord.file_ext}`;
    const signedUrlOptions = action === "download"
      ? { download: downloadFileName }
      : undefined;

    // 6. Generate signed URL for secure access (expires in 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from(fileRecord.storage_bucket)
      .createSignedUrl(fileRecord.storage_path, 3600, signedUrlOptions);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[keep-file-download] Failed to create signed URL:", {
        error: signedUrlError,
        bucket: fileRecord.storage_bucket,
        path: fileRecord.storage_path,
      });
      return jsonResponse(req, { success: false, error: "Failed to generate download URL" }, 500);
    }

    // 7. Log activity
    const { error: activityError } = await serviceClient.from("keep_file_activity").insert({
      file_id: fileId,
      folder_id: fileRecord.folder_id,
      user_id: userId,
      action: action, // "download" or "open"
      metadata: {
        file_name: downloadFileName,
        file_size_bytes: fileRecord.file_size_bytes,
        mime_type: fileRecord.mime_type,
        area: fileRecord.area,
        storage_path: fileRecord.storage_path,
        lifecycle_status: fileRecord.lifecycle_status,
      },
    });

    if (activityError) {
      console.error("[keep-file-download] Failed to log activity:", {
        code: activityError.code,
        message: activityError.message,
      });
      // Continue - activity logging is secondary
    } else {
      console.debug("[keep-file-download] Activity logged");
    }

    console.info("[keep-file-download] Success:", {
      fileId,
      fileName: fileRecord.file_name,
      userId,
      action,
    });

    // 8. Return signed URL
    return jsonResponse(req, {
      success: true,
      downloadUrl: signedUrlData.signedUrl,
      file: {
        id: fileRecord.id,
        fileName: downloadFileName,
        mimeType: fileRecord.mime_type,
        sizeBytes: fileRecord.file_size_bytes,
        area: fileRecord.area,
        lifecycleStatus: fileRecord.lifecycle_status,
      },
    });
  } catch (error) {
    console.error("[keep-file-download] Unexpected error:", {
      message: error.message,
      stack: error.stack,
    });
    return jsonResponse(req, { success: false, error: error.message || "Internal server error" }, 500);
  }
});

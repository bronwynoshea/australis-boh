// Edge Function: keep-delete-file
// Deletes a file from Supabase Storage and database
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
      console.error("[keep-delete-file] Missing Supabase environment variables");
      return jsonResponse(req, { success: false, error: "Server misconfiguration" }, 500);
    }

    // 2. Validate auth
    const { user: authUser, error: authError } = await validateJwt(req, supabaseUrl, publishableKey);
    if (authError || !authUser) {
      console.warn("[keep-delete-file] Auth failed:", authError);
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    // 3. Create service client
    const serviceClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false },
    });

    // 4. Resolve BOH user
    const { bohUser, error: bohUserError } = await resolveBohUser(serviceClient, authUser.id);
    if (bohUserError || !bohUser) {
      console.warn("[keep-delete-file] BOH user not found:", bohUserError);
      return jsonResponse(req, { success: false, error: "User not found" }, 404);
    }

    const userId = bohUser.id;
    const currentTenantId = bohUser.tenant_id;
    if (!currentTenantId) {
      console.warn("[keep-delete-file] BOH user missing tenant_id", { userId });
      return jsonResponse(req, { success: false, error: "Tenant context unavailable" }, 403);
    }

    // 5. Parse request body
    const body = await req.json();
    const { fileId } = body;

    if (!fileId) {
      return jsonResponse(req, { success: false, error: "fileId is required" }, 400);
    }

    // Validate file_id format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
      return jsonResponse(req, { success: false, error: "Invalid file_id format" }, 400);
    }

    // 6. Fetch file record
    const { data: fileRecord, error: fileError } = await serviceClient
      .from("keep_file")
      .select("id, folder_id, tenant_id, storage_bucket, storage_path, file_name, uploaded_by, area, lifecycle_status")
      .eq("id", fileId)
      .eq("tenant_id", currentTenantId)
      .eq("is_current", true)
      .single();

    if (fileError || !fileRecord) {
      console.error("[keep-delete-file] File not found:", { fileId, error: fileError });
      return jsonResponse(req, { success: false, error: "File not found" }, 404);
    }

    // 7. Check permissions - only uploader or super admin can delete
    const { data: roleData } = await serviceClient
      .from("boh_user_role")
      .select("role:boh_role(code)")
      .eq("user_id", userId)
      .eq("app_context", "boh");
    const isSuperAdmin = roleData?.some((r) => r.role?.code === "super_admin") ?? false;

    if (fileRecord.uploaded_by !== userId && !isSuperAdmin) {
      console.warn("[keep-delete-file] Permission denied:", { fileId, userId, uploadedBy: fileRecord.uploaded_by });
      return jsonResponse(req, { success: false, error: "You can only delete files you uploaded" }, 403);
    }

    if (fileRecord.area === "gold_library" && fileRecord.lifecycle_status === "approved" && !isSuperAdmin) {
      console.warn("[keep-delete-file] Approved Gold Library delete denied:", { fileId, userId });
      return jsonResponse(req, { success: false, error: "Only super admins can delete approved Gold Library files" }, 403);
    }

    // 8. Soft delete - mark as inactive instead of hard delete
    const { error: updateError } = await serviceClient
      .from("keep_file")
      .update({ 
        is_active: false,
        is_current: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", fileId)
      .eq("tenant_id", currentTenantId);

    if (updateError) {
      console.error("[keep-delete-file] Failed to mark file as deleted:", updateError);
      return jsonResponse(req, { success: false, error: "Failed to delete file" }, 500);
    }

    // 9. Log activity
    await serviceClient.from("keep_file_activity").insert({
      file_id: fileId,
      folder_id: fileRecord.folder_id,
      user_id: userId,
      action: "delete_file",
      metadata: {
        file_name: fileRecord.file_name,
        storage_path: fileRecord.storage_path,
        deleted_by_permission: isSuperAdmin ? "super_admin" : "owner"
      },
    });

    console.info("[keep-delete-file] File deleted successfully:", { fileId, userId });

    return jsonResponse(req, { success: true, message: "File deleted successfully" });
  } catch (error) {
    console.error("[keep-delete-file] Unexpected error:", error);
    return jsonResponse(req, { success: false, error: error.message || "Internal server error" }, 500);
  }
});

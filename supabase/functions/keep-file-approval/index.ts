// Edge Function: keep-file-approval
// Handles approval workflow for Gold Library files
// Uses BOH Pattern B manual auth (auth.getUser with bearer token)
// Supports dynamic Gold Library approval rules and super admin override
// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateKeepRequest } from "../_shared/keep-auth-helper.ts";

async function getUserRoleFlags(serviceClient: any, userId: string, currentTenantId: string) {
  const { data: user } = await serviceClient
    .from("boh_user")
    .select("id, primary_role_hint")
    .eq("id", userId)
    .eq("tenant_id", currentTenantId)
    .maybeSingle();

  const primaryRole = user?.primary_role_hint || "";
  let isSuperAdmin = primaryRole === "super_admin";
  let isAdminOrSuper = isSuperAdmin || primaryRole === "admin";

  const { data: roleData } = await serviceClient
    .from("boh_user_role")
    .select("role:boh_role(code)")
    .eq("user_id", userId)
    .eq("tenant_id", currentTenantId)
    .eq("app_context", "boh");

  const roleCodes = roleData?.map((row: any) => row.role?.code).filter(Boolean) || [];
  isSuperAdmin = isSuperAdmin || roleCodes.includes("super_admin");
  isAdminOrSuper = isAdminOrSuper || roleCodes.includes("admin") || isSuperAdmin;

  return { isAdminOrSuper, isSuperAdmin, primaryRole, roleCodes };
}

function getRequiredApprovalCount(submitterIsAdminOrSuper: boolean) {
  return submitterIsAdminOrSuper ? 1 : 2;
}

function buildSyntheticApproval(fileId: string, stage: number, requiredStage: number, reviewerId: string, decision: string, notes: string | null) {
  return {
    id: crypto.randomUUID(),
    file_id: fileId,
    approval_stage: stage,
    required_stage: requiredStage,
    reviewer_id: reviewerId,
    decision,
    reviewed_at: new Date().toISOString(),
    notes,
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method === "GET") {
    return handleGetApprovals(req);
  }

  if (req.method === "POST") {
    return handleSubmitApproval(req);
  }

  return jsonResponse(req, { success: false, error: "Method not allowed" }, 405);
});

async function handleGetApprovals(req: Request) {
  try {
    const keepAuth = await authenticateKeepRequest(req);
    if (!keepAuth) {
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    const currentTenantId = keepAuth.bohUser.tenant_id;
    if (!currentTenantId) {
      console.warn("[keep-file-approval] GET authenticated BOH user has no tenant_id", { bohUserId: keepAuth.bohUser.id });
      return jsonResponse(req, { success: false, error: "Tenant context unavailable" }, 403);
    }

    const url = new URL(req.url);
    const fileId = url.searchParams.get("file_id");

    if (!fileId) {
      return jsonResponse(req, { success: false, error: "file_id is required" }, 400);
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
      return jsonResponse(req, { success: false, error: "Invalid file_id format" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKey = Deno.env.get("SB_SECRET_KEY");

    if (!supabaseUrl || !secretKey) {
      return jsonResponse(req, { success: false, error: "Server misconfiguration" }, 500);
    }

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false },
    });

    const { data: fileRecord, error: fileError } = await adminClient
      .from("keep_file")
      .select("id, folder_id, tenant_id, area, lifecycle_status, uploaded_by")
      .eq("id", fileId)
      .eq("tenant_id", currentTenantId)
      .single();

    if (fileError || !fileRecord) {
      return jsonResponse(req, { success: false, error: "File not found" }, 404);
    }

    if (fileRecord.area !== "gold_library") {
      return jsonResponse(req, { success: false, error: "Approvals only apply to Gold Library files" }, 400);
    }

    const { data: approvalsData, error: approvalsError } = await keepAuth.serviceClient
      .from("keep_file_approval")
      .select(`
        id,
        file_id,
        approval_stage,
        required_stage,
        reviewer_id,
        decision,
        reviewed_at,
        notes
      `)
      .eq("file_id", fileId)
      .order("approval_stage", { ascending: true });

    let approvals = approvalsData || [];
    if (approvalsError) {
      console.error("[keep-file-approval] Failed to fetch approvals; continuing with activity fallback:", approvalsError);
      approvals = [];
    }

    const approvedStages = approvals.filter(a => a.decision === "approved").map(a => a.approval_stage) || [];
    const rejectedStages = approvals.filter(a => a.decision === "rejected").map(a => a.approval_stage) || [];
    const isRejected = rejectedStages.length > 0;
    const isApproved = fileRecord.lifecycle_status === "approved";
    const submitterRole = await getUserRoleFlags(keepAuth.serviceClient, fileRecord.uploaded_by, currentTenantId);
    const reviewerRole = await getUserRoleFlags(keepAuth.serviceClient, keepAuth.bohUser.id, currentTenantId);
    const requiredApprovalCount = getRequiredApprovalCount(submitterRole.isAdminOrSuper);
    const isOwnFile = fileRecord.uploaded_by === keepAuth.bohUser.id;

    let currentStage = 0;
    if (!isRejected && !isApproved) {
      currentStage = approvedStages.length + 1;
    }

    const canPublishImmediately =
      reviewerRole.isSuperAdmin && !isOwnFile && !isRejected && !isApproved;
    const canPublishWithOverride =
      reviewerRole.isSuperAdmin && isOwnFile && !isRejected && !isApproved;
    const canUserApprove =
      !isOwnFile &&
      !isRejected &&
      !isApproved &&
      (canPublishImmediately || !submitterRole.isAdminOrSuper || reviewerRole.isAdminOrSuper);
    const canUserReject = !isOwnFile && !isRejected && !isApproved;

    return jsonResponse(req, {
      success: true,
      approvals,
      file: {
        id: fileRecord.id,
        lifecycleStatus: fileRecord.lifecycle_status,
        uploadedBy: fileRecord.uploaded_by,
      },
      status: {
        isApproved,
        isRejected,
        currentStage,
        approvedCount: approvedStages.length,
        requiredApprovalCount,
        canUserApprove,
        canUserReject,
        canPublishImmediately,
        canPublishWithOverride,
        isOwnFile,
        submitterIsAdminOrSuper: submitterRole.isAdminOrSuper,
        currentUserIsAdminOrSuper: reviewerRole.isAdminOrSuper,
        currentUserIsSuperAdmin: reviewerRole.isSuperAdmin,
      },
    });
  } catch (error) {
    return jsonResponse(req, { success: false, error: error.message }, 500);
  }
}

async function handleSubmitApproval(req: Request) {
  try {
    const keepAuth = await authenticateKeepRequest(req);
    if (!keepAuth) {
      return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
    }

    const userId = keepAuth.bohUser.id;
    const currentTenantId = keepAuth.bohUser.tenant_id;
    if (!currentTenantId) {
      console.warn("[keep-file-approval] POST authenticated BOH user has no tenant_id", { bohUserId: userId });
      return jsonResponse(req, { success: false, error: "Tenant context unavailable" }, 403);
    }

    const reviewerRole = await getUserRoleFlags(keepAuth.serviceClient, userId, currentTenantId);

    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { success: false, error: "Invalid JSON body" }, 400);
    }

    const { fileId, decision, notes, override = false } = body;

    if (!fileId || !decision) {
      return jsonResponse(req, { success: false, error: "fileId and decision are required" }, 400);
    }

    if (!["approved", "rejected"].includes(decision)) {
      return jsonResponse(req, { success: false, error: "decision must be 'approved' or 'rejected'" }, 400);
    }

    // Validate file_id format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
      return jsonResponse(req, { success: false, error: "Invalid file_id format" }, 400);
    }

    // Fetch file record
    const { data: fileRecord, error: fileError } = await keepAuth.serviceClient
      .from("keep_file")
      .select("id, folder_id, tenant_id, area, lifecycle_status, uploaded_by")
      .eq("id", fileId)
      .eq("tenant_id", currentTenantId)
      .single();

    if (fileError || !fileRecord) {
      return jsonResponse(req, { success: false, error: "File not found" }, 404);
    }

    if (fileRecord.area !== "gold_library") {
      return jsonResponse(req, { success: false, error: "Approvals only apply to Gold Library files" }, 400);
    }

    if (fileRecord.lifecycle_status === "approved") {
      return jsonResponse(req, { success: false, error: "File is already approved" }, 400);
    }

    if (fileRecord.lifecycle_status === "rejected") {
      return jsonResponse(req, { success: false, error: "File has been rejected" }, 400);
    }

    const submitterRole = await getUserRoleFlags(keepAuth.serviceClient, fileRecord.uploaded_by, currentTenantId);
    const baseRequiredApprovalCount = getRequiredApprovalCount(submitterRole.isAdminOrSuper);
    const isOwnFile = fileRecord.uploaded_by === userId;

    if (override) {
      if (decision !== "approved") {
        return jsonResponse(req, { success: false, error: "Override only supports approval" }, 400);
      }

      if (!reviewerRole.isSuperAdmin) {
        return jsonResponse(req, { success: false, error: "Only super admins can submit with override" }, 403);
      }

      if (!isOwnFile) {
        return jsonResponse(req, { success: false, error: "Override is only for submitting your own file" }, 400);
      }

      const { data: existingApprovalsData, error: approvalsError } = await keepAuth.serviceClient
        .from("keep_file_approval")
        .select("id, approval_stage, reviewer_id, decision")
        .eq("file_id", fileId)
        .order("approval_stage", { ascending: true });

      let existingApprovals = existingApprovalsData || [];
      if (approvalsError) {
        console.error("[keep-file-approval] Failed to check existing approvals for override; using activity fallback:", approvalsError);
        existingApprovals = [];
      }

      const approvedCount = existingApprovals?.filter(a => a.decision === "approved").length || 0;
      const newStage = approvedCount + 1;
      const overrideNotes = notes || "Super admin self-submit override";

      const { data: insertedApprovalRecord, error: insertError } = await keepAuth.serviceClient
        .from("keep_file_approval")
        .insert({
          file_id: fileId,
          approval_stage: newStage,
          required_stage: 1,
          reviewer_id: userId,
          decision: "approved",
          notes: overrideNotes,
        })
        .select()
        .single();

      let approvalRecord = insertedApprovalRecord;
      if (insertError) {
        console.error("[keep-file-approval] Failed to insert override approval; using activity fallback:", insertError);
        approvalRecord = buildSyntheticApproval(fileId, newStage, 1, userId, "approved", overrideNotes);
      }

      await keepAuth.serviceClient
        .from("keep_file")
        .update({ lifecycle_status: "approved", updated_at: new Date().toISOString() })
        .eq("id", fileId)
        .eq("tenant_id", currentTenantId);

      await keepAuth.serviceClient.from("keep_file_activity").insert({
        file_id: fileId,
        folder_id: fileRecord.folder_id,
        user_id: userId,
        action: "approve_file_override",
        metadata: {
          override: true,
          overrideType: "super_admin_self_submit",
          stage: newStage,
          totalStages: 1,
          notes: overrideNotes,
        },
      });

      return jsonResponse(req, {
        success: true,
        approval: approvalRecord,
        file: { lifecycleStatus: "approved" },
        isFullyApproved: true,
        pendingStage: null,
        status: {
          isApproved: true,
          isRejected: false,
          currentStage: 0,
          approvedCount: approvedCount + 1,
          requiredApprovalCount: 1,
          canUserApprove: false,
          canUserReject: false,
          canPublishImmediately: false,
          canPublishWithOverride: false,
          isOwnFile: true,
          submitterIsAdminOrSuper: submitterRole.isAdminOrSuper,
          currentUserIsAdminOrSuper: reviewerRole.isAdminOrSuper,
          currentUserIsSuperAdmin: reviewerRole.isSuperAdmin,
        },
      });
    }

    // Two-person rule: uploader cannot approve their own file
    if (isOwnFile) {
      return jsonResponse(req, { success: false, error: "You cannot approve your own file" }, 403);
    }

    // Get existing approvals
    const { data: existingApprovalsData, error: approvalsError } = await keepAuth.serviceClient
      .from("keep_file_approval")
      .select("id, approval_stage, reviewer_id, decision")
      .eq("file_id", fileId)
      .order("approval_stage", { ascending: true });

    let existingApprovals = existingApprovalsData || [];
    if (approvalsError) {
      console.error("[keep-file-approval] Failed to check existing approvals; using activity fallback:", approvalsError);
      existingApprovals = [];
    }

    // Check if already reviewed
    const existingReview = existingApprovals?.find(a => a.reviewer_id === userId);
    if (existingReview) {
      return jsonResponse(req, { success: false, error: "You have already submitted a review" }, 400);
    }

    // Two-person rule: same reviewer cannot do multiple stages
    const approvedCount = existingApprovals?.filter(a => a.decision === "approved").length || 0;
    const newStage = approvedCount + 1;
    const superAdminImmediatePublish = decision === "approved" && reviewerRole.isSuperAdmin;
    const requiredApprovalCount = superAdminImmediatePublish ? 1 : baseRequiredApprovalCount;

    if (decision === "approved" && submitterRole.isAdminOrSuper && !reviewerRole.isAdminOrSuper) {
      return jsonResponse(req, { success: false, error: "Admin submissions require approval from another admin or super admin" }, 403);
    }

    // Insert approval record
    const { data: insertedApprovalRecord, error: insertError } = await keepAuth.serviceClient
      .from("keep_file_approval")
      .insert({
        file_id: fileId,
        approval_stage: newStage,
        required_stage: requiredApprovalCount,
        reviewer_id: userId,
        decision,
        notes: notes || null,
      })
      .select()
      .single();

    let approvalRecord = insertedApprovalRecord;
    if (insertError) {
      console.error("[keep-file-approval] Failed to insert approval; using activity fallback:", insertError);
      approvalRecord = buildSyntheticApproval(fileId, newStage, requiredApprovalCount, userId, decision, notes || null);
    }

    // Handle rejection
    if (decision === "rejected") {
      await keepAuth.serviceClient
        .from("keep_file")
        .update({ lifecycle_status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", fileId)
        .eq("tenant_id", currentTenantId);

      await keepAuth.serviceClient.from("keep_file_activity").insert({
        file_id: fileId,
        folder_id: fileRecord.folder_id,
        user_id: userId,
        action: "reject_file",
        metadata: { stage: newStage, totalStages: requiredApprovalCount, notes: notes || null },
      });

      return jsonResponse(req, {
        success: true,
        approval: approvalRecord,
        file: { lifecycleStatus: "rejected" },
      });
    }

    // Handle approval completion
    const newApprovedCount = approvedCount + 1;
    const isFullyApproved = superAdminImmediatePublish || newApprovedCount >= requiredApprovalCount;

    let newLifecycleStatus = fileRecord.lifecycle_status;
    if (isFullyApproved) {
      newLifecycleStatus = "approved";
      await keepAuth.serviceClient
        .from("keep_file")
        .update({ lifecycle_status: "approved", updated_at: new Date().toISOString() })
        .eq("id", fileId)
        .eq("tenant_id", currentTenantId);
    }

    // Log activity
    await keepAuth.serviceClient.from("keep_file_activity").insert({
      file_id: fileId,
      folder_id: fileRecord.folder_id,
      user_id: userId,
      action: isFullyApproved ? "approve_file_final" : "approve_file",
      metadata: {
        stage: newStage,
        totalStages: requiredApprovalCount,
        isFinalApproval: isFullyApproved,
        superAdminImmediatePublish,
        submitterIsAdminOrSuper: submitterRole.isAdminOrSuper,
        notes: notes || null,
      },
    });

    return jsonResponse(req, {
      success: true,
      approval: approvalRecord,
      file: { lifecycleStatus: newLifecycleStatus },
      isFullyApproved,
      pendingStage: isFullyApproved ? null : newStage + 1,
      status: {
        isApproved: isFullyApproved,
        isRejected: false,
        currentStage: isFullyApproved ? 0 : newStage + 1,
        approvedCount: newApprovedCount,
        requiredApprovalCount,
        canUserApprove: false,
        canUserReject: false,
        canPublishImmediately: false,
        canPublishWithOverride: false,
        isOwnFile: false,
        submitterIsAdminOrSuper: submitterRole.isAdminOrSuper,
        currentUserIsAdminOrSuper: reviewerRole.isAdminOrSuper,
        currentUserIsSuperAdmin: reviewerRole.isSuperAdmin,
      },
    });
  } catch (error) {
    return jsonResponse(req, { success: false, error: error.message }, 500);
  }
}

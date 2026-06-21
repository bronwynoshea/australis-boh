// Edge Function: forge-walkthrough-status
// Lists walkthrough runs and returns signed private artifact URLs.
// @ts-nocheck

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

async function userCanViewWalkthroughs(serviceClient: any, bohUser: any, isSuperAdmin: boolean) {
  if (isSuperAdmin || bohUser?.primary_role_hint === "admin" || bohUser?.primary_role_hint === "super_admin") {
    return true;
  }

  const { data: roleData } = await serviceClient
    .from("boh_user_role")
    .select("role:boh_role(code)")
    .eq("user_id", bohUser.id)
    .eq("app_context", "boh");

  return roleData?.some((row: any) => ["admin", "super_admin"].includes(row.role?.code)) ?? false;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return jsonResponse(req, { success: false, error: "Method not allowed" }, 405);
  }

  const auth = await requireUser(req);
  if (!auth.success) {
    return jsonResponse(req, { success: false, error: auth.error }, auth.status);
  }

  if (!auth.context.bohUser) {
    return jsonResponse(req, { success: false, error: "BOH user not found" }, 401);
  }

  const allowed = await userCanViewWalkthroughs(
    auth.serviceClient,
    auth.context.bohUser,
    auth.context.isSuperAdmin,
  );

  if (!allowed) {
    return jsonResponse(req, { success: false, error: "Forbidden - admin access required" }, 403);
  }

  const url = new URL(req.url);
  const runId = url.searchParams.get("run_id");

  let query = auth.serviceClient
    .from("forge_walkthrough_run")
    .select(`
      id,
      status,
      environment,
      capture_mode,
      render_mode,
      voiceover_mode,
      step_plan,
      transcript_text,
      error_message,
      started_at,
      completed_at,
      created_at,
      assetTemplate:forge_walkthrough_asset_template(id, slug, name),
      artifacts:forge_walkthrough_artifact(
        id,
        artifact_type,
        storage_bucket,
        storage_path,
        mime_type,
        file_size_bytes,
        created_at
      )
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  if (runId) {
    query = query.eq("id", runId);
  }

  const { data: runs, error } = await query;

  if (error) {
    console.error("[forge-walkthrough-status] Failed to fetch runs:", error);
    return jsonResponse(req, { success: false, error: "Failed to fetch walkthrough runs" }, 500);
  }

  const signedRuns = await Promise.all((runs || []).map(async (run: any) => {
    const artifacts = await Promise.all((run.artifacts || []).map(async (artifact: any) => {
      const { data: signedUrlData, error: signedUrlError } = await auth.serviceClient.storage
        .from(artifact.storage_bucket)
        .createSignedUrl(artifact.storage_path, 60 * 60);

      if (signedUrlError) {
        console.error("[forge-walkthrough-status] Failed to create signed URL:", signedUrlError);
      }

      return {
        artifact_type: artifact.artifact_type,
        mime_type: artifact.mime_type,
        file_size_bytes: artifact.file_size_bytes,
        created_at: artifact.created_at,
        signedUrl: signedUrlData?.signedUrl || null,
      };
    }));

    const videoArtifact = artifacts.find((artifact: any) => artifact.artifact_type === "video") || null;

    return {
      id: run.id,
      status: run.status,
      environment: run.environment,
      capture_mode: run.capture_mode,
      render_mode: run.render_mode,
      voiceover_mode: run.voiceover_mode,
      step_plan: run.step_plan,
      transcript_text: run.transcript_text,
      error_message: run.error_message,
      started_at: run.started_at,
      completed_at: run.completed_at,
      created_at: run.created_at,
      assetTemplate: run.assetTemplate,
      artifacts,
      videoUrl: videoArtifact?.signedUrl || null,
    };
  }));

  return jsonResponse(req, { success: true, runs: signedRuns });
});

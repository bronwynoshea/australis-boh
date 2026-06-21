// Edge Function: forge-walkthrough-worker
// Token-gated worker API for dev/staging walkthrough recording operations.
// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const bucketName = "forge-walkthrough-artifacts";
const approvedAssetTemplates = new Set(["talent-walkthrough-mobile", "talent-onboarding-mobile"]);
const artifactTypes = new Set(["video", "screenshot", "trace", "manifest"]);

function getEnv() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("SB_SECRET_KEY");
  const runnerToken = Deno.env.get("WALKTHROUGH_RUNNER_TOKEN");

  if (!supabaseUrl || !secretKey || !runnerToken) {
    console.error("[forge-walkthrough-worker] Missing required environment variables");
    return null;
  }

  return { supabaseUrl, secretKey, runnerToken };
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return req.headers.get("x-walkthrough-runner-token") || "";
}

function safeFileName(value: string, fallback: string) {
  const cleaned = value
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);

  return cleaned || fallback;
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function claimRun(serviceClient: any) {
  const { data: pendingRuns, error: loadError } = await serviceClient
    .from("forge_walkthrough_run")
    .select("id, asset_template_id, capture_mode, render_mode, voiceover_mode, step_plan, transcript_text, assetTemplate:forge_walkthrough_asset_template(id, slug, name)")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (loadError) {
    console.error("[forge-walkthrough-worker] Failed to load queued runs:", loadError);
    return { success: false, error: "Failed to load queued runs", status: 500 };
  }

  const run = pendingRuns?.[0];
  if (!run) {
    return { success: true, run: null };
  }

  if (!approvedAssetTemplates.has(run.assetTemplate?.slug)) {
    return { success: false, error: "Queued template is not approved", status: 400 };
  }

  const { data: claimedRun, error: claimError } = await serviceClient
    .from("forge_walkthrough_run")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", run.id)
    .eq("status", "queued")
    .select("id, asset_template_id, capture_mode, render_mode, voiceover_mode, step_plan, transcript_text, assetTemplate:forge_walkthrough_asset_template(id, slug, name)")
    .maybeSingle();

  if (claimError) {
    console.error("[forge-walkthrough-worker] Failed to claim run:", claimError);
    return { success: false, error: "Failed to claim run", status: 500 };
  }

  return { success: true, run: claimedRun };
}

async function uploadArtifact(serviceClient: any, body: any) {
  const runId = body?.runId;
  const artifactType = body?.artifactType;
  const mimeType = body?.mimeType || "application/octet-stream";
  const contentBase64 = body?.contentBase64;

  if (!runId || !artifactTypes.has(artifactType) || !contentBase64) {
    return { success: false, error: "runId, artifactType, and contentBase64 are required", status: 400 };
  }

  const { data: run, error: runError } = await serviceClient
    .from("forge_walkthrough_run")
    .select("id, status")
    .eq("id", runId)
    .maybeSingle();

  if (runError || !run) {
    return { success: false, error: "Run not found", status: 404 };
  }

  if (run.status !== "running") {
    return { success: false, error: "Run is not running", status: 409 };
  }

  const fallbackName = artifactType === "video"
    ? "video.webm"
    : artifactType === "trace"
      ? "trace.zip"
      : artifactType === "manifest"
        ? "manifest.json"
        : "screenshot.png";
  const fileName = safeFileName(body?.fileName || fallbackName, fallbackName);
  const storagePath = `walkthrough-runs/${runId}/${artifactType}/${fileName}`;
  const fileBytes = decodeBase64(contentBase64);

  const { error: uploadError } = await serviceClient.storage
    .from(bucketName)
    .upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.error("[forge-walkthrough-worker] Failed to upload artifact:", uploadError);
    return { success: false, error: "Failed to upload artifact", status: 500 };
  }

  const { error: insertError } = await serviceClient
    .from("forge_walkthrough_artifact")
    .insert({
      run_id: runId,
      artifact_type: artifactType,
      storage_bucket: bucketName,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size_bytes: fileBytes.byteLength,
    });

  if (insertError) {
    console.error("[forge-walkthrough-worker] Failed to register artifact:", insertError);
    return { success: false, error: "Failed to register artifact", status: 500 };
  }

  return { success: true };
}

async function completeRun(serviceClient: any, body: any) {
  const runId = body?.runId;
  if (!runId) {
    return { success: false, error: "runId is required", status: 400 };
  }

  const { data: videoArtifact } = await serviceClient
    .from("forge_walkthrough_artifact")
    .select("storage_bucket, storage_path")
    .eq("run_id", runId)
    .eq("artifact_type", "video")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await serviceClient
    .from("forge_walkthrough_run")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      video_storage_bucket: videoArtifact?.storage_bucket || null,
      video_storage_path: videoArtifact?.storage_path || null,
    })
    .eq("id", runId)
    .eq("status", "running");

  if (error) {
    console.error("[forge-walkthrough-worker] Failed to complete run:", error);
    return { success: false, error: "Failed to complete run", status: 500 };
  }

  return { success: true };
}

async function failRun(serviceClient: any, body: any) {
  const runId = body?.runId;
  if (!runId) {
    return { success: false, error: "runId is required", status: 400 };
  }

  const errorMessage = typeof body?.errorMessage === "string"
    ? body.errorMessage.slice(0, 1000)
    : "Walkthrough worker failed";

  const { error } = await serviceClient
    .from("forge_walkthrough_run")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", runId);

  if (error) {
    console.error("[forge-walkthrough-worker] Failed to mark run failed:", error);
    return { success: false, error: "Failed to mark run failed", status: 500 };
  }

  return { success: true };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Method not allowed" }, 405);
  }

  const env = getEnv();
  if (!env) {
    return jsonResponse(req, { success: false, error: "Walkthrough worker is not configured" }, 500);
  }

  if (getBearerToken(req) !== env.runnerToken) {
    return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const serviceClient = createClient(env.supabaseUrl, env.secretKey, {
    auth: { persistSession: false },
  });

  let result;
  if (action === "claim") {
    result = await claimRun(serviceClient);
  } else if (action === "upload-artifact") {
    result = await uploadArtifact(serviceClient, body);
  } else if (action === "complete") {
    result = await completeRun(serviceClient, body);
  } else if (action === "fail") {
    result = await failRun(serviceClient, body);
  } else {
    result = { success: false, error: "Unknown worker action", status: 400 };
  }

  return jsonResponse(req, result, result.status || (result.success ? 200 : 400));
});

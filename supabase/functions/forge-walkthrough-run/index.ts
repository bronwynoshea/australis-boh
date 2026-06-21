// Edge Function: forge-walkthrough-run
// Creates dev/staging walkthrough recording runs for the backend Playwright worker.
// @ts-nocheck

import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

const approvedAssetTemplates = new Set(["talent-walkthrough-mobile", "talent-onboarding-mobile", "talent-onboarding-desktop"]);
const captureModes = new Set(["screenshot_scenes", "screen_recording"]);
const renderModes = new Set(["remotion", "raw_recording"]);
const voiceoverModes = new Set(["none", "transcript", "voiceover_ready"]);

async function userCanManageWalkthroughs(serviceClient: any, bohUser: any, isSuperAdmin: boolean) {
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

  const auth = await requireUser(req);
  if (!auth.success) {
    return jsonResponse(req, { success: false, error: auth.error }, auth.status);
  }

  if (!auth.context.bohUser) {
    return jsonResponse(req, { success: false, error: "BOH user not found" }, 401);
  }

  const allowed = await userCanManageWalkthroughs(
    auth.serviceClient,
    auth.context.bohUser,
    auth.context.isSuperAdmin,
  );

  if (!allowed) {
    return jsonResponse(req, { success: false, error: "Forbidden - admin access required" }, 403);
  }

  if (req.method === "GET") {
    const { data: assetTemplates, error: assetTemplatesError } = await auth.serviceClient
      .from("forge_walkthrough_asset_template")
      .select("id, slug, name, description, app_key")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (assetTemplatesError) {
      console.error("[forge-walkthrough-run] Failed to fetch asset templates:", assetTemplatesError);
      return jsonResponse(req, { success: false, error: "Failed to fetch asset templates" }, 500);
    }

    const { data: apps, error: appsError } = await auth.serviceClient
      .from("boh_app")
      .select("id, slug, name, route")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (appsError) {
      console.error("[forge-walkthrough-run] Failed to fetch apps:", appsError);
      return jsonResponse(req, { success: false, error: "Failed to fetch apps" }, 500);
    }

    const { data: modules, error: modulesError } = await auth.serviceClient
      .from("boh_app_module")
      .select(`
        id,
        app_id,
        key,
        label,
        route,
        sort_order
      `)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (modulesError) {
      console.error("[forge-walkthrough-run] Failed to fetch app modules:", modulesError);
      return jsonResponse(req, { success: false, error: "Failed to fetch app modules" }, 500);
    }

    return jsonResponse(req, {
      success: true,
      assetTemplates: assetTemplates || [],
      walkthroughTypes: assetTemplates || [],
      apps: apps || [],
      modules: modules || [],
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Method not allowed" }, 405);
  }

  const body = await req.json().catch(() => ({}));
  const assetTemplateSlug = body?.assetTemplateSlug;
  const approvedStepPlan = body?.approvedStepPlan === true;
  const captureMode = typeof body?.captureMode === "string"
    ? body.captureMode.replace(/-/g, "_")
    : "screenshot_scenes";
  const renderMode = typeof body?.renderMode === "string"
    ? body.renderMode.replace(/-/g, "_")
    : "remotion";
  const voiceoverMode = typeof body?.voiceoverMode === "string"
    ? body.voiceoverMode.replace(/-/g, "_")
    : "none";
  const stepPlan = Array.isArray(body?.stepPlan)
    ? body.stepPlan.slice(0, 20).map((step: any, index: number) => ({
      id: typeof step?.id === "string" ? step.id.slice(0, 80) : `scene-${index + 1}`,
      label: typeof step?.label === "string" ? step.label.slice(0, 500) : "",
    })).filter((step: any) => step.label)
    : null;
  const transcriptText = typeof body?.transcriptText === "string"
    ? body.transcriptText.slice(0, 6000)
    : null;

  if (!assetTemplateSlug || typeof assetTemplateSlug !== "string") {
    return jsonResponse(req, { success: false, error: "Template is required" }, 400);
  }

  if (!approvedStepPlan) {
    return jsonResponse(req, { success: false, error: "Approved step plan is required" }, 400);
  }

  if (!captureModes.has(captureMode)) {
    return jsonResponse(req, { success: false, error: "Capture mode is not approved" }, 400);
  }

  if (!renderModes.has(renderMode)) {
    return jsonResponse(req, { success: false, error: "Render mode is not approved" }, 400);
  }

  if (!voiceoverModes.has(voiceoverMode)) {
    return jsonResponse(req, { success: false, error: "Voiceover mode is not approved" }, 400);
  }

  if (!approvedAssetTemplates.has(assetTemplateSlug)) {
    return jsonResponse(req, { success: false, error: "Template is not approved for walkthrough recording" }, 400);
  }

  const targetUrl = Deno.env.get("JOBZCAFE_DEV_URL") || Deno.env.get("TALENT_DEV_URL");
  if (!targetUrl) {
    console.error("[forge-walkthrough-run] Missing JOBZCAFE_DEV_URL");
    return jsonResponse(req, { success: false, error: "Walkthrough recorder is not configured" }, 500);
  }

  const { data: assetTemplate, error: assetTemplateError } = await auth.serviceClient
    .from("forge_walkthrough_asset_template")
    .select("id, slug, name, is_active")
    .eq("slug", assetTemplateSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (assetTemplateError) {
    console.error("[forge-walkthrough-run] Failed to load asset template:", assetTemplateError);
    return jsonResponse(req, { success: false, error: "Failed to load template" }, 500);
  }

  if (!assetTemplate) {
    return jsonResponse(req, { success: false, error: "Template not found" }, 404);
  }

  const { data: run, error: insertError } = await auth.serviceClient
    .from("forge_walkthrough_run")
    .insert({
      asset_template_id: assetTemplate.id,
      requested_by: auth.context.bohUser.id,
      status: "queued",
      environment: "dev",
      capture_mode: captureMode,
      render_mode: renderMode,
      voiceover_mode: voiceoverMode,
      step_plan: stepPlan,
      transcript_text: voiceoverMode === "none" ? null : transcriptText,
      target_url: targetUrl,
    })
    .select("id, status, capture_mode, render_mode, voiceover_mode, created_at, assetTemplate:forge_walkthrough_asset_template(slug, name)")
    .single();

  if (insertError) {
    console.error("[forge-walkthrough-run] Failed to create run:", insertError);
    return jsonResponse(req, { success: false, error: "Failed to create walkthrough run" }, 500);
  }

  return jsonResponse(req, { success: true, run });
});

// supabase/functions/storyboard-save-draft/index.ts
// Edge Function to persist versioned chapter drafts into content_draft
// Deno runtime, Supabase JS v2 via jsr

// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAuthUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SB_PUBLISHABLE_KEY");
  if (!supabaseUrl || !publishableKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data?.user ?? null;
}

async function getBohUserContext(serviceClient: any, authUserId: string) {
  const { data, error } = await serviceClient
    .from("boh_user")
    .select("id, tenant_id")
    .eq("auth_user_id", authUserId)
    .eq("app_context", "boh")
    .maybeSingle();

  if (error || !data?.id || !data?.tenant_id) {
    throw error ?? new Error("Unable to resolve BOH user tenant context for auth user");
  }

  return { id: data.id as string, tenantId: data.tenant_id as string };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Pattern B authentication check
  const user = await getAuthUser(req);
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await req.json();

    const {
      blueprint_id,
      section_id = null,
      title = null,
      content_md,
      source = "ai_polished",
      content_kind = "blog",
      project_type = null,
    } = body ?? {};

    if (!blueprint_id || !content_md) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: blueprint_id, content_md" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKey = Deno.env.get("SB_SECRET_KEY");

    if (!supabaseUrl || !secretKey) {
      console.error("[storyboard-save-draft] Missing SUPABASE_URL or SB_SECRET_KEY");
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false },
    });
    const bohContext = await getBohUserContext(supabase, user.id);
    const currentTenantId = bohContext.tenantId;

    const { data: project, error: projectError } = await supabase
      .from("content_projects")
      .select("id, tenant_id")
      .eq("id", blueprint_id)
      .eq("tenant_id", currentTenantId)
      .maybeSingle();

    if (projectError || !project) {
      return json({ error: "Project not found" }, 404);
    }

    if (section_id) {
      const { data: section, error: sectionError } = await supabase
        .from("content_sections")
        .select("id, project_id, tenant_id")
        .eq("id", section_id)
        .eq("project_id", blueprint_id)
        .eq("tenant_id", currentTenantId)
        .maybeSingle();

      if (sectionError || !section) {
        return json({ error: "Section not found" }, 404);
      }
    }

    // 1. Determine next version for this blueprint + section
    const { data: versionRows, error: versionError } = await supabase
      .from("content_draft")
      .select("version")
      .eq("blueprint_id", blueprint_id)
      .eq("section_id", section_id)
      .eq("tenant_id", currentTenantId)
      .order("version", { ascending: false })
      .limit(1);

    if (versionError) {
      console.error("[storyboard-save-draft] Version lookup error", versionError);
      return new Response(
        JSON.stringify({ error: "Failed to determine draft version" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nextVersion =
      versionRows && versionRows.length > 0
        ? (versionRows[0].version as number) + 1
        : 1;

    // 2. Mark existing drafts as not current
    const { error: clearError } = await supabase
      .from("content_draft")
      .update({ is_current: false })
      .eq("blueprint_id", blueprint_id)
      .eq("section_id", section_id)
      .eq("tenant_id", currentTenantId);

    if (clearError) {
      console.error("[storyboard-save-draft] Failed to clear existing drafts", clearError);
      return new Response(
        JSON.stringify({ error: "Failed to update existing drafts" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Insert new draft
    const { data, error: insertError } = await supabase
      .from("content_draft")
      .insert({
        tenant_id: currentTenantId,
        blueprint_id,
        section_id,
        version: nextVersion,
        status: "draft",
        source,
        title,
        content_md,
        is_current: true,
      })
      .select("*")
      .single();

    if (insertError || !data) {
      console.error("[storyboard-save-draft] Insert error", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save draft" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (content_kind || project_type) {
      const { data: existingBlueprint, error: blueprintError } = await supabase
        .from("content_blueprint")
        .select("id, meta")
        .eq("id", blueprint_id)
        .eq("tenant_id", currentTenantId)
        .maybeSingle();

      if (blueprintError) {
        console.error("[storyboard-save-draft] Failed to load content_blueprint", blueprintError);
      } else if (existingBlueprint) {
        const currentMeta = (existingBlueprint as any).meta ?? {};
        const nextMeta = project_type
          ? { ...currentMeta, project_type }
          : currentMeta;

        const updatePayload: any = { content_kind };
        if (project_type) {
          updatePayload.meta = nextMeta;
        }

        const { error: updateError } = await supabase
          .from("content_blueprint")
          .update(updatePayload)
          .eq("id", blueprint_id)
          .eq("tenant_id", currentTenantId);

        if (updateError) {
          console.error("[storyboard-save-draft] Failed to update content_blueprint", updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({ draft: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[storyboard-save-draft] Unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Unexpected server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

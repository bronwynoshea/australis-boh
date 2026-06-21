// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

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

async function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("SB_SECRET_KEY");
  if (!supabaseUrl || !secretKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY");
  }
  return createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
}

async function getBohUserId(serviceClient: any, authUserId: string) {
  const { data, error } = await serviceClient
    .from("boh_user")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !data?.id) {
    throw error ?? new Error("Unable to resolve boh_user for auth user");
  }

  return data.id as string;
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const {
      project_id,
      content_type,
      title,
      subtitle,
      soundbyte_id,
      audience_variant_id,
      reference_md,
      interviewer_prompt,
    } = body ?? {};

    const serviceClient = await getServiceClient();
    const bohUserId = await getBohUserId(serviceClient, user.id);

    if (project_id) {
      const { data: existing, error: loadError } = await serviceClient
        .from("content_projects")
        .select("id, owner_user_id")
        .eq("id", project_id)
        .maybeSingle();

      if (loadError || !existing) {
        return jsonResponse(req, { error: "Project not found" }, 404);
      }

      if (existing.owner_user_id !== bohUserId) {
        return jsonResponse(req, { error: "Forbidden" }, 403);
      }

      const updatePayload: any = {};
      if (title !== undefined) updatePayload.title = String(title).trim();
      if (subtitle !== undefined) updatePayload.subtitle = subtitle;
      if (soundbyte_id !== undefined) updatePayload.soundbyte_id = soundbyte_id;
      if (audience_variant_id !== undefined) updatePayload.audience_variant_id = audience_variant_id;
      if (reference_md !== undefined) updatePayload.reference_md = reference_md;
      if (interviewer_prompt !== undefined) updatePayload.interviewer_prompt = interviewer_prompt;

      if (Object.keys(updatePayload).length === 0) {
        return jsonResponse(req, { error: "No fields provided to update" }, 400);
      }

      updatePayload.updated_at = new Date().toISOString();

      const { data: updated, error: updateError } = await serviceClient
        .from("content_projects")
        .update(updatePayload)
        .eq("id", project_id)
        .select("*")
        .single();

      if (updateError || !updated) {
        console.error("[content-project-upsert] Update error", updateError);
        return jsonResponse(req, { error: "Failed to update project" }, 400);
      }

      return jsonResponse(req, { project: updated });
    }

    if (!content_type || content_type !== "book") {
      return jsonResponse(req, { error: "content_type must be 'book'" }, 400);
    }

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return jsonResponse(req, { error: "Missing required field: title" }, 400);
    }

    const insertPayload: any = {
      owner_user_id: bohUserId,
      app_context: "boh",
      content_type,
      title: title.trim(),
      subtitle: subtitle ?? null,
      soundbyte_id: soundbyte_id ?? null,
      audience_variant_id: audience_variant_id ?? null,
      status: "draft",
      reference_md: reference_md ?? null,
      interviewer_prompt: interviewer_prompt ?? null,
    };

    const { data: created, error: insertError } = await serviceClient
      .from("content_projects")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertError || !created) {
      console.error("[content-project-upsert] Insert error", insertError);
      return jsonResponse(req, { error: "Failed to create project" }, 400);
    }

    return jsonResponse(req, { project: created });
  } catch (err) {
    console.error("[content-project-upsert] Unexpected error", err);
    return jsonResponse(req, { error: "Unexpected server error" }, 500);
  }
});

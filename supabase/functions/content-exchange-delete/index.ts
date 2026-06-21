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
  const corsPreflight = handleCors(req);
  if (corsPreflight) return corsPreflight;

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { exchange_id } = body ?? {};

    if (!exchange_id || typeof exchange_id !== "string" || exchange_id.trim().length === 0) {
      return jsonResponse(req, { error: "Missing required field: exchange_id" }, 400);
    }

    const serviceClient = await getServiceClient();
    const bohUserId = await getBohUserId(serviceClient, user.id);

    const { data: exchange, error: exchangeError } = await serviceClient
      .from("content_exchanges")
      .select("id, project_id")
      .eq("id", exchange_id)
      .maybeSingle();

    if (exchangeError || !exchange) {
      return jsonResponse(req, { error: "Exchange not found" }, 404);
    }

    const { data: project, error: projectError } = await serviceClient
      .from("content_projects")
      .select("id, owner_user_id")
      .eq("id", exchange.project_id)
      .maybeSingle();

    if (projectError || !project) {
      return jsonResponse(req, { error: "Project not found" }, 404);
    }

    if (project.owner_user_id !== bohUserId) {
      return jsonResponse(req, { error: "Forbidden" }, 403);
    }

    const { error: deleteError } = await serviceClient
      .from("content_exchanges")
      .update({ is_deleted: true })
      .eq("id", exchange_id);

    if (deleteError) {
      console.error("[content-exchange-delete] Soft delete error", deleteError);
      return jsonResponse(req, { error: "Failed to delete exchange" }, 400);
    }

    return jsonResponse(req, { success: true });
  } catch (err) {
    console.error("[content-exchange-delete] Unexpected error", err);
    return jsonResponse(req, { error: "Unexpected server error" }, 500);
  }
});

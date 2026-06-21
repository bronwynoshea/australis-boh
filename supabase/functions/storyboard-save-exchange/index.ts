// supabase/functions/storyboard-save-exchange/index.ts
// Edge Function to persist storyboard Q&A exchanges into content_exchanges
// Deno runtime, Supabase JS v2 via jsr

// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
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
      project_id,
      section_id = null,
      sequence,
      role,
      question_text = null,
      answer_text = null,
      content_kind = "blog",
      project_type = null,
    } = body ?? {};

    if (!project_id || typeof sequence !== "number" || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: project_id, sequence, role" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKey = Deno.env.get("SB_SECRET_KEY");

    if (!supabaseUrl || !secretKey) {
      console.error("[storyboard-save-exchange] Missing SUPABASE_URL or SB_SECRET_KEY");
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("content_exchanges")
      .insert({
        project_id,
        section_id,
        sequence,
        role,
        question_text,
        answer_text,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[storyboard-save-exchange] Insert error", error);
      return new Response(
        JSON.stringify({ error: "Failed to save exchange" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (content_kind || project_type) {
      const { data: blueprint, error: blueprintError } = await supabase
        .from("content_blueprint")
        .select("id, meta")
        .eq("id", project_id)
        .maybeSingle();

      if (blueprintError) {
        console.error("[storyboard-save-exchange] Failed to load content_blueprint", blueprintError);
      } else if (blueprint) {
        const currentMeta = (blueprint as any).meta ?? {};
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
          .eq("id", project_id);

        if (updateError) {
          console.error("[storyboard-save-exchange] Failed to update content_blueprint", updateError);
        }
      }
    }

    return new Response(
      JSON.stringify({ exchange: data }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[storyboard-save-exchange] Unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Unexpected server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

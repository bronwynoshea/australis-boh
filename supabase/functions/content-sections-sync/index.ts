// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

function normalizeLabel(input: unknown): string {
  return String(input ?? "").trim();
}

function normalizeSectionType(input: unknown): string | null {
  const val = String(input ?? "").trim().toLowerCase();
  if (!val) return null;
  if (val === "part" || val === "chapter") return val;
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const user = await getAuthUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { project_id, sections } = body ?? {};

    if (!project_id || !Array.isArray(sections)) {
      return json({ error: "Missing required fields: project_id, sections" }, 400);
    }

    const nextSections: Array<{ section_index: number; label: string; section_type: string | null }> = [];
    for (const row of sections) {
      const section_index = Number((row ?? {}).section_index);
      if (!Number.isFinite(section_index) || section_index < 1) {
        return json({ error: "Invalid section_index; must be >= 1" }, 400);
      }

      const label = normalizeLabel((row ?? {}).label);
      if (!label) {
        return json({ error: "Invalid label; must be non-empty" }, 400);
      }

      nextSections.push({
        section_index,
        label,
        section_type: normalizeSectionType((row ?? {}).section_type),
      });
    }

    nextSections.sort((a, b) => a.section_index - b.section_index);

    // Ensure contiguous indices starting at 1.
    for (let i = 0; i < nextSections.length; i++) {
      nextSections[i].section_index = i + 1;
    }

    const serviceClient = await getServiceClient();
    const bohUserId = await getBohUserId(serviceClient, user.id);

    const { data: project, error: projectError } = await serviceClient
      .from("content_projects")
      .select("id, owner_user_id")
      .eq("id", project_id)
      .maybeSingle();

    if (projectError || !project) {
      return json({ error: "Project not found" }, 404);
    }

    if (project.owner_user_id !== bohUserId) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: existingSections, error: sectionsError } = await serviceClient
      .from("content_sections")
      .select("id, section_index, label, status")
      .eq("project_id", project_id);

    if (sectionsError) {
      console.error("[content-sections-sync] Failed to load content_sections", sectionsError);
      return json({ error: "Failed to load existing sections" }, 400);
    }

    const existingByIndex = new Map<number, any>();
    const existingRows = (existingSections ?? []) as any[];

    for (const row of existingRows) {
      // Protect any special section that might exist at index 0.
      if (typeof row.section_index === "number") {
        existingByIndex.set(row.section_index, row);
      }
    }

    const keepIds = new Set<string>();

    for (const next of nextSections) {
      const existing = existingByIndex.get(next.section_index);
      if (existing?.id) {
        keepIds.add(existing.id);
        const { error: updateError } = await serviceClient
          .from("content_sections")
          .update({
            label: next.label,
            section_type: next.section_type,
            status: "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error("[content-sections-sync] Update error", updateError);
          return json({ error: "Failed to update outline" }, 400);
        }
      } else {
        const { data: inserted, error: insertError } = await serviceClient
          .from("content_sections")
          .insert({
            project_id,
            section_index: next.section_index,
            label: next.label,
            section_type: next.section_type,
            status: "active",
          })
          .select("id")
          .single();

        if (insertError || !inserted?.id) {
          console.error("[content-sections-sync] Insert error", insertError);
          return json({ error: "Failed to save outline" }, 400);
        }

        keepIds.add(inserted.id);
      }
    }

    // Archive any sections that are no longer present in the outline.
    for (const row of existingRows) {
      if (!row?.id) continue;
      if (row.section_index === 0) continue;
      if (keepIds.has(row.id)) continue;

      const { error: archiveError } = await serviceClient
        .from("content_sections")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", row.id);

      if (archiveError) {
        console.error("[content-sections-sync] Archive error", archiveError);
        return json({ error: "Failed to archive removed sections" }, 400);
      }
    }

    const { data: refreshed, error: refreshError } = await serviceClient
      .from("content_sections")
      .select("*")
      .eq("project_id", project_id)
      .order("section_index", { ascending: true });

    if (refreshError) {
      console.error("[content-sections-sync] Refresh error", refreshError);
      return json({ error: "Outline saved but failed to refresh" }, 400);
    }

    return json({ sections: refreshed ?? [] });
  } catch (err) {
    console.error("[content-sections-sync] Unexpected error", err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

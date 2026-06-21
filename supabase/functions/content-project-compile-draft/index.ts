// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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

function compileMarkdown(project: any, sections: any[]) {
  const lines: string[] = [];

  lines.push(`# ${project.title}`);
  if (project.subtitle) {
    lines.push("", `## ${project.subtitle}`);
  }

  lines.push("", "---", "");

  for (const section of sections) {
    const t = String(section.section_type ?? "").toLowerCase();
    const label = section.label ?? "Untitled";

    if (t === "part") {
      lines.push(`# ${label}`, "");
      continue;
    }

    if (t === "chapter") {
      lines.push(`## ${label}`, "");
      const content = section.draft_md ?? section.raw_md ?? "_(Draft not generated yet)_";
      lines.push(String(content).trim() ? String(content) : "_(Draft not generated yet)_", "");
      continue;
    }

    // Unknown type treated as chapter.
    lines.push(`## ${label}`, "");
    const fallback = section.draft_md ?? section.raw_md ?? "_(Draft not generated yet)_";
    lines.push(String(fallback), "");
  }

  return lines.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const user = await getAuthUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const { project_id } = body ?? {};

    if (!project_id) {
      return json({ error: "Missing required field: project_id" }, 400);
    }

    const serviceClient = await getServiceClient();
    const bohUserId = await getBohUserId(serviceClient, user.id);

    const { data: project, error: projectError } = await serviceClient
      .from("content_projects")
      .select("*")
      .eq("id", project_id)
      .maybeSingle();

    if (projectError || !project) {
      return json({ error: "Project not found" }, 404);
    }

    if (project.owner_user_id !== bohUserId) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: sections, error: sectionsError } = await serviceClient
      .from("content_sections")
      .select("*")
      .eq("project_id", project_id)
      .neq("status", "archived")
      .order("section_index", { ascending: true });

    if (sectionsError) {
      console.error("[content-project-compile-draft] Sections load error", sectionsError);
      return json({ error: "Failed to load sections" }, 400);
    }

    const compiled = compileMarkdown(project, sections ?? []);

    const currentMeta = project.meta ?? {};
    const nextMeta = { ...(currentMeta as any), compiled_draft_md: compiled };

    const { data: updated, error: updateError } = await serviceClient
      .from("content_projects")
      .update({ meta: nextMeta, updated_at: new Date().toISOString() })
      .eq("id", project_id)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("[content-project-compile-draft] Update error", updateError);
      return json({ error: "Failed to save compiled draft" }, 400);
    }

    return json({ project: updated, compiled_draft_md: compiled });
  } catch (err) {
    console.error("[content-project-compile-draft] Unexpected error", err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

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

function buildRawMarkdown(projectTitle: string | null, chapterLabel: string, exchanges: any[]) {
  const lines: string[] = [];
  if (projectTitle) lines.push(`# ${projectTitle}`);
  lines.push(`## ${chapterLabel}`, "", "### Harper Interview (raw)");

  let qIndex = 0;
  for (let i = 0; i < exchanges.length; i++) {
    const ex = exchanges[i];
    const role = String(ex.role ?? "").toLowerCase();

    if (role === "harper") {
      qIndex += 1;
      const q = ex.question_text ?? "";
      lines.push(`Q${qIndex}: ${q}`);
      continue;
    }

    if (role === "user") {
      const a = ex.answer_text ?? "";
      if (qIndex === 0) {
        qIndex = 1;
        lines.push(`Q${qIndex}:`);
      }
      lines.push(`A${qIndex}: ${a}`);
      continue;
    }
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
    const { project_id, section_id } = body ?? {};

    if (!project_id || !section_id) {
      return json({ error: "Missing required fields: project_id, section_id" }, 400);
    }

    const serviceClient = await getServiceClient();
    const bohUserId = await getBohUserId(serviceClient, user.id);

    const { data: project, error: projectError } = await serviceClient
      .from("content_projects")
      .select("id, owner_user_id, title")
      .eq("id", project_id)
      .maybeSingle();

    if (projectError || !project) {
      return json({ error: "Project not found" }, 404);
    }

    if (project.owner_user_id !== bohUserId) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: section, error: sectionError } = await serviceClient
      .from("content_sections")
      .select("id, project_id, label")
      .eq("id", section_id)
      .maybeSingle();

    if (sectionError || !section) {
      return json({ error: "Section not found" }, 404);
    }

    if (section.project_id !== project_id) {
      return json({ error: "Section does not belong to project" }, 400);
    }

    const { data: exchanges, error: exchangesError } = await serviceClient
      .from("content_exchanges")
      .select("id, sequence, role, question_text, answer_text")
      .eq("project_id", project_id)
      .eq("section_id", section_id)
      .order("sequence", { ascending: true });

    if (exchangesError) {
      console.error("[content-section-build-raw] Failed to load exchanges", exchangesError);
      return json({ error: "Failed to load exchanges" }, 400);
    }

    const rawMd = buildRawMarkdown(project.title ?? null, section.label, exchanges ?? []);

    const { data: updated, error: updateError } = await serviceClient
      .from("content_sections")
      .update({ raw_md: rawMd, updated_at: new Date().toISOString() })
      .eq("id", section_id)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("[content-section-build-raw] Update error", updateError);
      return json({ error: "Failed to save raw transcript" }, 400);
    }

    return json({ section: updated });
  } catch (err) {
    console.error("[content-section-build-raw] Unexpected error", err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

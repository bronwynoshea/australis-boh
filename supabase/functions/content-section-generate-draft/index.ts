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

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "among",
  "because",
  "before",
  "could",
  "doing",
  "first",
  "other",
  "their",
  "there",
  "these",
  "those",
  "through",
  "until",
  "would",
]);

function extractReferenceKeywords(referenceText: string) {
  const tokens = referenceText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !STOP_WORDS.has(word));

  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 6);
}

function naiveDraftFromRaw(rawMd: string, chapterLabel: string, referenceKeywords: string[]) {
  const lines = rawMd.split(/\r?\n/);
  const qa: Array<{ q: string; a: string }> = [];
  let currentQ: string | null = null;

  for (const line of lines) {
    const qMatch = line.match(/^Q\d+:\s*(.*)$/i);
    if (qMatch) {
      currentQ = qMatch[1].trim();
      continue;
    }

    const aMatch = line.match(/^A\d+:\s*(.*)$/i);
    if (aMatch) {
      const a = aMatch[1].trim();
      if (currentQ) {
        qa.push({ q: currentQ, a });
      }
      continue;
    }
  }

  const out: string[] = [];
  out.push(`## ${chapterLabel}`, "");

  if (qa.length === 0) {
    out.push("_No interview transcript found to draft from._");
    return out.join("\n");
  }

  // Basic, non-AI synthesis (placeholder). This avoids hallucinating facts.
  out.push("### Draft (first pass)", "");
  out.push(
    "This chapter is drafted from the raw Harper interview transcript. It keeps your wording and examples intact, without adding new facts.",
    "",
  );

  if (referenceKeywords.length > 0) {
    const keywords = referenceKeywords.map((word) => word.replace(/^\w/, (c) => c.toUpperCase()));
    out.push(
      "### Reference cues",
      "",
      `When editing, weave in proof points connected to: ${keywords.join(", ")}. Use data, anecdotes, or frameworks from your research rather than inventing new facts.`,
      "",
    );
  }

  for (const item of qa) {
    if (!item.a) continue;
    out.push(item.a, "");
  }

  out.push("### Reader action", "", "- _Add one clear action step here after reviewing the draft._");

  return out.join("\n");
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
      .select("id, owner_user_id, reference_md")
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
      .select("id, project_id, label, raw_md")
      .eq("id", section_id)
      .maybeSingle();

    if (sectionError || !section) {
      return json({ error: "Section not found" }, 404);
    }

    if (section.project_id !== project_id) {
      return json({ error: "Section does not belong to project" }, 400);
    }

    const rawMd = section.raw_md ?? "";
    if (!String(rawMd).trim()) {
      return json({ error: "No raw transcript found. Build Raw Transcript first." }, 400);
    }

    const referenceKeywords = section.project_id === project_id ? extractReferenceKeywords(String(project.reference_md ?? "")) : [];
    const draftMd = naiveDraftFromRaw(String(rawMd), section.label, referenceKeywords);

    const { data: updated, error: updateError } = await serviceClient
      .from("content_sections")
      .update({ draft_md: draftMd, updated_at: new Date().toISOString() })
      .eq("id", section_id)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error("[content-section-generate-draft] Update error", updateError);
      return json({ error: "Failed to save chapter draft" }, 400);
    }

    return json({ section: updated });
  } catch (err) {
    console.error("[content-section-generate-draft] Unexpected error", err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

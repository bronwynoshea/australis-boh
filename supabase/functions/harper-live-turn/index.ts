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

async function ensureProjectAccess(serviceClient: any, projectId: string, userId: string) {
  const { data, error } = await serviceClient
    .from("content_projects")
    .select("id, owner_user_id, reference_md")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Project not found");
  }

  if (data.owner_user_id !== userId) {
    throw new Error("Forbidden");
  }

  return data;
}

async function ensureSection(serviceClient: any, sectionId: string, projectId: string) {
  const { data, error } = await serviceClient
    .from("content_sections")
    .select("id, project_id, label")
    .eq("id", sectionId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Section not found");
  }

  if (data.project_id !== projectId) {
    throw new Error("Section does not belong to project");
  }

  return data;
}

async function transcribeAudioPlaceholder(): Promise<string> {
  // TODO: Replace with Gemini Audio-to-text transcription when available.
  return "(Voice transcript placeholder – replace with Gemini transcription)";
}

async function askGeminiForNextQuestion(params: {
  transcript: string;
  previousQuestion?: string | null;
  chapterLabel?: string | null;
}): Promise<string> {
  const { transcript, previousQuestion, chapterLabel } = params;
  // TODO: Replace with real Gemini call. For now fallback to deterministic prompt.
  const base = previousQuestion && previousQuestion.trim().length > 0
    ? `Thanks for answering my earlier question. Given what you said about "${transcript}"`
    : `Thanks for sharing "${transcript}"`;
  const suffix = chapterLabel ? ` in the chapter "${chapterLabel}"` : "";
  return `${base}${suffix}, can you go a layer deeper?`;
}

async function insertExchangePair(serviceClient: any, args: {
  projectId: string;
  sectionId: string;
  transcript: string;
  nextQuestion: string;
}) {
  const { projectId, sectionId, transcript, nextQuestion } = args;
  const { data: rows, error } = await serviceClient
    .from("content_exchanges")
    .select("sequence")
    .eq("project_id", projectId)
    .eq("section_id", sectionId)
    .order("sequence", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error("Failed to determine exchange sequence");
  }

  const nextSequence = rows && rows.length > 0 ? Number(rows[0].sequence) + 1 : 1;

  const { error: userError } = await serviceClient
    .from("content_exchanges")
    .insert({
      project_id: projectId,
      section_id: sectionId,
      sequence: nextSequence,
      role: "user",
      answer_text: transcript,
    });

  if (userError) {
    throw new Error("Failed to save user answer");
  }

  const { error: harperError } = await serviceClient
    .from("content_exchanges")
    .insert({
      project_id: projectId,
      section_id: sectionId,
      sequence: nextSequence + 1,
      role: "harper",
      question_text: nextQuestion,
    });

  if (harperError) {
    throw new Error("Failed to save Harper question");
  }
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
    const { project_id, section_id, audio_base64, previous_question } = body ?? {};

    if (!project_id || !section_id || !audio_base64) {
      return jsonResponse(req, { error: "Missing required fields" }, 400);
    }

    const serviceClient = await getServiceClient();
    const bohUserId = await getBohUserId(serviceClient, user.id);
    const project = await ensureProjectAccess(serviceClient, project_id, bohUserId);
    const section = await ensureSection(serviceClient, section_id, project_id);

    const transcript = await transcribeAudioPlaceholder();
    const nextQuestion = await askGeminiForNextQuestion({
      transcript,
      previousQuestion: previous_question ?? null,
      chapterLabel: section.label ?? null,
    });

    await insertExchangePair(serviceClient, {
      projectId: project_id,
      sectionId: section_id,
      transcript,
      nextQuestion,
    });

    return jsonResponse(req, { transcript, next_question: nextQuestion });
  } catch (err) {
    console.error("[harper-live-turn] Unexpected error", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    const status = message === "Forbidden" ? 403 : message === "Project not found" || message === "Section not found" ? 404 : 500;
    return jsonResponse(req, { error: message }, status);
  }
});

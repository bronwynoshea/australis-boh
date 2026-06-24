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

const DEFAULT_INTERVIEWER_PROMPT = `You are Harper, the interviewer for a JOBZ CAFE® book project.

Your job:
- Ask clear, practical, chapter-specific questions that help the author produce usable chapter content.
- Ask ONE question at a time.
- If an answer is vague, ask a sharper follow-up that requests an example, proof, or a specific moment.
- Keep momentum: avoid filler (“go deeper”, “tell me more”) unless you make it specific.
- Do not use therapy/coaching language. This is professional self-reflection, not counseling.
- Stay aligned with JOBZ CAFE® tone: direct, warm, evidence-based, modern.

Always ground your question in the current chapter title and the project’s purpose.`;

const PLACEHOLDER_PATTERNS = [
  /voice transcript placeholder/i,
  /gemini transcription/i,
  /\baudio transcription placeholder\b/i,
  /\bplaceholder\b/i,
];

const FOLLOW_UP_TEMPLATES = [
  ({
    context,
    snippet,
    referenceHint,
  }: {
    context: ContextPacket;
    snippet: string | null;
    referenceHint: string;
  }) =>
    `You noted "${snippet ?? context.chapterTitle}". Tell a concrete story from your work that proves this point inside the chapter "${context.chapterTitle}", pulling any specifics from your notes. ${referenceHint}`.trim(),
  ({
    context,
    snippet,
    referenceHint,
  }: {
    context: ContextPacket;
    snippet: string | null;
    referenceHint: string;
  }) =>
    `Break down the step-by-step method a reader should follow to apply "${snippet ?? context.chapterTitle}" in the chapter "${context.chapterTitle}". Tie each step to evidence from your references so it feels credible. ${referenceHint}`.trim(),
  ({
    context,
    snippet,
    referenceHint,
  }: {
    context: ContextPacket;
    snippet: string | null;
    referenceHint: string;
  }) =>
    `Give me a proof point for "${snippet ?? context.chapterTitle}"—cite a stat, client result, or lived example that shows the chapter’s promise is real for readers of "${context.projectTitle}". ${referenceHint}`.trim(),
  ({
    context,
    referenceHint,
  }: {
    context: ContextPacket;
    referenceHint: string;
  }) =>
    `List an action plan of 3–5 moves a reader can take this week to live out the guidance in "${context.chapterTitle}". Make each action concrete and align it with the project purpose${
      context.projectPurpose ? ` (${context.projectPurpose})` : ""
    }. ${referenceHint}`.trim(),
];

type ExchangeRow = {
  id: string;
  sequence: number;
  role: string;
  question_text: string | null;
  answer_text: string | null;
};

type ContextPacket = {
  projectTitle: string;
  projectSubtitle: string | null;
  chapterTitle: string;
  projectPurpose: string | null;
  projectReference: string | null;
  chapterReference: string | null;
  transcriptSummary: string;
  systemPrompt: string;
};

function truncateText(value: string | null | undefined, maxLength = 200) {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function hasPlaceholderContent(value: string | null | undefined) {
  if (!value) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function filterValidExchanges(rows: ExchangeRow[]): ExchangeRow[] {
  return rows
    .filter((row) => row.role !== "system")
    .filter((row) => {
      if (hasPlaceholderContent(row.question_text)) return false;
      if (hasPlaceholderContent(row.answer_text)) return false;
      return true;
    });
}

function buildTranscriptSummary(exchanges: ExchangeRow[]): string {
  const summaryLines = exchanges
    .map((row) => {
      const label = row.role === "user" ? "Author" : "Harper";
      const content =
        row.role === "user" ? truncateText(row.answer_text, 240) : truncateText(row.question_text, 240);
      if (!content) return null;
      return `${label}: ${content}`;
    })
    .filter(Boolean);

  return summaryLines.join("\n");
}

function resolveSystemPrompt(
  chapterPrompt?: string | null,
  projectPrompt?: string | null,
): string {
  if (chapterPrompt && chapterPrompt.trim().length > 0) return chapterPrompt.trim();
  if (projectPrompt && projectPrompt.trim().length > 0) return projectPrompt.trim();
  return DEFAULT_INTERVIEWER_PROMPT;
}

function buildContextPacket(args: {
  project: any;
  section: any;
  transcriptSummary: string;
  systemPrompt: string;
}): ContextPacket {
  const { project, section, transcriptSummary, systemPrompt } = args;
  return {
    projectTitle: project.title ?? "Untitled project",
    projectSubtitle: project.subtitle ?? null,
    chapterTitle: section.label ?? "This chapter",
    chapterNotes: section.notes ?? null,
    projectPurpose: project.purpose ?? null,
    projectReference: project.reference_md ?? null,
    chapterReference: section.reference_md ?? null,
    transcriptSummary,
    systemPrompt,
  };
}

function buildReferenceHint(context: ContextPacket) {
  if (context.chapterReference && context.chapterReference.trim().length > 0) {
    return "Use the chapter reference notes for specific names, data, or imagery.";
  }
  if (context.projectReference && context.projectReference.trim().length > 0) {
    return "Quote from the project reference memo to keep the answer grounded.";
  }
  return "Stay concrete and cite real moments or proof.";
}

function buildOpeningQuestion(context: ContextPacket, referenceHint: string) {
  const subtitleSuffix = context.projectSubtitle ? ` (${context.projectSubtitle})` : "";
  const purposeSuffix = context.projectPurpose ? ` It ladders up to the project purpose: ${context.projectPurpose}.` : "";
  return `For the chapter "${context.chapterTitle}" in "${context.projectTitle}${subtitleSuffix}", describe the central transformation the reader must experience and cite the strongest story or data you already have. ${referenceHint}${purposeSuffix}`.trim();
}

function chooseFollowUpTemplate(sequence: number) {
  const index = Math.max(0, (sequence - 1) % FOLLOW_UP_TEMPLATES.length);
  return FOLLOW_UP_TEMPLATES[index];
}

function buildFollowUpQuestion(args: {
  context: ContextPacket;
  sequence: number;
  lastUserAnswer: string | null;
  referenceHint: string;
}) {
  const { context, sequence, lastUserAnswer, referenceHint } = args;
  const snippet = lastUserAnswer ? truncateText(lastUserAnswer, 200) : null;
  const template = chooseFollowUpTemplate(sequence);
  return template({ context, snippet, referenceHint });
}

function determineNextQuestion(args: {
  context: ContextPacket;
  hasPriorExchanges: boolean;
  sequence: number;
  lastUserAnswer: string | null;
}) {
  const { context, hasPriorExchanges, sequence, lastUserAnswer } = args;
  const referenceHint = buildReferenceHint(context);

  if (!hasPriorExchanges) {
    return buildOpeningQuestion(context, referenceHint);
  }
}

function buildThreadSummary(exchanges: ExchangeRow[]) {
  const items = exchanges
    .map((row) => {
      if (row.role === "user" && row.answer_text) {
        return `Author: ${row.answer_text.trim()}`;
      }
      if (row.role === "harper" && row.question_text) {
        return `Harper: ${row.question_text.trim()}`;
      }
      return null;
    })
    .filter(Boolean);
  return items.join("\n");
}

function buildGeminiPrompt(args: {
  systemPrompt: string;
  context: ContextPacket;
  references: string | null;
  threadSummary: string;
}) {
  const { systemPrompt, context, references, threadSummary } = args;
  const projectContext = [
    `Title: ${context.projectTitle}`,
    context.projectSubtitle ? `Subtitle: ${context.projectSubtitle}` : null,
    context.projectPurpose ? `Purpose: ${context.projectPurpose}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const chapterContext = [
    `Chapter: ${context.chapterTitle}`,
    context.chapterNotes ? `Notes: ${context.chapterNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const referencesBlock = references ? references.trim() : "None supplied.";

  return [
    `SYSTEM:\n${systemPrompt}`,
    `PROJECT CONTEXT:\n${projectContext || "Not provided"}`,
    `CHAPTER CONTEXT:\n${chapterContext || "Not provided"}`,
    `REFERENCES:\n${referencesBlock}`,
    `THREAD SO FAR:\n${threadSummary || "No prior exchanges."}`,
    `INSTRUCTIONS:\nAsk ONE practical, chapter-specific question grounded in the chapter title. Avoid therapy language, avoid vague phrases like "go deeper", and reference the reader outcome when possible.`,
  ].join("\n\n");
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
    const { project_id, section_id, answer_text } = body ?? {};

    if (!project_id || !section_id || !answer_text || String(answer_text).trim().length === 0) {
      return json({ error: "Missing required fields: project_id, section_id, answer_text" }, 400);
    }

    const serviceClient = await getServiceClient();
    const bohContext = await getBohUserContext(serviceClient, user.id);
    const bohUserId = bohContext.id;
    const currentTenantId = bohContext.tenantId;

    const { data: project, error: projectError } = await serviceClient
      .from("content_projects")
      .select(
        "id, owner_user_id, tenant_id, title, subtitle, purpose, reference_md, interviewer_prompt",
      )
      .eq("id", project_id)
      .eq("tenant_id", currentTenantId)
      .maybeSingle();

    if (projectError || !project) {
      return json({ error: "Project not found" }, 404);
    }

    if (project.owner_user_id !== bohUserId) {
      return json({ error: "Forbidden" }, 403);
    }

    // Ensure chapter section belongs to project.
    const { data: section, error: sectionError } = await serviceClient
      .from("content_sections")
      .select("id, project_id, tenant_id, label, section_type, reference_md, notes, interviewer_prompt")
      .eq("id", section_id)
      .eq("tenant_id", currentTenantId)
      .maybeSingle();

    if (sectionError || !section) {
      return json({ error: "Section not found" }, 404);
    }

    if (section.project_id !== project_id) {
      return json({ error: "Section does not belong to project" }, 400);
    }

    if (String(section.section_type ?? "").toLowerCase() !== "chapter") {
      return json({ error: "Section must be a chapter" }, 400);
    }

    const cleanAnswer = String(answer_text ?? "").trim();

    if (hasPlaceholderContent(cleanAnswer)) {
      return json({ error: "Please provide a real answer before submitting." }, 400);
    }

    const { data: lastSeqRows, error: lastSeqError } = await serviceClient
      .from("content_exchanges")
      .select("sequence")
      .eq("project_id", project_id)
      .eq("section_id", section_id)
      .eq("tenant_id", currentTenantId)
      .eq("is_hidden", false)
      .order("sequence", { ascending: false })
      .limit(1);

    if (lastSeqError) {
      console.error("[content-exchange-add] Sequence lookup error", lastSeqError);
      return json({ error: "Failed to determine exchange sequence" }, 400);
    }

    const nextSequence = lastSeqRows && lastSeqRows.length > 0 ? Number(lastSeqRows[0].sequence) + 1 : 1;

    const { data: exchangeRows, error: exchangesError } = await serviceClient
      .from("content_exchanges")
      .select("id, sequence, role, question_text, answer_text")
      .eq("project_id", project_id)
      .eq("section_id", section_id)
      .eq("tenant_id", currentTenantId)
      .eq("is_hidden", false)
      .order("sequence", { ascending: false })
      .limit(8);

    if (exchangesError) {
      console.error("[content-exchange-add] Failed to load prior exchanges", exchangesError);
    }

    const exchangesAsc = (exchangeRows ?? []).sort((a, b) => a.sequence - b.sequence);
    const validExchangesBeforeUser = filterValidExchanges(exchangesAsc);

    const { data: savedUser, error: userInsertError } = await serviceClient
      .from("content_exchanges")
      .insert({
        tenant_id: currentTenantId,
        project_id,
        section_id,
        sequence: nextSequence,
        role: "user",
        answer_text: cleanAnswer,
      })
      .select("*")
      .single();

    if (userInsertError || !savedUser) {
      console.error("[content-exchange-add] User insert error", userInsertError);
      return json({ error: "Failed to save answer" }, 400);
    }

    const historyWindow = [...validExchangesBeforeUser, savedUser];
    const trimmedHistoryWindow =
      historyWindow.length > 8 ? historyWindow.slice(historyWindow.length - 8) : historyWindow;
    const validHistory = filterValidExchanges(trimmedHistoryWindow);
    const transcriptSummary = buildTranscriptSummary(validHistory);
    const systemPrompt = resolveSystemPrompt(section.interviewer_prompt, project.interviewer_prompt);
    const contextPacket = buildContextPacket({
      project,
      section,
      transcriptSummary,
      systemPrompt,
    });
    const referenceText = project.reference_md ?? null;
    const truncatedReference = referenceText && referenceText.length > 4000 ? `${referenceText.slice(0, 4000)}…` : referenceText;
    const threadSummary = buildThreadSummary(validHistory);
    const geminiPrompt = buildGeminiPrompt({
      systemPrompt,
      context: contextPacket,
      references: truncatedReference,
      threadSummary,
    });

    const isDev =
      (Deno.env.get("ENVIRONMENT") || "").toLowerCase() === "development" ||
      (Deno.env.get("NODE_ENV") || "").toLowerCase() === "development";
    if (isDev) {
      console.log("[content-exchange-add] prompt meta", {
        hasInterviewerPrompt: Boolean(systemPrompt && systemPrompt !== DEFAULT_INTERVIEWER_PROMPT),
        hasReferenceMd: Boolean(referenceText && referenceText.trim().length > 0),
        chapterLabel: contextPacket.chapterTitle,
        exchangeCount: validHistory.length,
      });
    }

    void geminiPrompt;

    const harperQuestion = determineNextQuestion({
      context: contextPacket,
      hasPriorExchanges: validExchangesBeforeUser.length > 0,
      sequence: nextSequence + 1,
      lastUserAnswer: hasPlaceholderContent(savedUser.answer_text) ? null : savedUser.answer_text,
    });

    const { data: savedHarper, error: harperInsertError } = await serviceClient
      .from("content_exchanges")
      .insert({
        tenant_id: currentTenantId,
        project_id,
        section_id,
        sequence: nextSequence + 1,
        role: "harper",
        question_text: harperQuestion,
      })
      .select("*")
      .single();

    if (harperInsertError || !savedHarper) {
      console.error("[content-exchange-add] Harper insert error", harperInsertError);
      return json({ error: "Answer saved but failed to save Harper question" }, 400);
    }

    return json({ user_exchange: savedUser, harper_exchange: savedHarper });
  } catch (err) {
    console.error("[content-exchange-add] Unexpected error", err);
    return json({ error: "Unexpected server error" }, 500);
  }
});

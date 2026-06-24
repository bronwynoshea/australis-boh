import { supabase } from "../../../../../lib/supabase";
import { getCurrentBohUserContext } from "../../../../../boh/api/bohApi";
import type { ContentExchange, ContentProject, ContentSection } from "../../../types/content";
import type { ContentBlueprint, ContentDraft, HarperConversationState, SoundbyteStrategyOption } from "../types/storyboard";
import { DEFAULT_INTERVIEWER_PROMPT } from "../pages/storyboardConfig";

type ContentProjectUpsertResponse = { project: ContentProject };
type ContentSectionsSyncResponse = { sections: ContentSection[] };
type ContentExchangeAddResponse = { user_exchange: ContentExchange; harper_exchange: ContentExchange };
type ContentSectionSingleResponse = { section: ContentSection };
type ContentProjectCompileResponse = { project: ContentProject; compiled_draft_md: string };
type ResetExchangesResponse = { deleted_count?: number };

async function getCurrentBohContext(): Promise<{ id: string; tenant_id: string } | null> {
  const context = await getCurrentBohUserContext();
  if (!context?.id || !context?.tenant_id) {
    console.error("[Content] Unable to determine BOH tenant context");
    return null;
  }
  return context;
}

export async function fetchContentProjects(): Promise<ContentProject[]> {
  const context = await getCurrentBohContext();
  if (!context) return [];

  const { data, error } = await supabase
    .from("content_projects")
    .select("id, title, subtitle, content_type, status, created_at, updated_at, reference_md")
    .eq("tenant_id", context.tenant_id)
    .eq("owner_user_id", context.id)
    .eq("app_context", "boh")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Content] Failed to load content_projects", error);
    return [];
  }

  return (data ?? []) as ContentProject[];
}

export const fetchContentBlueprints = fetchContentProjects;

export async function fetchBookProject(projectId: string): Promise<ContentProject | null> {
  const context = await getCurrentBohContext();
  if (!context) return null;

  const { data, error } = await supabase
    .from("content_projects")
    .select(
      "id, title, subtitle, content_type, status, created_at, updated_at, reference_md, soundbyte_id, outline, interviewer_prompt",
    )
    .eq("id", projectId)
    .eq("tenant_id", context.tenant_id)
    .eq("owner_user_id", context.id)
    .eq("app_context", "boh")
    .maybeSingle();

  if (error) {
    console.error("[Content] Failed to load book project", error);
    return null;
  }

  if (!data) return null;

  return data as ContentProject;
}

export async function fetchLatestBookProject(): Promise<ContentProject | null> {
  const context = await getCurrentBohContext();
  if (!context) {
    return null;
  }

  const { data, error } = await supabase
    .from("content_projects")
    .select(
      "id, title, subtitle, content_type, status, created_at, updated_at, reference_md, soundbyte_id, audience_variant_id, interviewer_prompt",
    )
    .eq("tenant_id", context.tenant_id)
    .eq("owner_user_id", context.id)
    .eq("app_context", "boh")
    .eq("content_type", "book")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("[Content] Failed to load latest book project", error);
    return null;
  }

  if (!data) return null;

  return data as ContentProject;
}

export interface CreateBookProjectParams {
  title: string;
  subtitle?: string | null;
  soundbyte_id?: string | null;
  audience_variant_id?: string | null;
  interviewer_prompt?: string | null;
}

export async function createBookProject(params: CreateBookProjectParams): Promise<ContentProject> {
  const { title, subtitle = null, soundbyte_id = null, audience_variant_id = null, interviewer_prompt = null } = params;

  const { data, error } = await supabase.functions.invoke("content-project-upsert", {
    body: {
      content_type: "book",
      title,
      subtitle,
      soundbyte_id,
      audience_variant_id,
      interviewer_prompt,
    },
  });

  if (error || !data?.project) {
    console.error("[Content] Failed to create content project", error);
    throw error ?? new Error("Unable to create book project");
  }

  return (data as ContentProjectUpsertResponse).project as ContentProject;
}

export async function updateProjectInterviewerPrompt(
  projectId: string,
  interviewerPrompt: string,
): Promise<ContentProject> {
  const { data, error } = await supabase.functions.invoke("content-project-upsert", {
    body: {
      project_id: projectId,
      interviewer_prompt: interviewerPrompt,
    },
  });

  if (error || !data?.project) {
    console.error("[Content] Failed to update interviewer prompt", error);
    throw error ?? new Error("Unable to update interviewer prompt");
  }

  return (data as ContentProjectUpsertResponse).project as ContentProject;
}

export async function updateProjectReference(projectId: string, referenceMd: string): Promise<ContentProject> {
  const { data, error } = await supabase.functions.invoke("content-project-upsert", {
    body: {
      project_id: projectId,
      reference_md: referenceMd,
    },
  });

  if (error || !data?.project) {
    console.error("[Content] Failed to update project references", error);
    throw error ?? new Error("Unable to update references");
  }

  return (data as ContentProjectUpsertResponse).project as ContentProject;
}

export interface OutlineChapterInput {
  title: string;
}

export interface SaveBookOutlineParams {
  projectId: string;
  chapters: OutlineChapterInput[];
}

export async function saveBookOutline(
  params: SaveBookOutlineParams,
): Promise<ContentSection[]> {
  const { projectId, chapters } = params;

  const sections = chapters
    .map((c) => c.title.trim())
    .filter(Boolean)
    .map((label, idx) => ({
      section_index: idx + 1,
      label,
      section_type: "chapter",
    }));

  const { data, error } = await supabase.functions.invoke("content-sections-sync", {
    body: {
      project_id: projectId,
      sections,
    },
  });

  if (error) {
    console.error("[Content] Failed to sync outline sections", error);
    throw error;
  }

  return ((data as ContentSectionsSyncResponse)?.sections ?? []) as ContentSection[];
}

export interface OutlineSectionInput {
  section_index: number;
  label: string;
  section_type: "part" | "chapter" | null;
}

export async function syncOutlineSections(projectId: string, sections: OutlineSectionInput[]): Promise<ContentSection[]> {
  const { data, error } = await supabase.functions.invoke("content-sections-sync", {
    body: {
      project_id: projectId,
      sections,
    },
  });

  if (error) {
    console.error("[Content] Failed to sync outline sections", error);
    throw error;
  }

  return ((data as ContentSectionsSyncResponse)?.sections ?? []) as ContentSection[];
}

export async function fetchSoundbyteStrategies(): Promise<SoundbyteStrategyOption[]> {
  const context = await getCurrentBohContext();
  if (!context) return [];

  const { data, error } = await supabase
    .from("soundbyte_profiles")
    .select("id, name, core_soundbyte, is_default")
    .eq("tenant_id", context.tenant_id)
    .eq("app_context", "boh")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Content] Failed to load soundbyte strategies", error);
    return [];
  }

  const rows = (data ?? []) as Array<{ id: string; name: string | null; core_soundbyte: string | null }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name ?? "Untitled soundbyte",
  }));
}

export interface SoundbyteProfileSummary {
  id: string;
  name: string | null;
  core_soundbyte: string | null;
  hole_we_own: string | null;
  ppr_result: string | null;
}

export async function fetchSoundbyteProfile(soundbyteId: string): Promise<SoundbyteProfileSummary | null> {
  const context = await getCurrentBohContext();
  if (!context) return null;

  const { data, error } = await supabase
    .from("soundbyte_profiles")
    .select("id, name, core_soundbyte, hole_we_own, ppr_result")
    .eq("id", soundbyteId)
    .eq("tenant_id", context.tenant_id)
    .eq("app_context", "boh")
    .maybeSingle();

  if (error) {
    console.error("[Content] Failed to load soundbyte profile", error);
    return null;
  }

  if (!data) return null;

  return data as SoundbyteProfileSummary;
}

async function ensureInterviewSection(projectId: string): Promise<ContentSection> {
  const context = await getCurrentBohContext();
  if (!context) {
    throw new Error("No BOH tenant matched the current session.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("content_sections")
    .select(
      "id, project_id, section_index, label, section_type, notes, status, raw_md, draft_md, final_md, created_at, updated_at",
    )
    .eq("tenant_id", context.tenant_id)
    .eq("project_id", projectId)
    .eq("label", "Harper Interview")
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    console.error("[Content] Error checking interview section", existingError);
  }

  if (existing) {
    const section = existing as ContentSection;
    if (section.section_index !== 0) {
      const { data: updated, error: updateError } = await supabase
        .from("content_sections")
        .update({ section_index: 0 })
        .eq("id", section.id)
        .eq("tenant_id", context.tenant_id)
        .select(
          "id, project_id, section_index, label, section_type, notes, status, raw_md, draft_md, final_md, created_at, updated_at",
        )
        .maybeSingle();

      if (!updateError && updated) {
        return updated as ContentSection;
      }

      if (updateError) {
        console.error("[Content] Failed to update interview section_index", updateError);
      }
    }

    return section;
  }

  const { data, error } = await supabase
    .from("content_sections")
    .insert({
      tenant_id: context.tenant_id,
      project_id: projectId,
      label: "Harper Interview",
      section_index: 0,
    })
    .select(
      "id, project_id, section_index, label, section_type, notes, status, raw_md, draft_md, final_md, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create interview section");
  }

  return data as ContentSection;
}

export interface StartConversationParams {
  projectId: string;
  soundbyteId: string;
}

export async function startHarperConversation(
  params: StartConversationParams,
): Promise<HarperConversationState> {
  const section = await ensureInterviewSection(params.projectId);

  // Seed the first question locally for now; Gemini integration will replace this.
  const firstQuestionText =
    "Let's start with the big picture. What is this Content Blueprint really trying to help your reader change or achieve?";

  return {
    projectId: params.projectId,
    soundbyteId: params.soundbyteId,
    activeSectionId: section.id,
    currentQuestion: {
      id: "q-1",
      text: firstQuestionText,
      sectionId: section.id,
    },
    sections: [section],
  };
}

export interface SubmitAnswerParams {
  projectId: string;
  sectionId: string;
  previousQuestion: string;
  answer: string;
  contentKind: string;
  projectType: string;
}

export interface SubmitAnswerResult {
  nextQuestion: string | null;
  sections: ContentSection[];
}

export interface SubmitLiveVoiceParams {
  projectId: string;
  sectionId: string;
  audioBase64: string;
  previousQuestion?: string | null;
}

export interface SubmitLiveVoiceResult {
  transcript: string;
  nextQuestion: string | null;
}

export async function submitUserAnswer(
  params: SubmitAnswerParams,
): Promise<SubmitAnswerResult> {
  const sections = await getContentSections(params.projectId);

  try {
    const { data, error } = await supabase.functions.invoke("content-exchange-add", {
      body: {
        project_id: params.projectId,
        section_id: params.sectionId,
        answer_text: params.answer,
        previous_question: params.previousQuestion,
        content_kind: params.contentKind,
        project_type: params.projectType,
      },
    });

    if (error) {
      console.error("[Content] content-exchange-add error", error);
      return { nextQuestion: null, sections };
    }

    const payload = data as ContentExchangeAddResponse;
    return {
      nextQuestion: payload?.harper_exchange?.question_text ?? null,
      sections,
    };
  } catch (err) {
    console.error("[Content] Error calling content-exchange-add", err);
    return { nextQuestion: null, sections };
  }
}

export async function submitLiveVoiceTurn(params: SubmitLiveVoiceParams): Promise<SubmitLiveVoiceResult> {
  try {
    const { data, error } = await supabase.functions.invoke("harper-live-turn", {
      body: {
        project_id: params.projectId,
        section_id: params.sectionId,
        audio_base64: params.audioBase64,
        previous_question: params.previousQuestion ?? null,
      },
    });

    if (error) {
      console.error("[Content] harper-live-turn error", error);
      throw error;
    }

    const payload = (data as { transcript?: string; next_question?: string | null }) ?? {};
    return {
      transcript: payload.transcript ?? "",
      nextQuestion: payload.next_question ?? null,
    };
  } catch (err) {
    console.error("[Content] Error calling harper-live-turn", err);
    throw err;
  }
}

export async function deleteExchange(exchangeId: string): Promise<void> {
  const context = await getCurrentBohContext();
  if (!context) {
    throw new Error("No BOH tenant matched the current session.");
  }

  const { data: existing, error: loadError } = await supabase
    .from("content_exchanges")
    .select("id")
    .eq("id", exchangeId)
    .eq("tenant_id", context.tenant_id)
    .maybeSingle();

  if (loadError || !existing) {
    throw loadError ?? new Error("Content exchange not found for current tenant.");
  }

  const { error } = await supabase.rpc("delete_content_exchange", {
    p_exchange_id: exchangeId,
  });

  if (error) {
    if (import.meta.env.DEV) {
      console.error("[Content] delete_content_exchange error", error);
    }
    throw error ?? new Error("Failed to delete exchange");
  }
}

export async function fetchChapterExchanges(
  projectId: string,
  sectionId: string,
  limit = 20,
): Promise<ContentExchange[]> {
  const context = await getCurrentBohContext();
  if (!context) return [];

  const { data, error } = await supabase
    .from("content_exchanges")
    .select("id, project_id, section_id, sequence, role, question_text, answer_text, created_at")
    .eq("tenant_id", context.tenant_id)
    .eq("project_id", projectId)
    .eq("section_id", sectionId)
    .eq("is_hidden", false)
    .order("sequence", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[Content] Failed to load content_exchanges", error);
    return [];
  }

  return (data ?? []) as ContentExchange[];
}

export async function ensureHarperKickoffQuestion(args: {
  projectId: string;
  sectionId: string;
  firstQuestionText?: string;
  chapterLabel?: string | null;
  interviewerPrompt?: string | null;
}): Promise<string> {
  const context = await getCurrentBohContext();
  if (!context) {
    throw new Error("No BOH tenant matched the current session.");
  }

  const { projectId, sectionId, firstQuestionText, chapterLabel, interviewerPrompt } = args;

  const { data: existing, error: existingError } = await supabase
    .from("content_exchanges")
    .select("question_text")
    .eq("tenant_id", context.tenant_id)
    .eq("project_id", projectId)
    .eq("section_id", sectionId)
    .eq("is_hidden", false)
    .order("sequence", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    console.error("[Content] Failed to check existing exchanges", existingError);
  }

  if (existing?.question_text) {
    return existing.question_text;
  }

  const chapterSnippet = chapterLabel ? `For the chapter “${chapterLabel}”` : "For this chapter";
  const questionText =
    firstQuestionText ??
    `${chapterSnippet}, what should the reader think or do differently by the end?`;

  const promptToUse = (interviewerPrompt ?? DEFAULT_INTERVIEWER_PROMPT).trim();

  if (promptToUse.length > 0) {
    const { data: systemRow, error: systemError } = await supabase
      .from("content_exchanges")
      .select("id")
      .eq("tenant_id", context.tenant_id)
      .eq("project_id", projectId)
      .eq("section_id", sectionId)
      .eq("is_hidden", false)
      .eq("role", "system")
      .maybeSingle();

    if (!systemRow) {
      const { error: insertSystemError } = await supabase.from("content_exchanges").insert({
        tenant_id: context.tenant_id,
        project_id: projectId,
        section_id: sectionId,
        sequence: 0,
        role: "system",
        question_text: promptToUse,
      });

      if (insertSystemError) {
        console.error("[Content] Failed to insert interviewer prompt system exchange", insertSystemError);
      }
    } else if (systemError && systemError.code !== "PGRST116") {
      console.error("[Content] Failed checking system exchange", systemError);
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("content_exchanges")
    .insert({
      tenant_id: context.tenant_id,
      project_id: projectId,
      section_id: sectionId,
      sequence: 1,
      role: "interviewer",
      question_text: questionText,
    })
    .select("question_text")
    .single();

  if (insertError || !inserted) {
    console.error("[Content] Failed to insert kickoff question", insertError);
    throw insertError ?? new Error("Failed to seed kickoff question");
  }

  return (inserted as { question_text: string | null }).question_text ?? questionText;
}

export async function resetChapterInterview(projectId: string, sectionId: string): Promise<number> {
  const context = await getCurrentBohContext();
  if (!context) {
    throw new Error("No BOH tenant matched the current session.");
  }

  const { data: project, error: projectError } = await supabase
    .from("content_projects")
    .select("id")
    .eq("id", projectId)
    .eq("tenant_id", context.tenant_id)
    .maybeSingle();

  if (projectError || !project) {
    throw projectError ?? new Error("Content project not found for current tenant.");
  }

  const { data, error } = await supabase.rpc("reset_content_exchanges", {
    project_id: projectId,
    section_id: sectionId,
  });

  if (error) {
    console.error("[Content] Failed to reset chapter interview", error);
    throw error;
  }

  return ((data as ResetExchangesResponse)?.deleted_count ?? 0) as number;
}

export async function resetProjectInterview(projectId: string): Promise<number> {
  const context = await getCurrentBohContext();
  if (!context) {
    throw new Error("No BOH tenant matched the current session.");
  }

  const { data: project, error: projectError } = await supabase
    .from("content_projects")
    .select("id")
    .eq("id", projectId)
    .eq("tenant_id", context.tenant_id)
    .maybeSingle();

  if (projectError || !project) {
    throw projectError ?? new Error("Content project not found for current tenant.");
  }

  const { data, error } = await supabase.rpc("reset_content_exchanges", {
    project_id: projectId,
    section_id: null,
  });

  if (error) {
    console.error("[Content] Failed to reset project interview", error);
    throw error;
  }

  return ((data as ResetExchangesResponse)?.deleted_count ?? 0) as number;
}

export async function buildRawTranscript(projectId: string, sectionId: string): Promise<ContentSection> {
  const { data, error } = await supabase.functions.invoke("content-section-build-raw", {
    body: { project_id: projectId, section_id: sectionId },
  });

  if (error || !data?.section) {
    console.error("[Content] content-section-build-raw error", error);
    throw error ?? new Error("Failed to build raw transcript");
  }

  return (data as ContentSectionSingleResponse).section;
}

export async function generateChapterDraft(projectId: string, sectionId: string): Promise<ContentSection> {
  const { data, error } = await supabase.functions.invoke("content-section-generate-draft", {
    body: { project_id: projectId, section_id: sectionId },
  });

  if (error || !data?.section) {
    console.error("[Content] content-section-generate-draft error", error);
    throw error ?? new Error("Failed to generate chapter draft");
  }

  return (data as ContentSectionSingleResponse).section;
}

export async function compileBookDraft(projectId: string): Promise<{ project: ContentProject; compiled_draft_md: string }> {
  const { data, error } = await supabase.functions.invoke("content-project-compile-draft", {
    body: { project_id: projectId },
  });

  if (error || !data?.project) {
    console.error("[Content] content-project-compile-draft error", error);
    throw error ?? new Error("Failed to compile book draft");
  }

  const payload = data as ContentProjectCompileResponse;
  return { project: payload.project, compiled_draft_md: payload.compiled_draft_md };
}

export async function getContentSections(projectId: string): Promise<ContentSection[]> {
  const context = await getCurrentBohContext();
  if (!context) return [];

  const { data, error } = await supabase
    .from("content_sections")
    .select(
      "id, project_id, section_index, label, section_type, notes, status, raw_md, draft_md, final_md, created_at, updated_at",
    )
    .eq("tenant_id", context.tenant_id)
    .eq("project_id", projectId)
    .order("section_index", { ascending: true });

  if (error) {
    console.error("[Content] Failed to load content_sections", error);
    return [];
  }

  return (data ?? []) as ContentSection[];
}

export async function generateChapterQuestions(projectId: string): Promise<ContentSection[]> {
  // Placeholder: in a later phase, Gemini will design chapters. For now we
  // ensure there is at least a simple three-chapter outline.
  const baseTitles = ["Opening Chapter", "Middle Turning Point", "Final Chapter"];

  const existingSections = await getContentSections(projectId);
  if (existingSections.length > 0) {
    return existingSections;
  }

  const context = await getCurrentBohContext();
  if (!context) return [];

  const inserts = baseTitles.map((title, index) => ({
    tenant_id: context.tenant_id,
    project_id: projectId,
    label: title,
    section_index: index + 1,
  }));

  const { data, error } = await supabase
    .from("content_sections")
    .insert(inserts)
    .select(
      "id, project_id, section_index, label, section_type, notes, status, raw_md, draft_md, final_md, created_at, updated_at",
    );

  if (error) {
    console.error("[Content] Failed to seed chapter sections", error);
    return [];
  }

  return (data ?? []) as ContentSection[];
}

type ChapterMarkdownBlueprintShape = {
  title?: string | null;
  project_title?: string | null;
  projectTitle?: string | null;
  name?: string | null;
  subtitle?: string | null;
};

export function buildChapterMarkdown(blueprint: ChapterMarkdownBlueprintShape, sections: ContentSection[]): string {
  const lines: string[] = [];

  const resolvedTitle =
    blueprint.title ??
    blueprint.project_title ??
    blueprint.projectTitle ??
    blueprint.name ??
    null;
  if (resolvedTitle) {
    lines.push(`# ${resolvedTitle}`);
  }

  if (blueprint.subtitle) {
    lines.push("", `## ${blueprint.subtitle}`);
  }

  const sorted = [...sections].sort((a, b) => a.section_index - b.section_index);

  for (const section of sorted) {
    lines.push("", `### ${section.label}`);
    const description = (section as any).description ?? null;
    if (description) {
      lines.push("", String(description));
    }
  }

  return lines.join("\n");
}

function mapDraftRow(row: any): ContentDraft {
	return {
		id: row.id,
		blueprintId: row.blueprint_id,
		sectionId: row.section_id,
		version: row.version,
		status: row.status as ContentDraft["status"],
		source: row.source as ContentDraft["source"],
		title: row.title ?? null,
		contentMd: row.content_md,
		isCurrent: row.is_current,
		createdAt: row.created_at,
	};
}

export async function getLatestDraftForBlueprint(blueprintId: string): Promise<ContentDraft | null> {
	const context = await getCurrentBohContext();
	if (!context) return null;

	const { data, error } = await supabase
		.from("content_draft")
		.select(
			"id, blueprint_id, section_id, version, status, source, title, content_md, is_current, created_at",
		)
		.eq("tenant_id", context.tenant_id)
		.eq("blueprint_id", blueprintId)
		.eq("is_current", true)
		.is("section_id", null)
		.maybeSingle();

	if (error && error.code !== "PGRST116") {
		console.error("[Content] Failed to load latest draft", error);
		return null;
	}

	if (!data) return null;

	return mapDraftRow(data);
}

interface SaveChapterDraftParams {
	blueprintId: string;
	title: string | null;
	contentMd: string;
	source?: "raw" | "ai_polished" | "manual_edit" | "imported";
	sectionId?: string | null;
}

export async function saveChapterDraft(params: SaveChapterDraftParams): Promise<ContentDraft> {
	const context = await getCurrentBohContext();
	if (!context) {
		throw new Error("No BOH tenant matched the current session.");
	}

	const {
		blueprintId,
		title,
		contentMd,
		source = "manual_edit",
		sectionId = null,
	} = params;

	// Step 1: determine next version
	const { data: existingVersions, error: versionError } = await supabase
		.from("content_draft")
		.select("version")
		.eq("tenant_id", context.tenant_id)
		.eq("blueprint_id", blueprintId)
		.eq("section_id", sectionId)
		.order("version", { ascending: false })
		.limit(1);

	if (versionError) {
		console.error("[Content] Failed to look up draft version", versionError);
		throw versionError;
	}

	const nextVersion = existingVersions && existingVersions.length > 0
		? (existingVersions[0].version as number) + 1
		: 1;

	// Step 2: mark existing drafts as not current
	const { error: clearError } = await supabase
		.from("content_draft")
		.update({ is_current: false })
		.eq("tenant_id", context.tenant_id)
		.eq("blueprint_id", blueprintId)
		.eq("section_id", sectionId);

	if (clearError) {
		console.error("[Content] Failed to clear existing current drafts", clearError);
		throw clearError;
	}

	// Step 3: insert new draft
	const { data: insertData, error: insertError } = await supabase
		.from("content_draft")
		.insert({
			tenant_id: context.tenant_id,
			blueprint_id: blueprintId,
			section_id: sectionId,
			version: nextVersion,
			status: "draft",
			source,
			title,
			content_md: contentMd,
			is_current: true,
		})
		.select("id, blueprint_id, section_id, version, status, source, title, content_md, is_current, created_at")
		.single();

	if (insertError || !insertData) {
		console.error("[Content] Failed to insert chapter draft", insertError);
		throw insertError ?? new Error("Unable to save draft");
	}

	return mapDraftRow(insertData);
}

export type StoryboardExchangePayload = {
  project_id: string;
  section_id?: string | null;
  sequence: number;
  role: "system" | "interviewer" | "user" | "ai";
  question_text?: string;
  answer_text?: string;
  content_kind?: "book" | "blog" | "landing_page";
  project_type?: "book" | "long_article" | "landing_page" | "email_sequence" | "whitepaper" | "webinar_script";
};

export async function saveStoryboardExchange(payload: StoryboardExchangePayload) {
  const { data, error } = await supabase.functions.invoke("storyboard-save-exchange", {
    body: payload,
  });

  if (error) {
    console.error("saveStoryboardExchange error", error);
    throw error;
  }

  return (data as any)?.exchange;
}

export type StoryboardDraftPayload = {
  blueprint_id: string;
  section_id?: string | null;
  title?: string;
  content_md: string;
  source?: "raw" | "ai_polished" | "manual_edit" | "imported";
   content_kind?: "book" | "blog" | "landing_page";
   project_type?: "book" | "long_article" | "landing_page" | "email_sequence" | "whitepaper" | "webinar_script";
};

export async function saveStoryboardDraft(payload: StoryboardDraftPayload) {
  const { data, error } = await supabase.functions.invoke("storyboard-save-draft", {
    body: payload,
  });

  if (error) {
    console.error("saveStoryboardDraft error", error);
    throw error;
  }

  return (data as any)?.draft;
}

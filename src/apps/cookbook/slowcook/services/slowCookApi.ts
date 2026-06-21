import { supabase } from "../../../../lib/supabase";
import { getCurrentBohUserId } from "../../../../boh/api/bohApi";
import type { ContentProject, ContentSection } from "../../types/content";

const SLOW_COOK_TYPES = [
  "book",
  "long_article",
  "landing_page",
  "email_sequence",
  "whitepaper",
  "webinar_script",
] as const;

export type SlowCookProjectType = (typeof SLOW_COOK_TYPES)[number];

export async function fetchSlowCookProjects(): Promise<ContentProject[]> {
  const ownerId = await getCurrentBohUserId();
  if (!ownerId) {
    console.error("[Content] Unable to determine BOH user for Slow Cook projects");
    return [];
  }

  const { data, error } = await supabase
    .from("content_projects")
    .select(
      "id, title, subtitle, content_type, status, created_at, updated_at, soundbyte_id, audience_variant_id, reference_md",
    )
    .eq("owner_user_id", ownerId)
    .eq("app_context", "boh")
    .in("content_type", SLOW_COOK_TYPES as unknown as string[])
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[Content] Failed to load Slow Cook projects", error);
    return [];
  }

  return (data ?? []) as ContentProject[];
}

export async function fetchProjectSections(projectId: string): Promise<ContentSection[]> {
  const { data, error } = await supabase
    .from("content_sections")
    .select(
      "id, project_id, section_index, label, section_type, notes, status, raw_md, draft_md, final_md, created_at, updated_at",
    )
    .eq("project_id", projectId)
    .order("section_index", { ascending: true });

  if (error) {
    console.error("[Content] Failed to load project sections", error);
    return [];
  }

  return (data ?? []) as ContentSection[];
}

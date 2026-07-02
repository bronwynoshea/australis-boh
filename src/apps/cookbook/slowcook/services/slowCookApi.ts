import { supabase } from "../../../../lib/supabase";
import { getCurrentBohUserContext } from "../../../../boh/api/bohApi";
import type { ContentProject, ContentSection } from "../../types/content";

async function getCurrentBohContext(): Promise<{ id: string; tenant_id: string } | null> {
  const context = await getCurrentBohUserContext();
  if (!context?.id || !context?.tenant_id) {
    console.error("[Content] Unable to determine BOH tenant context");
    return null;
  }
  return context;
}

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
  const context = await getCurrentBohContext();
  if (!context) {
    return [];
  }

  const { data, error } = await supabase
    .from("content_projects")
    .select(
      "id, title, subtitle, content_type, status, created_at, updated_at, soundbyte_id, audience_variant_id, reference_md",
    )
    .eq("tenant_id", context.tenant_id)
    .eq("owner_user_id", context.id)
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
    console.error("[Content] Failed to load project sections", error);
    return [];
  }

  return (data ?? []) as ContentSection[];
}

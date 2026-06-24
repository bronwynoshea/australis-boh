import { supabase } from "../../../../lib/supabase";
import { getCurrentBohUserContext } from "../../../../boh/api/bohApi";
import type {
  SoundbyteProfile,
  SoundbyteAudience,
  AIPersona,
  AIKnowledgePack,
} from "../types/pantry";

async function getCurrentTenantId(): Promise<string | null> {
  const context = await getCurrentBohUserContext();
  if (!context?.tenant_id) {
    console.error("[Pantry] Unable to determine BOH tenant context");
    return null;
  }
  return context.tenant_id;
}

/**
 * Soundbytes
 */
export const listSoundbytes = async (): Promise<SoundbyteProfile[]> => {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return [];

  const { data, error } = await supabase
    .from("soundbyte_profiles")
    .select(
      "id, name, level, ppr_problem, ppr_person, ppr_result, hole_we_own, core_soundbyte, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("app_context", "boh")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Pantry] Failed to load soundbytes", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name ?? "Untitled soundbyte",
    level: row.level ?? "",
    pprProblem: row.ppr_problem ?? "",
    pprProduct: row.ppr_person ?? "",
    pprResult: row.ppr_result ?? "",
    holeWeOwn: row.hole_we_own ?? "",
    coreSoundbyte: row.core_soundbyte ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

/**
 * Soundbyte audiences
 * (simple list from DB; you can extend this later)
 */
export const listSoundbyteAudiences = async (): Promise<SoundbyteAudience[]> => {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return [];

  const { data, error } = await supabase
    .from("soundbyte_profile_audiences")
    .select(
      "id, soundbyte_id, label, persona_description, key_pain_points, key_desired_results, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Pantry] Failed to load soundbyte audiences", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    soundbyteId: row.soundbyte_id,
    label: row.label ?? "",
    personaDescription: row.persona_description ?? "",
    keyPainPoints: row.key_pain_points ?? "",
    keyDesiredResults: row.key_desired_results ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

/**
 * AI Personas
 */
export const listAIPersonas = async (): Promise<AIPersona[]> => {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return [];

  const { data, error } = await supabase
    .from("ai_personas")
    .select("id, name, role_label, description, default_model, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("app_context", "boh")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Pantry] Failed to load AI personas", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name ?? "Untitled persona",
    role: row.role_label ?? "",
    description: row.description ?? "",
    defaultModel: row.default_model ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

/**
 * Knowledge packs
 */
export const listKnowledgePacks = async (): Promise<AIKnowledgePack[]> => {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return [];

  const { data, error } = await supabase
    .from("ai_knowledge_packs")
    .select("id, name, description, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .eq("app_context", "boh")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Pantry] Failed to load knowledge packs", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name ?? "Untitled pack",
    description: row.description ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};
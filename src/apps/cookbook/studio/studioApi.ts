import { getCurrentBohUserContext } from "../../../boh/api/bohApi";
import { supabase } from "../../../lib/supabase";
import { createHtmlStarter } from "./generateStarter";
import type {
  CookbookAsset,
  CookbookAssetFile,
  CookbookAssetMessage,
  CookbookAssetVersion,
  CookbookAssetWorkspace,
  CookbookReviewState,
} from "./types";

async function requireContext() {
  const context = await getCurrentBohUserContext();
  if (!context?.id || !context.tenant_id) throw new Error("Your BOH profile is not connected to an active company.");
  return context;
}

function fail(error: { message: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

export async function listCookbookAssets(): Promise<CookbookAsset[]> {
  const context = await requireContext();
  const { data, error } = await supabase.from("cookbook_asset").select("*")
    .eq("tenant_id", context.tenant_id).neq("status", "archived").order("updated_at", { ascending: false });
  fail(error, "Unable to load assets.");
  return (data ?? []) as CookbookAsset[];
}

export async function createCookbookAsset(title: string): Promise<CookbookAsset> {
  const context = await requireContext();
  const cleanTitle = title.trim() || "Untitled web page";
  const { data, error } = await supabase.from("cookbook_asset").insert({
    tenant_id: context.tenant_id, title: cleanTitle, asset_type: "web_page",
    created_by: context.id, updated_by: context.id,
  }).select("*").single();
  fail(error, "Unable to create asset.");
  const asset = data as CookbookAsset;
  const { error: fileError } = await supabase.from("cookbook_asset_file").insert({
    tenant_id: context.tenant_id, asset_id: asset.id, path: "index.html", mime_type: "text/html",
    content: createHtmlStarter(""), updated_by: context.id,
  });
  if (fileError) {
    await supabase.from("cookbook_asset").delete().eq("id", asset.id).eq("tenant_id", context.tenant_id);
    fail(fileError, "Unable to create the working file.");
  }
  return asset;
}

export async function loadCookbookAssetWorkspace(assetId: string): Promise<CookbookAssetWorkspace> {
  const context = await requireContext();
  const [files, messages, versions] = await Promise.all([
    supabase.from("cookbook_asset_file").select("*").eq("tenant_id", context.tenant_id).eq("asset_id", assetId).order("path"),
    supabase.from("cookbook_asset_message").select("id, asset_id, role, content, created_at").eq("tenant_id", context.tenant_id).eq("asset_id", assetId).order("created_at"),
    supabase.from("cookbook_asset_version").select("*").eq("tenant_id", context.tenant_id).eq("asset_id", assetId).order("version_number", { ascending: false }),
  ]);
  fail(files.error, "Unable to load working files."); fail(messages.error, "Unable to load messages."); fail(versions.error, "Unable to load versions.");
  return { files: (files.data ?? []) as CookbookAssetFile[], messages: (messages.data ?? []) as CookbookAssetMessage[], versions: (versions.data ?? []) as CookbookAssetVersion[] };
}

export async function applyCookbookInstruction(assetId: string, instruction: string): Promise<string> {
  const context = await requireContext();
  const cleanInstruction = instruction.trim();
  if (!cleanInstruction) throw new Error("Enter an instruction first.");
  const html = createHtmlStarter(cleanInstruction);
  const { error: userError } = await supabase.from("cookbook_asset_message").insert({ tenant_id: context.tenant_id, asset_id: assetId, role: "user", content: cleanInstruction, created_by: context.id });
  fail(userError, "Unable to save your instruction.");
  const assistantMessage = "I created a bounded static HTML starter from your instruction. Review the preview or edit index.html before saving a version.";
  const { error: assistantError } = await supabase.from("cookbook_asset_message").insert({ tenant_id: context.tenant_id, asset_id: assetId, role: "assistant", content: assistantMessage, created_by: context.id });
  fail(assistantError, "Unable to save the assistant response.");
  const { error: fileError } = await supabase.from("cookbook_asset_file").upsert({ tenant_id: context.tenant_id, asset_id: assetId, path: "index.html", mime_type: "text/html", content: html, updated_by: context.id }, { onConflict: "asset_id,path" });
  fail(fileError, "Unable to save generated HTML.");
  await supabase.from("cookbook_asset").update({ updated_by: context.id }).eq("id", assetId).eq("tenant_id", context.tenant_id);
  return html;
}

export async function saveCookbookWorkingFile(file: CookbookAssetFile, content: string): Promise<void> {
  const context = await requireContext();
  const { error } = await supabase.from("cookbook_asset_file").update({ content, updated_by: context.id })
    .eq("id", file.id).eq("asset_id", file.asset_id).eq("tenant_id", context.tenant_id);
  fail(error, "Unable to save the working draft.");
  await supabase.from("cookbook_asset").update({ updated_by: context.id }).eq("id", file.asset_id).eq("tenant_id", context.tenant_id);
}

export async function createCookbookVersion(assetId: string, summary: string): Promise<CookbookAssetVersion> {
  const context = await requireContext();
  const workspace = await loadCookbookAssetWorkspace(assetId);
  if (!workspace.files.length) throw new Error("Add a working file before saving a version.");
  const nextNumber = (workspace.versions[0]?.version_number ?? 0) + 1;
  const snapshot = workspace.files.map(({ path, content, mime_type }) => ({ path, content, mime_type }));
  const { data, error } = await supabase.from("cookbook_asset_version").insert({
    tenant_id: context.tenant_id, asset_id: assetId, version_number: nextNumber,
    file_snapshot: snapshot, change_summary: summary.trim() || `Saved working draft as version ${nextNumber}`,
    provenance: { generator: "bounded_cookbook_assistant" }, created_by: context.id,
  }).select("*").single();
  fail(error, "Unable to create the version snapshot.");
  const version = data as CookbookAssetVersion;
  const { error: assetError } = await supabase.from("cookbook_asset").update({ current_version_id: version.id, updated_by: context.id }).eq("id", assetId).eq("tenant_id", context.tenant_id);
  fail(assetError, "Version saved, but the current version could not be selected.");
  return version;
}

export async function setCookbookReviewState(assetId: string, reviewState: CookbookReviewState): Promise<void> {
  const context = await requireContext();
  const status = reviewState === "approved" ? "approved" : reviewState === "ready" ? "in_review" : "draft";
  const { error } = await supabase.from("cookbook_asset").update({ review_state: reviewState, status, updated_by: context.id })
    .eq("id", assetId).eq("tenant_id", context.tenant_id);
  fail(error, "Unable to update review status.");
}

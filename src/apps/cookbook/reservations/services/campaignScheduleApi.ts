import { supabase } from "../../../../lib/supabase";
import { getCurrentBohUserContext } from "../../../../boh/api/bohApi";
import type { BonusTierFormRow } from "../types/reservations";

async function getCurrentTenantId(): Promise<string> {
  const context = await getCurrentBohUserContext();
  if (!context?.tenant_id) {
    throw new Error("No BOH tenant matched the current session.");
  }
  return context.tenant_id;
}

export type CampaignStatus = "draft" | "active";

export type CampaignRow = {
  id: string;
  location: string;
  headline: string | null;
  body: string | null;
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  status: CampaignStatus;
  slug: string | null;
};

export interface CampaignScheduleFormLike {
  id?: string;
  slug: string;
  headline: string;
  body: string;
  enabled: boolean;
  status: CampaignStatus;
  starts_at: string | null;
  ends_at: string | null;
}

export async function loadCampaigns(location: string): Promise<CampaignRow[]> {
  const tenantId = await getCurrentTenantId();
  const { data, error } = await supabase
    .from("boh_campaign_banner")
    .select(
      "id, location, headline, body, enabled, starts_at, ends_at, status, slug, bonus_type, bonus_percent, queue_priority_label",
    )
    .eq("tenant_id", tenantId)
    .eq("location", location)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[campaignScheduleApi] Error loading campaigns", error);
    throw new Error("Unable to load campaigns");
  }

  return (data ?? []) as CampaignRow[];
}

export async function loadBonusTiers(campaignId: string): Promise<BonusTierFormRow[]> {
  const tenantId = await getCurrentTenantId();
  const { data, error } = await supabase
    .from("boh_campaign_bonus_tier")
    .select("id, label, tier_date, bonus_percent, tier_order, type")
    .eq("tenant_id", tenantId)
    .eq("campaign_id", campaignId)
    .order("tier_date", { ascending: true })
    .order("tier_order", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[campaignScheduleApi] Error loading bonus tiers", error);
    throw new Error("Unable to load daily bonus tiers");
  }

  return (data ?? []).map((row: any, index: number) => ({
    id: row.id,
    label: row.label ?? "",
    tier_date: row.tier_date,
    bonus_percent: row.bonus_percent ?? null,
    tier_order: row.tier_order ?? index + 1,
    type: row.type ?? null,
  }));
}

export interface SaveCampaignResult {
  saved: CampaignRow;
}

export async function saveCampaignWithTiers(
  form: CampaignScheduleFormLike,
  bonusTiers: BonusTierFormRow[],
  location: string,
): Promise<SaveCampaignResult> {
  const tenantId = await getCurrentTenantId();
  const payload: Partial<CampaignRow> = {
    slug: form.slug.trim(),
    headline: form.headline.trim(),
    body: form.body.trim() || null,
    enabled: form.enabled,
    status: form.status,
    starts_at: form.starts_at,
    ends_at: form.ends_at,
    location,
  };

  const isActive = form.status === "active";

  if (isActive && form.id) {
    // Ensure only one active campaign per location
    await supabase
      .from("boh_campaign_banner")
      .update({ status: "draft" })
      .eq("tenant_id", tenantId)
      .eq("location", location)
      .neq("id", form.id);
  }

  let upsertResult;
  if (form.id) {
    upsertResult = await supabase
      .from("boh_campaign_banner")
      .update(payload)
      .eq("id", form.id)
      .eq("tenant_id", tenantId)
      .select()
      .maybeSingle();
  } else {
    upsertResult = await supabase
      .from("boh_campaign_banner")
      .insert({ ...payload, tenant_id: tenantId })
      .select()
      .maybeSingle();
  }

  if (upsertResult.error || !upsertResult.data) {
    console.error("[campaignScheduleApi] Error saving campaign", upsertResult.error);
    throw new Error("Unable to save campaign");
  }

  const saved = upsertResult.data as CampaignRow;

  if (saved.id) {
    const { error: deleteError } = await supabase
      .from("boh_campaign_bonus_tier")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("campaign_id", saved.id);

    if (deleteError) {
      console.error("[campaignScheduleApi] Error clearing existing tiers", deleteError);
    } else if (bonusTiers.length > 0) {
      const rowsToInsert = bonusTiers
        .filter((t) => t.tier_date && t.bonus_percent !== null)
        .map((t, index) => ({
          tenant_id: tenantId,
          campaign_id: saved.id,
          tier_date: t.tier_date,
          label: t.label.trim(),
          bonus_percent: t.bonus_percent ?? 0,
          tier_order: index + 1,
          type: t.type ?? null,
        }));

      if (rowsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("boh_campaign_bonus_tier")
          .insert(rowsToInsert);
        if (insertError) {
          console.error("[campaignScheduleApi] Error inserting tiers", insertError);
        }
      }
    }
  }

  return { saved };
}

export interface ScheduleUpdateInput {
  id: string;
  enabled: boolean;
  status: CampaignStatus;
  starts_at: string | null;
  ends_at: string | null;
}

export async function updateScheduleAndTiers(
  schedule: ScheduleUpdateInput,
  bonusTiers: BonusTierFormRow[],
): Promise<SaveCampaignResult> {
  const tenantId = await getCurrentTenantId();
  const { id, enabled, status, starts_at, ends_at } = schedule;

  // Load existing campaign so we preserve slug/headline/body/location
  const { data: existing, error: loadError } = await supabase
    .from("boh_campaign_banner")
    .select("id, location, slug, headline, body")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (loadError || !existing) {
    console.error("[campaignScheduleApi] Error loading existing campaign for schedule update", loadError);
    throw new Error("Unable to load campaign for schedule update");
  }

  const location = existing.location as string;

  const payload: Partial<CampaignRow> = {
    slug: existing.slug ?? null,
    headline: existing.headline ?? null,
    body: existing.body ?? null,
    enabled,
    status,
    starts_at,
    ends_at,
    location,
  };

  // Ensure only one active campaign per location
  const isActive = status === "active";
  if (isActive) {
    await supabase
      .from("boh_campaign_banner")
      .update({ status: "draft" })
      .eq("tenant_id", tenantId)
      .eq("location", location)
      .neq("id", id);
  }

  const { data: updated, error: updateError } = await supabase
    .from("boh_campaign_banner")
    .update(payload)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .maybeSingle();

  if (updateError || !updated) {
    console.error("[campaignScheduleApi] Error updating schedule", updateError);
    throw new Error("Unable to update campaign schedule");
  }

  const saved = updated as CampaignRow;

  // Resync tiers
  const { error: deleteError } = await supabase
    .from("boh_campaign_bonus_tier")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("campaign_id", id);

  if (deleteError) {
    console.error("[campaignScheduleApi] Error clearing existing tiers", deleteError);
  } else if (bonusTiers.length > 0) {
    const rowsToInsert = bonusTiers
      .filter((t) => t.tier_date && t.bonus_percent !== null)
      .map((t, index) => ({
        tenant_id: tenantId,
        campaign_id: id,
        tier_date: t.tier_date,
        label: t.label.trim(),
        bonus_percent: t.bonus_percent ?? 0,
        tier_order: index + 1,
        type: t.type ?? null,
      }));

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("boh_campaign_bonus_tier")
        .insert(rowsToInsert);
      if (insertError) {
        console.error("[campaignScheduleApi] Error inserting tiers in schedule update", insertError);
      }
    }
  }

  return { saved };
}

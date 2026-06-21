import type { CampaignBanner, CampaignBonusTier } from "../types/reservations";
import { loadBonusTiers, loadCampaigns } from "./campaignScheduleApi";

const LANDING_PAGES = ["sunset-hero", "pioneer-offer"] as const;

export const listReservations = async (): Promise<CampaignBanner[]> => {
  const all: CampaignBanner[] = [];

  for (const location of LANDING_PAGES) {
    const rows = await loadCampaigns(location);
    rows.forEach((row) => {
      all.push({
        id: row.id,
        location: row.location,
        headline: row.headline,
        body: row.body,
        enabled: row.enabled,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        status: row.status,
        slug: row.slug,
      });
    });
  }

  return all;
};

export const listBonusTiers = async (): Promise<CampaignBonusTier[]> => {
  // For now, load tiers for the first available campaign across our landing pages.
  for (const location of LANDING_PAGES) {
    const rows = await loadCampaigns(location);
    if (rows.length === 0) continue;

    const active = rows.find((c) => c.status === "active" && c.enabled) ?? rows[0];
    const tiers = await loadBonusTiers(active.id);

    return tiers.map((tier) => ({
      id: tier.id ?? `${active.id}-${tier.tier_date}`,
      campaign_id: active.id,
      label: tier.label,
      tier_date: tier.tier_date,
      bonus_percent: tier.bonus_percent,
      tier_order: tier.tier_order,
      type: tier.type,
    }));
  }

  return [];
};

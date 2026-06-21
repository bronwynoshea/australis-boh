export interface CampaignBanner {
  id: string;
  location: string;
  headline: string | null;
  body: string | null;
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
  status: "draft" | "active";
  slug: string | null;
}

export interface CampaignBonusTier {
  id: string;
  campaign_id: string;
  label: string;
  tier_date: string; // YYYY-MM-DD
  bonus_percent: number | null;
  tier_order: number | null;
  type?: string | null;
}

export type CampaignStatus = "draft" | "active";

export interface CampaignScheduleForm {
  id?: string;
  enabled: boolean;
  status: CampaignStatus;
  starts_at: string | null; // ISO string suitable for datetime-local
  ends_at: string | null; // ISO string
}

export interface BonusTierFormRow {
  id?: string;
  label: string;
  tier_date: string; // YYYY-MM-DD
  bonus_percent: number | null;
  tier_order: number;
  type?: string | null;
}

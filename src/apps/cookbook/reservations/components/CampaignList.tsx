import React from "react";
import type { CampaignBanner, CampaignBonusTier } from "../types/reservations";

interface CampaignListProps {
  campaigns: CampaignBanner[];
  tiers: CampaignBonusTier[];
}

const CampaignList: React.FC<CampaignListProps> = ({ campaigns, tiers }) => {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Campaigns</h2>
      <div className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg overflow-hidden">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-boh-bg-light/60 dark:bg-boh-bg/80">
            <tr>
              <th className="px-3 py-2 font-medium text-boh-text-sub-light dark:text-boh-text-sub">Campaign</th>
              <th className="px-3 py-2 font-medium text-boh-text-sub-light dark:text-boh-text-sub">Status</th>
              <th className="px-3 py-2 font-medium text-boh-text-sub-light dark:text-boh-text-sub">Days</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => {
              const dayCount = tiers.filter((tier) => tier.campaign_id === campaign.id).length;
              return (
                <tr key={campaign.id} className="border-t border-boh-border-light/60 dark:border-boh-border">
                  <td className="px-3 py-2 text-boh-text-light dark:text-boh-text">
                    {campaign.headline ?? campaign.slug ?? "Untitled"}
                  </td>
                  <td className="px-3 py-2 text-boh-text-sub-light dark:text-boh-text-sub">
                    {campaign.status}
                  </td>
                  <td className="px-3 py-2 text-boh-text-sub-light dark:text-boh-text-sub">{dayCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default CampaignList;

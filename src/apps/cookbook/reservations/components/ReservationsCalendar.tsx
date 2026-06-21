import React from "react";
import type { CampaignBanner } from "../types/reservations";

interface ReservationsCalendarProps {
  items: CampaignBanner[];
}

const ReservationsCalendar: React.FC<ReservationsCalendarProps> = ({ items }) => {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Calendar</h2>
      <div className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-3 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
        <p className="mb-2">Upcoming campaign windows (mocked):</p>
        <ul className="space-y-1">
          {items.map((campaign) => (
            <li key={campaign.id} className="flex items-center justify-between">
              <span className="font-medium text-boh-text-light dark:text-boh-text">
                {campaign.headline ?? campaign.slug ?? "Untitled campaign"}
              </span>
              <span>
                {campaign.starts_at ? new Date(campaign.starts_at).toLocaleDateString() : "TBC"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default ReservationsCalendar;

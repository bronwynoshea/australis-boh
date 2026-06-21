import React, { useEffect, useState } from "react";
import ReservationsCalendar from "./components/ReservationsCalendar";
import CampaignList from "./components/CampaignList";
import CampaignScheduleEditor from "./components/CampaignScheduleEditor";
import { listReservations, listBonusTiers } from "./services/reservationsApi";
import type { CampaignBanner, CampaignBonusTier } from "./types/reservations";

const ReservationsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<CampaignBanner[]>([]);
  const [tiers, setTiers] = useState<CampaignBonusTier[]>([]);

  useEffect(() => {
    void (async () => {
      const [c, t] = await Promise.all([listReservations(), listBonusTiers()]);
      setCampaigns(c);
      setTiers(t);
    })();
  }, []);

  return (
    <div className="min-h-full w-full px-4 py-6 lg:px-8 lg:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Reservations</h1>
        <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          Plan when campaigns and content go live.
        </p>
      </header>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)] lg:grid-cols-1">
        <div className="space-y-6">
          <ReservationsCalendar items={campaigns} />
          <CampaignList campaigns={campaigns} tiers={tiers} />
        </div>
        <CampaignScheduleEditor />
      </div>
    </div>
  );
};

export default ReservationsPage;

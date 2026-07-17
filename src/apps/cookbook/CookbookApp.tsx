import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { BOHShell, bohApps } from "../../boh/navigation";
import PantryPage from "./pantry/PantryPage";
import SoundbyteManagerPage from "./pantry/pages/SoundbyteManagerPage";
import QuickServePage from "./quickserve/QuickServePage";
import ReservationsPage from "./reservations/ReservationsPage";
import RecipesPage from "./recipes/RecipesPage";
import SlowCookPage from "./slowcook/SlowCookPage";
import CookbookHomePage from "./CookbookHomePage";
import AssetStudioPage from "./studio/AssetStudioPage";

interface CookbookAppProps {
  isAdmin?: boolean;
}

// Mobile header component for Cookbook
const CookbookMobileHeader: React.FC = () => (
  <header className="lg:hidden flex items-center justify-between p-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
    <div>
      <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Library</p>
      <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Cookbook</h1>
      <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Playbooks and assets</p>
    </div>
  </header>
);

// Desktop page header for Cookbook
const CookbookPageHeader: React.FC = () => (
  <div className="hidden lg:block mb-6">
    <div>
      <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">Library</p>
      <h1 className="text-3xl font-semibold text-boh-text-light dark:text-boh-text">Cookbook</h1>
      <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">Playbooks and assets</p>
    </div>
  </div>
);

const CookbookApp: React.FC<CookbookAppProps> = ({ isAdmin = false }) => {
  const location = useLocation();
  const isStudio = location.pathname.startsWith("/cookbook/studio");
  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} mobileHeader={<CookbookMobileHeader />}>
      {!isStudio && <CookbookPageHeader />}
      <Routes>
        <Route index element={<Navigate to="/cookbook/dashboard" replace />} />
        <Route path="dashboard" element={<CookbookHomePage />} />
        <Route path="pantry" element={<PantryPage />} />
        <Route path="pantry/soundbytes" element={<SoundbyteManagerPage />} />
        <Route path="pantry/soundbytes/:soundbyteId" element={<SoundbyteManagerPage />} />
        <Route path="quickserve" element={<QuickServePage />} />
        <Route path="slowcook" element={<SlowCookPage />} />
        <Route path="slow-cook" element={<SlowCookPage />} />
        <Route path="reservations" element={<ReservationsPage />} />
        <Route path="recipes" element={<RecipesPage />} />
        <Route path="studio" element={<AssetStudioPage />} />
        <Route path="*" element={<Navigate to="/cookbook/dashboard" replace />} />
      </Routes>
    </BOHShell>
  );
};

export default CookbookApp;


import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { BOHShell, bohApps } from '../../boh/navigation';
import FunnelPipelinePage from './pages/FunnelPipelinePage';
import FunnelStagesPage from './pages/FunnelStagesPage';

interface FunnelAppProps {
  isAdmin?: boolean;
}

const FunnelMobileHeader: React.FC = () => (
  <header className="flex items-center justify-between border-b border-boh-border-light bg-boh-surface-light p-4 dark:border-boh-border dark:bg-boh-surface lg:hidden">
    <div>
      <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Growth</p>
      <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Funnel</h1>
      <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Journeys and Opportunities</p>
    </div>
  </header>
);

const FunnelPageHeader: React.FC = () => (
  <div className="mb-6 hidden lg:block">
    <p className="mb-1 text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Growth</p>
    <h1 className="text-3xl font-semibold text-boh-text-light dark:text-boh-text">Funnel</h1>
    <p className="mt-1 text-boh-text-sub-light dark:text-boh-text-sub">Customer journeys, sales milestones, and conversion readiness</p>
  </div>
);

const FunnelApp: React.FC<FunnelAppProps> = ({ isAdmin = false }) => (
  <BOHShell apps={bohApps} isAdmin={isAdmin} mobileHeader={<FunnelMobileHeader />}>
    <FunnelPageHeader />
    <Routes>
      <Route index element={<Navigate to="/funnel/pipeline" replace />} />
      <Route path="pipeline" element={<FunnelPipelinePage />} />
      <Route path="stages" element={<FunnelStagesPage />} />
      <Route path="*" element={<Navigate to="/funnel/pipeline" replace />} />
    </Routes>
  </BOHShell>
);

export default FunnelApp;

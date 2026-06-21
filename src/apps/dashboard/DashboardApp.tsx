import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BOHShell, bohApps } from '../../boh/navigation';
import DashboardPage from '../boh/pages/DashboardPage';
import TeamAccessPage from '../boh/pages/TeamAccessPage';
import BohSettingsProfilePage from '../boh/pages/BohSettingsProfilePage';

interface DashboardAppProps {
  isAdmin?: boolean;
}

// Desktop page header for Dashboard
const DashboardPageHeader: React.FC = () => (
  <div className="hidden lg:block mb-6">
    <div>
      <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">Home</p>
      <h1 className="text-3xl font-semibold text-boh-text-light dark:text-boh-text">BOH Dashboard</h1>
      <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">Overview and quick access</p>
    </div>
  </div>
);

const DashboardApp: React.FC<DashboardAppProps> = ({ isAdmin = false }) => {
  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} isDashboardMode={true}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="access" element={<TeamAccessPage />} />
        <Route path="settings" element={<BohSettingsProfilePage />} />
        <Route path="*" element={<Navigate to="/boh" replace />} />
      </Routes>
    </BOHShell>
  );
};

export default DashboardApp;

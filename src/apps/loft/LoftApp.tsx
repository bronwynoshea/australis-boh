import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BOHShell } from '../../boh/navigation';
import { bohApps } from '../../boh/navigation/appConfigs';
import LoftDashboardPage from './pages/LoftDashboardPage';

interface LoftAppProps {
  isAdmin?: boolean;
}

const LoftApp: React.FC<LoftAppProps> = ({ isAdmin = false }) => {
  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin}>
      <Routes>
        <Route index element={<LoftDashboardPage />} />
        <Route path="personal-room" element={<LoftDashboardPage />} />
        <Route path="*" element={<Navigate to="/loft" replace />} />
      </Routes>
    </BOHShell>
  );
};

export default LoftApp;

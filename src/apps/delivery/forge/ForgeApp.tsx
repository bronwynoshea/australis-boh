import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BOHShell, bohApps } from '../../../boh/navigation';
import ForgeManagement from './pages/ForgeManagementPage';
import ForgeIntakePage from './pages/ForgeIntakePage';
import ReportsPage from './pages/ReportsPage';
import StoryDetail from './pages/StoryDetail';
import WalkthroughRecorderPage from './pages/WalkthroughRecorderPage';

interface ForgeAppProps {
  isAdmin?: boolean;
}

// MODULE BOUNDARY:
// - Menu owns initiative planning/management (create, edit, detail, dashboard, reports)
// - Forge owns delivery/release execution (overview, intake, workstreams, internal/external releases, reporting)
// - Forge may reference initiatives but should not own the main initiative CRUD screens
// - All initiative CRUD routes in Forge redirect to Menu

const ForgeApp: React.FC<ForgeAppProps> = ({ isAdmin = false }) => {
  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin}>
      <Routes>
        <Route index element={<ForgeManagement />} />
        <Route path="overview" element={<ForgeManagement />} />
        <Route path="intake" element={<ForgeIntakePage />} />
        <Route path="workstreams" element={<ForgeManagement />} />
        <Route path="workstreams/:id" element={<ForgeManagement />} />
        <Route path="internal-releases" element={<ForgeManagement />} />
        <Route path="external-releases" element={<ForgeManagement />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/executive-summary" element={<ReportsPage />} />
        <Route path="reports/product-release" element={<ReportsPage />} />
        <Route path="reports/workstream-health" element={<ReportsPage />} />
        <Route path="expo" element={<WalkthroughRecorderPage />} />
        <Route path="walkthrough-videos" element={<Navigate to="/forge/expo" replace />} />
        {/* Initiative CRUD routes redirect to Menu (Menu owns initiative management) */}
        <Route path="initiatives/new" element={<Navigate to="/menu/initiatives/new" replace />} />
        <Route path="initiatives/:id" element={<Navigate to="/menu/initiatives/:id" replace />} />
        <Route path="initiatives/:id/edit" element={<Navigate to="/menu/initiatives/:id/edit" replace />} />
        <Route path="stories/:id" element={<StoryDetail />} />
        <Route path="*" element={<Navigate to="/forge" replace />} />
      </Routes>
    </BOHShell>
  );
};

export default ForgeApp;

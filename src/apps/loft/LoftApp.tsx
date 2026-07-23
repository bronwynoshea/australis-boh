import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BOHShell } from '../../boh/navigation';
import { bohApps } from '../../boh/navigation/appConfigs';
import UpstreamLoftApp from '../../../imports/upstream-apps/loft-app/App';
import '../../../imports/upstream-apps/loft-app/index.css';

interface LoftAppProps {
  isAdmin?: boolean;
  standalone?: boolean;
}

const LoftRoutes = () => (
  <Routes>
    <Route path="personal-room" element={<Navigate to="/apps/loft/standalone#/personal-room" replace />} />
    <Route
      path="*"
      element={(
        <div className="boh-native-loft-frame">
          <UpstreamLoftApp />
        </div>
      )}
    />
  </Routes>
);

const LoftApp: React.FC<LoftAppProps> = ({ isAdmin = false, standalone = false }) => {
  if (standalone) {
    return (
      <div className="min-h-screen w-full overflow-hidden bg-[var(--loft-bg)] text-main dark:text-white">
        <LoftRoutes />
      </div>
    );
  }

  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} showContextualSidebar={false} flushContent>
      <LoftRoutes />
    </BOHShell>
  );
};

export default LoftApp;

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BOHShell } from '../../boh/navigation';
import { bohApps } from '../../boh/navigation/appConfigs';
import UpstreamLoftApp from '../../../imports/upstream-apps/loft-app/App';
import '../../../imports/upstream-apps/loft-app/index.css';

interface LoftAppProps {
  isAdmin?: boolean;
}

const LoftApp: React.FC<LoftAppProps> = ({ isAdmin = false }) => {
  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} showContextualSidebar={false} flushContent>
      <Routes>
        <Route path="personal-room" element={<Navigate to="/apps/loft#/personal-room" replace />} />
        <Route
          path="*"
          element={(
            <div className="boh-native-loft-frame">
              <UpstreamLoftApp />
            </div>
          )}
        />
      </Routes>
    </BOHShell>
  );
};

export default LoftApp;

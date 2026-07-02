import React from 'react';
import { BOHShell } from '../../boh/navigation';
import { bohApps } from '../../boh/navigation/appConfigs';
import NativeCellarApp from '../../../imports/upstream-apps/cellar-app/src/App';
import '../../../imports/upstream-apps/cellar-app/src/styles.css';

interface CellarAppProps {
  isAdmin?: boolean;
}

const CellarApp: React.FC<CellarAppProps> = ({ isAdmin = false }) => {
  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} showContextualSidebar={false} flushContent>
      <div className="boh-native-cellar-frame">
        <NativeCellarApp />
      </div>
    </BOHShell>
  );
};

export default CellarApp;

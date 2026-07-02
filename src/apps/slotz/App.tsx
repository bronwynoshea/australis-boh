import React from 'react';
import { BOHShell, bohApps } from '../../boh/navigation';
import NativeSlotzApp from '../../../imports/upstream-apps/slotz-app/src/App';
import '../../../imports/upstream-apps/slotz-app/src/index.css';

interface SlotzAppProps {
  isAdmin?: boolean;
}

const SlotzApp: React.FC<SlotzAppProps> = ({ isAdmin = false }) => {
  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} showContextualSidebar={false} flushContent>
      <div className="boh-native-slotz-frame">
        <NativeSlotzApp />
      </div>
    </BOHShell>
  );
};

export default SlotzApp;

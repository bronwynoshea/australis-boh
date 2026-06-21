import React, { useMemo } from 'react';
import { BOHShell } from '../../boh/navigation';
import { bohApps } from '../../boh/navigation/appConfigs';

interface WebsiteAppProps {
  isAdmin?: boolean;
}

const PROD_WEBSITE_URL = 'https://jobzcafe.com';
const DEV_WEBSITE_URL = 'https://jobzcafe.com';

const getDefaultWebsiteUrl = () => {
  const hostname = window.location.hostname;
  const isDevBoh =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'dev-boh.jobzcafe.com';

  return isDevBoh ? DEV_WEBSITE_URL : PROD_WEBSITE_URL;
};

const WebsiteApp: React.FC<WebsiteAppProps> = ({ isAdmin = false }) => {
  const websiteUrl = useMemo(
    () => import.meta.env.VITE_WEBSITE_APP_URL || getDefaultWebsiteUrl(),
    [],
  );

  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} showContextualSidebar={false} flushContent>
      <div className="website-embed-shell">
        <iframe
          className="website-embed-frame"
          src={websiteUrl}
          title="Website"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </BOHShell>
  );
};

export default WebsiteApp;

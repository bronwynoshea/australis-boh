import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BOHShell, bohApps } from '../../boh/navigation';
import { getBohTheme } from '../../lib/bohAuth';
import { supabase } from '../../lib/supabase';

interface SlotzAppProps {
  isAdmin?: boolean;
}

const PROD_SLOTZ_APP_URL = 'https://slotz.jobzcafe.com';
const DEV_SLOTZ_APP_URL = 'https://dev-slotz.jobzcafe.com';

const getDefaultSlotzAppUrl = () => {
  const hostname = window.location.hostname;
  const isDevBoh =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'dev-boh.jobzcafe.com' ||
    hostname === 'boh.australis.cloud';

  return isDevBoh ? DEV_SLOTZ_APP_URL : PROD_SLOTZ_APP_URL;
};

const getSlotzEmbedPath = (pathname: string) => {
  if (pathname.endsWith('/availability')) return '/#/availability';
  if (pathname.endsWith('/settings')) return '/#/settings';
  return '/#/';
};

const SlotzApp: React.FC<SlotzAppProps> = ({ isAdmin = false }) => {
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [handoffSession, setHandoffSession] = useState<{
    access_token: string;
    refresh_token: string;
  } | null>(null);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    let isCancelled = false;

    const loadSession = async () => {
      setSessionError('');
      const { data, error } = await supabase.auth.getSession();
      const session = data.session;

      if (error || !session?.access_token || !session.refresh_token) {
        if (!isCancelled) {
          setHandoffSession(null);
          setSessionError('SLOTZ needs a valid BOH session before it can open here.');
        }
        return;
      }

      if (!isCancelled) {
        setHandoffSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }
    };

    void loadSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  const postHandoff = useCallback(() => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow || !handoffSession) return;

    frameWindow.postMessage(
      {
        type: 'SLOTZ_BOH_SESSION_HANDOFF',
        access_token: handoffSession.access_token,
        refresh_token: handoffSession.refresh_token,
        path: getSlotzEmbedPath(location.pathname),
        theme: getBohTheme() || 'light',
      },
      '*'
    );
  }, [handoffSession, location.pathname]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type !== 'SLOTZ_BOH_EMBED_READY') return;
      postHandoff();
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [postHandoff]);

  const slotzUrl = useMemo(() => {
    const configuredUrl = import.meta.env.VITE_SLOTZ_APP_URL || getDefaultSlotzAppUrl();
    const url = new URL(configuredUrl);
    url.searchParams.set('embedded', 'boh');
    url.searchParams.set('theme', getBohTheme() || 'light');
    url.searchParams.set('boh_path', getSlotzEmbedPath(location.pathname));
    return url.toString();
  }, [location.pathname]);

  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} showContextualSidebar={false} flushContent>
      <div className="slotz-embed-shell">
        {sessionError ? (
          <div className="slotz-embed-state">
            <div>
              <h1>SLOTZ session unavailable</h1>
              <p>{sessionError}</p>
            </div>
          </div>
        ) : handoffSession ? (
          <iframe
            ref={iframeRef}
            className="slotz-embed-frame"
            src={slotzUrl}
            title="Slotz"
            allow="clipboard-read; clipboard-write"
            onLoad={postHandoff}
          />
        ) : (
          <div className="slotz-embed-state">
            <div>
              <h1>Opening SLOTZ</h1>
              <p>Passing your BOH session into SLOTZ.</p>
            </div>
          </div>
        )}
      </div>
    </BOHShell>
  );
};

export default SlotzApp;

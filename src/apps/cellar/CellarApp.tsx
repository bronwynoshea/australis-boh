import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BOHShell } from '../../boh/navigation';
import { bohApps } from '../../boh/navigation/appConfigs';
import { getBohTheme } from '../../lib/bohAuth';
import { supabase } from '../../lib/supabase';

interface CellarAppProps {
  isAdmin?: boolean;
}

const PROD_CELLAR_APP_URL = 'https://cellar.jobzcafe.com';
const DEV_CELLAR_APP_URL = 'https://dev-cellar.jobzcafe.com';
const CELLAR_BOH_EMBED_READY_MESSAGE = 'CELLAR_BOH_EMBED_READY';
const CELLAR_BOH_EMBED_HANDOFF_MESSAGE = 'CELLAR_BOH_EMBED_HANDOFF';

const getDefaultCellarAppUrl = () => {
  const hostname = window.location.hostname;
  const isDevBoh =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'dev-boh.jobzcafe.com' ||
    hostname === 'boh.australis.cloud';

  return isDevBoh ? DEV_CELLAR_APP_URL : PROD_CELLAR_APP_URL;
};

const getCellarHandoffFunctionUrl = () => {
  const configuredUrl = import.meta.env.VITE_CELLAR_BOH_HANDOFF_FUNCTION_URL;
  if (configuredUrl) return configuredUrl;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/cellar_create_boh_embed_handoff`;
};

const CellarApp: React.FC<CellarAppProps> = ({ isAdmin = false }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [handoffError, setHandoffError] = useState('');
  const cellarUrl = useMemo(() => {
    const configuredUrl = import.meta.env.VITE_CELLAR_APP_URL || getDefaultCellarAppUrl();
    const theme = getBohTheme() || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const url = new URL(configuredUrl);
    url.searchParams.set('embedded', 'boh');
    url.searchParams.set('theme', theme);
    return url.toString();
  }, []);
  const cellarOrigin = useMemo(() => new URL(cellarUrl).origin, [cellarUrl]);

  useEffect(() => {
    let isCancelled = false;

    const handleCellarMessage = async (event: MessageEvent) => {
      if (event.origin !== cellarOrigin) return;

      const payload = event.data as { type?: string; requested?: string };
      if (payload?.type !== CELLAR_BOH_EMBED_READY_MESSAGE || payload.requested !== 'staff_handoff') {
        return;
      }

      setHandoffError('');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) {
        if (!isCancelled) setHandoffError('CELLAR needs a valid BOH session before it can open here.');
        return;
      }

      try {
        const response = await fetch(getCellarHandoffFunctionUrl(), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requested: 'staff_handoff' }),
        });
        const result = await response.json().catch(() => null);
        const handoff = result?.cellar_boh_embed_handoff;

        if (!response.ok || !handoff?.email || !handoff?.token_hash) {
          throw new Error(result?.error || 'CELLAR_BOH_EMBED_HANDOFF_FAILED');
        }

        iframeRef.current?.contentWindow?.postMessage(
          {
            type: CELLAR_BOH_EMBED_HANDOFF_MESSAGE,
            email: handoff.email,
            token_hash: handoff.token_hash,
          },
          cellarOrigin,
        );
      } catch (error) {
        if (!isCancelled) {
          setHandoffError(error instanceof Error ? error.message : 'CELLAR_BOH_EMBED_HANDOFF_FAILED');
        }
      }
    };

    window.addEventListener('message', handleCellarMessage);
    return () => {
      isCancelled = true;
      window.removeEventListener('message', handleCellarMessage);
    };
  }, [cellarOrigin]);

  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} showContextualSidebar={false} flushContent>
      <div className="cellar-embed-shell">
        {handoffError && (
          <div className="cellar-embed-handoff-error" role="status">
            {handoffError}
          </div>
        )}
        <iframe
          ref={iframeRef}
          key={cellarUrl}
          className="cellar-embed-frame"
          src={cellarUrl}
          title="Cellar"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </BOHShell>
  );
};

export default CellarApp;

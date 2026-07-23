import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const DEFAULT_NEXT_PATH = '/apps/loft';

function safeNextPath(value: string | null): string {
  if (!value) return DEFAULT_NEXT_PATH;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return DEFAULT_NEXT_PATH;
    if (decoded.startsWith('/boh/auth/handoff')) return DEFAULT_NEXT_PATH;
    return decoded;
  } catch {
    return DEFAULT_NEXT_PATH;
  }
}

const BohAuthHandoff: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Opening Loft...');

  const tokenHash = useMemo(() => searchParams.get('token_hash') || '', [searchParams]);
  const nextPath = useMemo(() => safeNextPath(searchParams.get('next')), [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const completeHandoff = async () => {
      if (!tokenHash) {
        setMessage('This Loft link is missing its sign-in token.');
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });

      if (cancelled) return;

      if (error) {
        console.error('[BOH handoff] Could not verify handoff token', error);
        setMessage('This Loft sign-in link expired. Please open Loft again from Cafe.');
        return;
      }

      navigate(nextPath, { replace: true });
    };

    void completeHandoff();

    return () => {
      cancelled = true;
    };
  }, [navigate, nextPath, tokenHash]);

  return (
    <div className="min-h-screen w-full bg-boh-bg-light text-boh-text-light flex items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-boh-border-light bg-white p-6 text-center shadow-xl">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-boh-text-sub-light">BOH Loft</div>
        <h1 className="mt-3 text-2xl font-semibold text-boh-text-light">{message}</h1>
        <p className="mt-3 text-sm text-boh-text-sub-light">
          Keep this tab open while we finish the secure handoff.
        </p>
      </div>
    </div>
  );
};

export default BohAuthHandoff;

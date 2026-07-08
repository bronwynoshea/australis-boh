import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PersonalRoomPage from '../../../../imports/upstream-apps/loft-app/src/components/Loft/PersonalRoomPage';
import GuestThankYouPage from '../../../../imports/upstream-apps/loft-app/src/components/Loft/GuestThankYouPage';
import '../../../../imports/upstream-apps/loft-app/index.css';

type ExternalRoomPayload = {
  token?: string;
  dailyRoomName?: string;
  roomTitle?: string;
  role?: string;
  isRecorded?: boolean;
  videoSessionId?: string | null;
  loftRoomId?: string | null;
  currentUserProfile?: Record<string, unknown> | null;
};

function decodePayload(value: string | null): ExternalRoomPayload | null {
  if (!value) return null;

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = decodeURIComponent(
      Array.from(atob(padded))
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    const parsed = JSON.parse(json) as ExternalRoomPayload;
    return parsed?.token && parsed?.dailyRoomName ? parsed : null;
  } catch (error) {
    console.error('[ExternalInterviewRoomPage] Invalid room payload', error);
    return null;
  }
}

const ExternalInterviewRoomPage: React.FC = () => {
  const { roomId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [payloadError, setPayloadError] = useState(false);
  const normalizedRoomId = roomId.trim();
  const payload = useMemo(() => {
    const fromUrl = decodePayload(searchParams.get('payload'));
    if (fromUrl) return fromUrl;

    try {
      const windowPayload = JSON.parse(window.name || '{}');
      const encodedPayload = typeof windowPayload?.loftRoomPayload === 'string' ? windowPayload.loftRoomPayload : null;
      return decodePayload(encodedPayload);
    } catch {
      return null;
    }
  }, [searchParams]);

  useEffect(() => {
    if (!normalizedRoomId || !payload) {
      setPayloadError(true);
      setReady(true);
      return;
    }

    try {
      const tokenPayload = {
        ...payload,
        loftRoomId: payload.loftRoomId || normalizedRoomId,
      };
      sessionStorage.setItem('personalRoomIsHost', payload.role === 'host' ? 'true' : 'false');
      sessionStorage.setItem('personalRoomToken', JSON.stringify(tokenPayload));
      sessionStorage.setItem('userExplicitlyJoined', 'true');
      window.name = '';
      window.history.replaceState(window.history.state, document.title, window.location.pathname);
      localStorage.removeItem('isPersonalRoomGuest');
      localStorage.removeItem('loft_approval_status');
      setReady(true);
    } catch (error) {
      console.error('[ExternalInterviewRoomPage] Could not prepare room session', error);
      setPayloadError(true);
      setReady(true);
    }
  }, [normalizedRoomId, payload]);

  if (!ready) {
    return (
      <main className="loft-shell loft-scope flex min-h-screen w-full items-center justify-center bg-[var(--loft-bg)] text-main dark:text-white">
        <p className="text-xs font-black uppercase tracking-[0.34em] text-main/60 dark:text-white/60">Opening room</p>
      </main>
    );
  }

  if (payloadError || !normalizedRoomId) {
    return (
      <main className="loft-shell loft-scope flex min-h-screen w-full items-center justify-center bg-[var(--loft-bg)] px-6 text-main dark:text-white">
        <section className="max-w-lg rounded-[2rem] border border-white/15 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.34em] text-main/60 dark:text-white/60">Room unavailable</p>
          <h1 className="mt-4 text-2xl font-black tracking-tight">The interview room could not be opened.</h1>
          <p className="mt-4 text-sm leading-6 text-main/70 dark:text-white/70">Please return to Talent and open the interview room again.</p>
        </section>
      </main>
    );
  }

  if (window.location.hash.replace('#', '') === '/thanks') {
    return <GuestThankYouPage />;
  }

  return (
    <div className="loft-shell loft-scope min-h-screen w-full overflow-hidden bg-[var(--loft-bg)] text-main dark:text-white">
      <PersonalRoomPage
        roomId={normalizedRoomId}
        onLeave={() => navigate('/daily-redirect', { replace: true, state: { source: 'talent-interview' } })}
      />
    </div>
  );
};

export default ExternalInterviewRoomPage;

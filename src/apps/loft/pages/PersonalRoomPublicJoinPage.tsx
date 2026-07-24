import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import PersonalRoomGuestGate from '../../../../imports/upstream-apps/loft-app/src/components/Loft/PersonalRoomPage/components/PersonalRoomGuestGate';
import PersonalRoomPage from '../../../../imports/upstream-apps/loft-app/src/components/Loft/PersonalRoomPage';
import GuestThankYouPage from '../../../../imports/upstream-apps/loft-app/src/components/Loft/GuestThankYouPage';
import { clearPersonalGuestAccessState } from '../../../../imports/upstream-apps/loft-app/src/components/Loft/PersonalRoomPage/utils/personalRoomGuestStorage';
import '../../../../imports/upstream-apps/loft-app/index.css';

const PersonalRoomPublicJoinPage: React.FC = () => {
  const { tenantSlug = '', slug = '' } = useParams();
  const normalizedTenantSlug = tenantSlug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
  const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
  const forceNewGuest = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('guest') === 'new';
  const [guestStateReady, setGuestStateReady] = useState(!forceNewGuest);
  const [hashPath, setHashPath] = useState(() => (
    typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
  ));
  const [publicView, setPublicView] = useState<'join' | 'thanks'>(() => (
    typeof window !== 'undefined' && window.location.hash.replace('#', '') === '/thanks' && !forceNewGuest ? 'thanks' : 'join'
  ));

  useEffect(() => {
    const syncHashPath = () => {
      const nextHashPath = window.location.hash.replace(/^#/, '');
      setHashPath(nextHashPath);
      setPublicView(nextHashPath === '/thanks' && !forceNewGuest ? 'thanks' : 'join');
    };

    window.addEventListener('hashchange', syncHashPath);
    syncHashPath();
    return () => window.removeEventListener('hashchange', syncHashPath);
  }, [forceNewGuest]);

  const liveRoomId = useMemo(() => {
    const match = hashPath.match(/^\/personal-room\/live\/([^/?#]+)/);
    return match?.[1] || '';
  }, [hashPath]);

  useLayoutEffect(() => {
    if (!forceNewGuest) return;
    clearPersonalGuestAccessState();
    sessionStorage.removeItem('personalRoomIsHost');
    sessionStorage.removeItem('personalRoomToken');
    window.history.replaceState(null, '', window.location.pathname);
    setPublicView('join');
    setGuestStateReady(true);
  }, [forceNewGuest]);

  const handleNavigate = (path: string) => {
    const nextPath = path.startsWith('/') ? path : `/${path}`;
    if (nextPath === '/thanks') {
      setPublicView('thanks');
      window.history.replaceState(null, '', `${window.location.pathname}#/thanks`);
      setHashPath('/thanks');
      return;
    }
    window.location.hash = nextPath;
  };

  if (!guestStateReady) {
    return (
      <div className="loft-shell loft-scope min-h-screen w-full bg-[var(--loft-bg)]" aria-label="Preparing guest check-in" />
    );
  }

  return (
    <div className="loft-shell loft-scope min-h-[100svh] w-full overflow-hidden bg-[var(--loft-bg)] text-main dark:text-white">
      {liveRoomId ? (
        <PersonalRoomPage roomId={liveRoomId} onLeave={(path) => handleNavigate(path || '/thanks')} />
      ) : publicView === 'thanks' ? (
        <GuestThankYouPage />
      ) : (
        <PersonalRoomGuestGate onNavigate={handleNavigate} slug={normalizedSlug} tenantSlug={normalizedTenantSlug} />
      )}
    </div>
  );
};

export default PersonalRoomPublicJoinPage;

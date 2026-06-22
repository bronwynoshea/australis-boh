import React, { useState, useEffect } from 'react';
import { ArrowRight, Clock, LockKeyhole, Sparkles, UserRound, Video } from 'lucide-react';
import { useSupabaseUser, callEdgeFunction } from '../../../../services/supabaseApi';
import AnimatedBackgroundBlobs from '../../AnimatedBackgroundBlobs';
import PersonalRoomPage from '../index';
import { clearStalePersonalGuestAccessState } from '../utils/personalRoomGuestStorage';

const WAITING_FAST_POLL_MS = 12000;
const WAITING_SLOW_POLL_MS = 60000;
const WAITING_FAST_WINDOW_MS = 2 * 60 * 1000;
const HOST_OPEN_CHECK_MS = 60000;

const LoftIcon = ({ className = 'w-10 h-10' }: { className?: string }) => (
  <>
    <img src="/brand/loft-icon-signal-final-light.svg" alt="Loft" className={`${className} dark:hidden`} />
    <img src="/brand/loft-icon-signal-final-dark.svg" alt="Loft" className={`${className} hidden dark:block`} />
  </>
);

interface PersonalRoomGuestGateProps {
  slug: string;
  onNavigate: (path: string) => void;
}

const PersonalRoomGuestGate: React.FC<PersonalRoomGuestGateProps> = ({ slug, onNavigate }) => {
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomTitle, setRoomTitle] = useState<string>('');
  const [hostName, setHostName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWaitingForHost, setIsWaitingForHost] = useState(false);
  const [isHostRoomOpen, setIsHostRoomOpen] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    const fetchPersonalRoom = async () => {
      try {
        setIsLoading(true);
        
        const response = await callEdgeFunction<{ roomId: string; title: string; isOpen?: boolean; inviteCode?: string | null }>(
          'get_personal_room_by_slug',
          { slug }
        );
        
        setRoomId(response.roomId);
        setRoomTitle(response.title);
        setHostName(response.title.replace("'s Personal Room", "").replace("'s Personal Table", "")); // Extract host name from title
        setIsHostRoomOpen(response.isOpen === true);
        
        const {
          guestName: savedGuestName,
          guestEmail: savedGuestEmail,
          approvalStatus: savedApprovalStatus,
          slug: savedSlug,
        } = clearStalePersonalGuestAccessState(slug);
        if (savedGuestName) {
          setGuestName(savedGuestName);
          setGuestEmail(savedGuestEmail);
          
          // Check if already approved
          try {
            const approvalResponse = await callEdgeFunction('check_guest_waitlist_status', {
              slug: slug,
              guestName: savedGuestName,
              guestEmail: savedGuestEmail || undefined,
            }) as any;
            
            if (approvalResponse?.userApprovalStatus === 'approved') {
              console.log('[GuestGate] User already approved, getting token and joining...');
              
              // Get token and join automatically
              const tokenResponse = await callEdgeFunction('loft-public-join-token', {
                loftRoomId: response.roomId,
                guestName: savedGuestName
              });
              
              // Store token data
              try {
                localStorage.setItem('personalRoomToken', JSON.stringify(tokenResponse));
                localStorage.setItem('guestName', savedGuestName);
                localStorage.setItem('isPersonalRoomGuest', 'true');
                localStorage.setItem('loft_approval_status', 'approved');
                sessionStorage.removeItem('personalRoomIsHost');
              } catch (error) {
                console.error('[GuestGate] Failed to store token:', error);
              }
              
              // Stay on /personal/{slug} - render PersonalRoomPage
              setIsApproved(true);
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.log('[GuestGate] Could not check approval status, showing gate...');
          }

          if (savedApprovalStatus === 'pending' && savedSlug === slug) {
            setIsWaitingForHost(true);
            setIsLoading(false);
            return;
          }
        }
        
      } catch (err) {
        console.error('Failed to get personal room by slug:', err);
        const errorMsg = err instanceof Error ? err.message : 'Personal table not found';
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      fetchPersonalRoom();
    }
  }, [slug, onNavigate]);

  // Poll for approval status when waiting
  useEffect(() => {
    if (!isWaitingForHost || !guestName || !slug) return;
    if (!isHostRoomOpen) return;
    let isStopped = false;
    let timerId: number | undefined;

    const checkApprovalStatus = async () => {
      if (isStopped) return;
      if (document.visibilityState === 'hidden') {
        scheduleNextCheck();
        return;
      }

      try {
        const response = await callEdgeFunction('check_guest_waitlist_status', {
          slug: slug,
          guestName: guestName,
          guestEmail: guestEmail || localStorage.getItem('personalRoomGuestEmail') || undefined,
        }) as any;
        
        // If user is approved, automatically get token and join the room
        if (response?.userApprovalStatus === 'approved') {
          console.log('[GuestGate] Guest approved, getting token and joining session...');
          
          // Get token for approved guest
          const tokenResponse = await callEdgeFunction('loft-public-join-token', {
            loftRoomId: roomId,
            guestName: guestName
          });
          
          // Store token data for PersonalRoomPage
          try {
            localStorage.setItem('personalRoomToken', JSON.stringify(tokenResponse));
            localStorage.setItem('guestName', guestName);
            localStorage.setItem('isPersonalRoomGuest', 'true');
            localStorage.setItem('loft_approval_status', 'approved');
            sessionStorage.removeItem('personalRoomIsHost');
          } catch (error) {
            console.error('[GuestGate] Failed to store token:', error);
          }
          
          // Trigger re-render by updating state - guest stays on /personal/{slug}
          console.log('[GuestGate] Guest approved, triggering re-render');
          setIsApproved(true);
          setIsWaitingForHost(false);
          setIsLoading(false);
          isStopped = true;
          if (timerId) window.clearTimeout(timerId);
          return;
        }
      } catch (error) {
        console.error('[GuestGate] Failed to check approval status:', error);
      }

      scheduleNextCheck();
    };

    const scheduleNextCheck = () => {
      if (isStopped) return;
      const requestedAtRaw = localStorage.getItem('personalRoomAccessRequestedAt');
      const requestedAt = requestedAtRaw ? Number(requestedAtRaw) : Date.now();
      const waitedMs = Number.isFinite(requestedAt) ? Date.now() - requestedAt : 0;
      const nextDelay = waitedMs > WAITING_FAST_WINDOW_MS ? WAITING_SLOW_POLL_MS : WAITING_FAST_POLL_MS;
      timerId = window.setTimeout(checkApprovalStatus, nextDelay);
    };

    timerId = window.setTimeout(checkApprovalStatus, 1500);
    
    return () => {
      isStopped = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [isWaitingForHost, isHostRoomOpen, guestName, slug, roomId, onNavigate]);

  useEffect(() => {
    if (!isWaitingForHost || isHostRoomOpen || !slug) return;
    let isStopped = false;
    let timerId: number | undefined;

    const checkHostOpenedRoom = async () => {
      if (isStopped) return;
      if (document.visibilityState === 'hidden') {
        timerId = window.setTimeout(checkHostOpenedRoom, HOST_OPEN_CHECK_MS);
        return;
      }

      try {
        const response = await callEdgeFunction<{ isOpen?: boolean }>('get_personal_room_by_slug', { slug });
        if (response?.isOpen === true) {
          setIsHostRoomOpen(true);
          return;
        }
      } catch (error) {
        console.error('[GuestGate] Failed to check host room status:', error);
      }

      timerId = window.setTimeout(checkHostOpenedRoom, HOST_OPEN_CHECK_MS);
    };

    timerId = window.setTimeout(checkHostOpenedRoom, HOST_OPEN_CHECK_MS);
    return () => {
      isStopped = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [isWaitingForHost, isHostRoomOpen, slug]);

  const handleJoinRoom = async (guestName?: string, guestEmail?: string) => {
    const nextName = guestName?.trim() || '';
    const nextEmail = guestEmail?.trim() || '';
    if (!nextName) {
      setError('Please enter your name.');
      return;
    }
    if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (roomId) {
      try {
        setIsLoading(true);

        // Store guest identity for the waiting flow. The Daily room token is only requested after host approval.
        try {
          localStorage.setItem('guestName', nextName);
          localStorage.setItem('personalRoomGuestEmail', nextEmail);
          localStorage.setItem('personalRoomSlug', slug);
          localStorage.setItem('isPersonalRoomGuest', 'true');
          localStorage.setItem('loft_approval_status', 'pending');
          localStorage.setItem('personalRoomAccessRequestedAt', String(Date.now()));
          sessionStorage.removeItem('personalRoomIsHost');
        } catch {
          // ignore
        }
        
        // Add guest to waitlist using the correct function
        const waitlistResponse = await callEdgeFunction('request-personal-room-access', {
          slug: slug,
          guestName: nextName,
          guestEmail: nextEmail
        });
        
        
        // Set waiting state and show waitlist UI
        setIsWaitingForHost(true);
        
      } catch (err: any) {
        console.error('[PersonalRoomGuestGate] Failed to request access:', err);
        console.error('[PersonalRoomGuestGate] Error details:', {
          message: err.message,
          status: err.status,
          error: err.error
        });
        
        // Try multiple ways to get the error
        const errorMsg = err?.error || err?.message || err?.error?.message || 'Failed to request access. Please try again.';
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleJoinRoom(guestName, guestEmail);
    }
  };

  // If guest is approved, render PersonalRoomPage directly
  if (isApproved && roomId) {
    return <PersonalRoomPage roomId={roomId} onLeave={(path) => onNavigate(path || '/thanks')} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--loft-bg)] text-main text-xs font-black tracking-[0.4em] uppercase">
        Loading table...
      </div>
    );
  }

  if (isWaitingForHost) {
    return (
      <PersonalGuestShell hostName={hostName} roomTitle={roomTitle}>
        <div className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-xl font-black uppercase tracking-tight text-main">You're checked in</h2>
            {hostName && <p className="text-sm font-semibold text-muted">Hosted by {hostName}</p>}
          </div>
          <div className="rounded-2xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-5 py-4 text-center text-sm font-semibold leading-relaxed text-muted">
            {isHostRoomOpen
              ? 'Thanks for checking in. We will bring you into the session as soon as the host is ready.'
              : 'Thanks for checking in. This table will open as soon as the host is ready.'}
          </div>
          <div className="flex justify-center">
            <div className="h-9 w-9 rounded-full border-2 border-cafe border-t-transparent animate-spin" />
          </div>
          <p className="text-center text-[11px] font-black uppercase tracking-[0.24em] text-muted/70">
            This page will update automatically
          </p>
        </div>
      </PersonalGuestShell>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="loft-card p-8 text-center space-y-4">
          <h2 className="text-2xl font-bold text-[var(--loft-text)]">Table Not Available</h2>
          <p className="text-[var(--loft-text-subtle)]">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-cafe text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-cafe/90 transition-all"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <PersonalGuestShell hostName={hostName} roomTitle={roomTitle}>
      <div className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-tight text-main">Request access</h2>
          <p className="text-sm font-semibold leading-relaxed text-muted">
            Add your details so the host can welcome you in.
          </p>
        </div>

        <div className="grid gap-3">
          <label className="block text-left">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-muted">Name</span>
            <input
              type="text"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                if (error) setError(null);
              }}
              onKeyPress={handleKeyPress}
              placeholder="Enter your name"
              className="w-full rounded-2xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-5 py-4 text-sm font-semibold text-main placeholder:text-muted/70 shadow-inner focus:outline-none focus:ring-2 focus:ring-cafe/50"
              maxLength={50}
              autoComplete="name"
              disabled={isLoading}
            />
          </label>
          <label className="block text-left">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-muted">Email</span>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => {
                setGuestEmail(e.target.value);
                if (error) setError(null);
              }}
              onKeyPress={handleKeyPress}
              placeholder="Enter your email"
              className="w-full rounded-2xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-5 py-4 text-sm font-semibold text-main placeholder:text-muted/70 shadow-inner focus:outline-none focus:ring-2 focus:ring-cafe/50"
              maxLength={120}
              autoComplete="email"
              disabled={isLoading}
            />
          </label>

          {error && (
            <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-left text-xs font-bold text-red-400">{error}</p>
          )}

          <button
            type="button"
            onClick={() => handleJoinRoom(guestName, guestEmail)}
            disabled={!guestName.trim() || !guestEmail.trim() || isLoading}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-[11px] font-black uppercase tracking-[0.28em] shadow-lg transition-all ${
              !guestName.trim() || !guestEmail.trim() || isLoading
                ? 'border border-[var(--loft-border)] bg-[var(--loft-surface-2)] text-muted cursor-not-allowed'
                : 'bg-cafe text-white shadow-cafe/25 hover:brightness-110 active:scale-95'
              }`}
          >
            {isLoading ? 'Requesting...' : 'Request access'}
            {!isLoading && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </PersonalGuestShell>
  );
};

const PersonalGuestShell = ({
  hostName,
  roomTitle,
  children,
}: {
  hostName: string;
  roomTitle: string;
  children: React.ReactNode;
}) => (
  <div className="min-h-screen w-full bg-[var(--loft-bg)] text-main relative overflow-x-hidden">
    <img
      src="/loft_screens/2.png"
      alt=""
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-cover opacity-18 dark:opacity-20 lg:hidden"
    />
    <div className="absolute inset-0 bg-[var(--loft-bg)]/88 dark:bg-[#10163a]/86 lg:hidden" />
    <main className="relative z-10 min-h-screen lg:h-screen lg:overflow-hidden grid lg:grid-cols-[minmax(0,0.94fr)_minmax(390px,1.06fr)]">
      <section className="flex min-h-screen lg:h-screen lg:min-h-0 flex-col overflow-y-auto no-scrollbar px-5 py-5 md:px-8 md:py-6 xl:px-10 xl:py-8">
        <header className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              window.location.hash = '/';
            }}
            className="flex items-center gap-3"
            aria-label="Loft home"
          >
            <LoftIcon className="h-10 w-10" />
            <span className="text-2xl font-black uppercase tracking-tight text-cafe">Loft</span>
          </button>
        </header>

        <div className="flex flex-1 items-center py-8 lg:py-6 xl:py-10">
          <div className="w-full max-w-2xl space-y-5 2xl:space-y-8">
            <div className="space-y-4">
              <h1 className="max-w-4xl text-3xl md:text-4xl xl:text-5xl 2xl:text-6xl font-black tracking-tight leading-[0.98] text-main">
                {hostName ? `Join ${hostName}'s table.` : 'Join this private table.'}
              </h1>
              <p className="max-w-xl text-base xl:text-[1.05rem] 2xl:text-lg leading-relaxed text-muted">
                You are in the right place for this private JOBZCAFE® Loft table. Add your details and the host will welcome you in when the session is ready.
              </p>
            </div>

            <div className="loft-card p-4 md:p-5">
              {children}
              <div className="mt-4 grid sm:grid-cols-3 gap-3 text-left">
                <GuestTrustItem icon={<LockKeyhole className="h-4 w-4" />} label="Private entry" />
                <GuestTrustItem icon={<Clock className="h-4 w-4" />} label="Quiet waiting" />
                <GuestTrustItem icon={<Video className="h-4 w-4" />} label="Host welcome" />
              </div>
            </div>
          </div>
        </div>

        <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-[var(--loft-border)] pt-5 text-[10px] font-black uppercase tracking-[0.28em] text-muted">
          <span>A JOBZCAFE® product</span>
          <span>{roomTitle || 'Private table access'}</span>
        </footer>
      </section>

      <aside className="hidden lg:block sticky top-0 h-screen overflow-hidden bg-black">
        <img
          src="/loft_screens/2.png"
          alt="Loft table preview"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#10163a]/70 via-[#10163a]/18 to-[#10163a]/64" />
        <div className="absolute left-8 top-8 right-8 flex items-center justify-between">
          <div className="flex items-center gap-3 rounded-2xl bg-black/35 border border-white/15 px-4 py-3 text-white backdrop-blur-md">
            <LoftIcon className="h-8 w-8" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/60">Personal table</p>
              <p className="text-sm font-black">{hostName || 'Hosted session'}</p>
            </div>
          </div>
        </div>
        <div className="absolute left-8 right-8 bottom-8 grid grid-cols-3 gap-3">
          {[
            ['Entry', 'Private link'],
            ['Waiting', 'Quietly held'],
            ['Session', 'Host ready'],
          ].map(([label, detail], index) => (
            <div key={label} className="rounded-2xl bg-black/38 border border-white/15 p-4 text-white backdrop-blur-md">
              <div className={`mb-6 flex h-9 w-9 items-center justify-center rounded-xl ${index === 0 ? 'bg-cafe' : index === 1 ? 'bg-[#57cbe4]' : 'bg-[#6ee7b7]'}`}>
                {index === 1 ? <UserRound className="h-4 w-4" /> : index === 2 ? <Video className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/55">{label}</p>
              <p className="mt-1 text-sm font-black">{detail}</p>
            </div>
          ))}
        </div>
      </aside>
    </main>
  </div>
);

const GuestTrustItem = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <div className="flex items-center gap-2 rounded-2xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-4 py-3 text-main">
    <span className="text-cafe">{icon}</span>
    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
  </div>
);

export default PersonalRoomGuestGate;

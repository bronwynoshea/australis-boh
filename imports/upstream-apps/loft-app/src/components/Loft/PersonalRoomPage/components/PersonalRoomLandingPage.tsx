import React, { useEffect, useState } from 'react';
import { useSupabaseUser, callEdgeFunction } from '@/services/supabaseApi';
import { Video, Copy, Check, Loader2, AlertCircle, Mail, LogIn } from 'lucide-react';
import { clearPersonalGuestAccessState } from '../utils/personalRoomGuestStorage';

interface PersonalRoomLandingPageProps {
  onNavigate: (path: string) => void;
  slug?: string;
}

const PersonalRoomLandingPage: React.FC<PersonalRoomLandingPageProps> = ({ onNavigate, slug }) => {
  const { user, profile, isLoading: isLoadingProfile } = useSupabaseUser();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomTitle, setRoomTitle] = useState<string>('');
  const [hostName, setHostName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  // Determine if user is viewing their own room or someone else's
  const isOwnRoom = !slug && !!profile?.id;
  const isGuestView = !!slug;
  const canUsePersonalRoom =
    !!((profile as any)?.canUsePersonalRoom ?? (profile as any)?.can_use_personal_room) ||
    !!((profile as any)?.personalRoomSlug ?? (profile as any)?.personal_room_slug) ||
    !!((profile as any)?.personalRoomId ?? (profile as any)?.personal_room_id);

  useEffect(() => {
    const fetchPersonalRoom = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // **GUEST VIEW**: Fetch room by external invite link.
        if (slug) {
            
          const response = await callEdgeFunction<{ 
            roomId: string; 
            title: string;
            hostName: string;
            inviteCode?: string | null;
          }>('loft-get-personal-room-by-slug', { slug });
          
          setRoomId(response.roomId);
          setRoomTitle(response.title);
          setHostName(response.hostName || 'Host');
          setInviteCode(response.inviteCode || '');
          
            
          return;
        }

        // **HOST VIEW**: Wait for profile to load
        if (isLoadingProfile) {
          return;
        }

        // Check authentication
        if (!user?.id) {
          setError('Please log in to access your personal table');
          setIsLoading(false);
          return;
        }

        // Check permissions
        if (!canUsePersonalRoom) {
          setError('Personal Table access has not been enabled for this member yet.');
          setIsLoading(false);
          return;
        }


        // Fetch or create host's personal room
        const response = await callEdgeFunction<{ 
          roomId: string; 
          title: string; 
          isNew: boolean; 
          inviteCode?: string;
        }>('loft-get-or-create-personal-room', {});

        setRoomId(response.roomId);
        setRoomTitle(response.title);
        setInviteCode(response.inviteCode || '');

      } catch (err) {
        console.error('[PersonalRoomLanding] Failed to load room:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to load personal table';
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersonalRoom();
  }, [profile?.id, slug, isLoadingProfile, canUsePersonalRoom, user?.id]);

  const appOrigin = typeof window !== 'undefined' ? new URL(window.location.href).origin : '';
  const getDefaultTenantSlug = () => {
    if (typeof window === 'undefined') return 'jobzcafe';
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('australis.cloud') || hostname.includes('australis-boh.pages.dev')) return 'australis';
    return 'jobzcafe';
  };
  const guestJoinCode = slug || inviteCode;
  const personalLink = guestJoinCode
    ? `${appOrigin}/t/${getDefaultTenantSlug()}/loft/join/${guestJoinCode.toLowerCase()}`
    : '';
  const profileName =
    ((profile as any)?.name as string | undefined) ||
    ((profile as any)?.displayName as string | undefined) ||
    ((profile as any)?.display_name as string | undefined) ||
    ((profile as any)?.fullName as string | undefined) ||
    ((profile as any)?.full_name as string | undefined) ||
    '';
  const displayHostName =
    hostName ||
    profileName ||
    roomTitle.replace("'s Personal Room", '').replace("'s Personal Table", '') ||
    'Host';
  const personalTableTitle = (roomTitle || `${displayHostName}'s Personal Table`)
    .replace(/Personal Room/g, 'Personal Table');
  const inviteEmailText = `Subject: Join my Personal Table - ${personalTableTitle}

Hi,

Here is my private JOBZCAFE® Loft table link:

${personalLink}

When you arrive, add your details and I will welcome you in when the session is ready.

Best regards`;
  const invitePreviewText = `Subject: Join my Personal Table - ${personalTableTitle}

Hi,

Here is my private JOBZCAFE® Loft table link:

Join my Personal Table

When you arrive, add your details and I will welcome you in when the session is ready.

Best regards`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard. Please copy manually.');
    }
  };

  const handleGuestJoin = async () => {
    const trimmedName = guestName.trim();
    
    if (!trimmedName) {
      setError('Please enter your name');
      return;
    }
    
    if (!slug) {
      setError('Table information is not available');
      return;
    }
    
    try {
      setIsJoining(true);
      setError(null);

      // Generate guest token using slug
      const response = await callEdgeFunction<{
        token: string;
        dailyRoomName: string;
        roomTitle: string;
        hostName: string;
        roomId: string;
      }>('join_personal_room_by_slug', {
        slug: slug,
        guestName: trimmedName
      });

      // Store guest credentials for PersonalRoomPage
      try {
        localStorage.setItem('guestName', trimmedName);
        localStorage.setItem('personalRoomToken', JSON.stringify({
          token: response.token,
          dailyRoomName: response.dailyRoomName,
          roomTitle: response.roomTitle,
          hostName: response.hostName,
          roomId: response.roomId,
          isHost: false,
        }));
        localStorage.setItem('personalRoomTitle', response.roomTitle);
        localStorage.setItem('personalRoomHostName', response.hostName);
        localStorage.setItem('personalRoomSlug', slug);
        localStorage.setItem('isPersonalRoomGuest', 'true');
        localStorage.setItem('loft_approval_status', 'pending');
        sessionStorage.removeItem('personalRoomIsHost');
      } catch (storageErr) {
        console.warn('[PersonalRoomLanding] Failed to save to localStorage:', storageErr);
      }
      
      // Keep the guest on the external invite link.
      const guestPath = `/personal/${slug}?guest=${encodeURIComponent(trimmedName)}`;
      onNavigate(guestPath);
      
    } catch (err: any) {
      console.error('[PersonalRoomLanding] Guest join failed:', err);
      const errorMsg = err?.message || 'Failed to join table. Please try again.';
      setError(errorMsg);
    } finally {
      setIsJoining(false);
    }
  };

  const handleHostJoin = async () => {
    if (!roomId) {
      alert('Table ID not found. Please refresh and try again.');
      return;
    }
    
    try {
      setIsJoining(true);
      setError(null);

      // Generate host token using roomId
      const response = await callEdgeFunction<{
        token: string;
        dailyRoomName: string;
        roomTitle: string;
        hostName: string;
        roomId: string;
        isHost: boolean;
      }>('loft-join-token', {
        loftRoomId: roomId
      });

      // Store host token for PersonalRoomPage (moved from localStorage to sessionStorage)
      try {
        clearPersonalGuestAccessState();
        sessionStorage.setItem('personalRoomToken', JSON.stringify(response));
        sessionStorage.setItem('personalRoomTitle', response.roomTitle);
        sessionStorage.setItem('personalRoomHostName', response.hostName || 'Host');
        sessionStorage.setItem('personalRoomIsHost', 'true');
      } catch (storageErr) {
        console.warn('[PersonalRoomLanding] Failed to save to sessionStorage:', storageErr);
      }
      
      // Navigate directly to personal room since we already have the token
      const hostPath = `/personal-room/${roomId}`;
      onNavigate(hostPath);
      
    } catch (err: any) {
      console.error('[PersonalRoomLanding] Host join failed:', err);
      const errorMsg = err?.message || 'Failed to join table as host. Please try again.';
      setError(errorMsg);
    } finally {
      setIsJoining(false);
    }
  };

  // **LOADING STATE**
  if (isLoading || isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-cafe animate-spin mx-auto" />
          <p className="text-sm text-main/60 dark:text-white/60 font-bold uppercase tracking-widest">
            {slug ? `Loading ${slug}'s table...` : 'Loading your personal table...'}
          </p>
        </div>
      </div>
    );
  }

  // **ERROR STATE**
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-transparent">
        <div className="max-w-md w-full space-y-6">
          <div className="loft-card p-8 space-y-6 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight text-main dark:text-white">
                Unable to Load Table
              </h2>
              <p className="text-sm text-main/70 dark:text-white/70">{error}</p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 px-6 bg-cafe/20 text-cafe border border-cafe/30 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-cafe/30 transition-all"
              >
                Try Again
              </button>
              <button
                onClick={() => onNavigate('/lobby')}
                className="w-full py-3 px-6 bg-cafe text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-cafe/90 transition-all shadow-lg"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // **GUEST VIEW**: Show join form when accessing via external invite link.
  if (isGuestView && roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-transparent">
        <div className="max-w-md w-full space-y-6">
          <div className="loft-card p-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-cafe/10 rounded-2xl flex items-center justify-center mx-auto">
                <Video className="w-8 h-8 text-cafe" />
              </div>
              <h1 className="text-2xl font-bold text-cafe uppercase tracking-tight">
                Join Personal Table
              </h1>
              <div className="space-y-1">
                <p className="text-lg font-bold text-main dark:text-white">
                  {personalTableTitle}
                </p>
                <p className="text-sm text-main/60 dark:text-white/60">
                  Hosted by {hostName}
                </p>
                {slug && (
                  <p className="text-xs text-main/40 dark:text-white/40 font-mono">
                    /{slug}
                  </p>
                )}
              </div>
            </div>

            {/* Guest Name Input */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-main/60 dark:text-white/60">
                Your Name
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => {
                  setGuestName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-main dark:text-white placeholder-main/40 dark:placeholder-white/40 focus:border-cafe focus:outline-none transition-all"
                onKeyPress={(e) => e.key === 'Enter' && !isJoining && guestName.trim() && handleGuestJoin()}
                disabled={isJoining}
                autoFocus
              />
              <p className="text-xs text-main/50 dark:text-white/50">
                This name will be visible to other participants
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}

            {/* Join Button */}
            <button
              onClick={handleGuestJoin}
              disabled={!guestName.trim() || isJoining}
              className="w-full py-4 px-6 bg-cafe text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-cafe/90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Join Table
                </>
              )}
            </button>

            {/* Footer Note */}
            <div className="pt-4 border-t border-black/5 dark:border-white/10">
              <p className="text-xs text-center text-main/50 dark:text-white/50">
                No account required - video call powered by Loft
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // **HOST VIEW**: Show table invite surface
  return (
    <div className="min-h-[calc(100vh-5rem)] bg-transparent p-4 pb-28 md:p-10 transition-colors duration-300 loft-scope">
      <div className="max-w-5xl mx-auto space-y-7">
        <header className="text-center space-y-3">
          <h1 className="text-3xl md:text-5xl font-bold text-cafe uppercase tracking-tight leading-none">
            Personal Table
          </h1>
          <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.34em] text-main/45 dark:text-white/45">
            Your private JOBZCAFE® Loft invite link
          </p>
        </header>

        <section className="loft-card loft-card--flat rounded-[2rem] overflow-hidden border border-[var(--loft-border)] bg-[var(--loft-surface)] shadow-2xl">
          <div className="p-5 sm:p-7 md:p-8 border-b border-[var(--loft-border)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="space-y-2 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-main/35 dark:text-white/35">
                Host table
              </p>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-main dark:text-white leading-tight">
                {personalTableTitle}
              </h2>
              <p className="text-sm text-main/60 dark:text-white/60">
                Hosted by {displayHostName}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:flex lg:items-center lg:justify-end">
              <button
                onClick={handleHostJoin}
                disabled={isJoining}
                className="min-h-12 px-6 bg-cafe text-white rounded-xl font-black uppercase tracking-[0.2em] text-xs hover:bg-cafe/90 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />}
                {isJoining ? 'Opening' : 'Join as Host'}
              </button>
              <button
                onClick={() => copyToClipboard(personalLink)}
                className="min-h-12 px-6 bg-cafe/15 border border-cafe/30 text-cafe rounded-xl hover:bg-cafe/20 active:scale-95 transition-all flex items-center justify-center gap-2 font-black uppercase tracking-[0.2em] text-xs"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                {copied ? 'Copied' : 'Copy guest link'}
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-7 md:p-8 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="w-5 h-5 text-cafe shrink-0" />
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-main/45 dark:text-white/45">
                    Invite message
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(inviteEmailText)}
                  className="shrink-0 text-[11px] text-cafe font-black uppercase tracking-[0.18em] hover:underline"
                >
                  {copied ? 'Copied' : 'Copy text'}
                </button>
              </div>
              <div className="rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] p-4">
                <div className="text-xs sm:text-sm text-main/70 dark:text-white/70 leading-relaxed space-y-3">
                  <p>Subject: Join my Personal Table - {personalTableTitle}</p>
                  <p>Hi,</p>
                  <p>Here is my private JOBZCAFE® Loft table link:</p>
                  <p className="inline-flex w-fit items-center border-b border-cafe/70 text-cafe font-bold">
                    Join my Personal Table
                  </p>
                  <p>When you arrive, add your details and I will welcome you in when the session is ready.</p>
                  <p>Best regards</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default React.memo(PersonalRoomLandingPage);

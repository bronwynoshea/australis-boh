import React, { useEffect, useRef, useState } from 'react';
import { MicOff, UserX, VideoOff, Mic, Video as VideoIcon } from 'lucide-react';

const readLocalSessionAvatar = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem('loft.sessionAvatar')?.trim() || undefined;
  } catch {
    return undefined;
  }
};

interface PersonalRoomParticipantCardProps {
  participant: {
    id: string;
    name: string;
    isLocal: boolean;
    audio: boolean;
    video: boolean;
    avatarUrl?: string;
    videoTrack?: MediaStreamTrack;
    isVideoOn: boolean;
    role?: string;
    isOnStage?: boolean;
    isHost?: boolean;
    backgroundMode?: 'none' | 'blur' | 'image'; 
  };
  localBackgroundMode?: 'none' | 'blur' | 'image';
  compact?: boolean;
  dense?: boolean;
  featured?: boolean;
  hideLabels?: boolean;
  sidebarMode?: boolean;
  spotlightMode?: boolean;
  onEndSession?: () => void;
}

const PersonalRoomParticipantCard: React.FC<PersonalRoomParticipantCardProps> = ({ 
  participant, 
  localBackgroundMode, 
  compact = false, 
  dense = false,
  featured = false,
  hideLabels = false,
  sidebarMode = false,
  spotlightMode = false,
  onEndSession
}) => {
  const tileVideoRef = useRef<HTMLVideoElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [localSessionAvatarUrl, setLocalSessionAvatarUrl] = useState<string | undefined>(() =>
    participant.isLocal ? readLocalSessionAvatar() : undefined
  );

  useEffect(() => {
    if (!participant.isLocal) {
      setLocalSessionAvatarUrl(undefined);
      return;
    }

    const refreshLocalAvatar = () => setLocalSessionAvatarUrl(readLocalSessionAvatar());
    refreshLocalAvatar();
    window.addEventListener('storage', refreshLocalAvatar);
    window.addEventListener('loft:session-avatar-changed', refreshLocalAvatar);
    return () => {
      window.removeEventListener('storage', refreshLocalAvatar);
      window.removeEventListener('loft:session-avatar-changed', refreshLocalAvatar);
    };
  }, [participant.isLocal, participant.avatarUrl]);

  // Listen for Daily.co audio level events
  useEffect(() => {
    const callObj = (window as any).__personalRoomDailyCallObject;
    if (!callObj) return;

    try {
      if (callObj.enableAudioLevelDetection) {
        callObj.enableAudioLevelDetection();
      }
    } catch (e) {
      // Audio level detection not available
    }

    const handleAudioLevel = (ev: any) => {
      if (ev?.participant?.session_id === participant.id || 
          ev?.participant?.user_id === participant.id ||
          (participant.isLocal && ev?.participant?.local)) {
        
        const audioLevel = ev?.audioLevel || ev?.level || 0;
        const isCurrentlySpeaking = audioLevel > 0.05;
        
        if (isCurrentlySpeaking !== isSpeaking) {
          setIsSpeaking(isCurrentlySpeaking);
        }
      }
    };

    callObj.on('audio-level', handleAudioLevel);
    
    return () => {
      callObj.off('audio-level', handleAudioLevel);
    };
  }, [participant.id, participant.isLocal, isSpeaking]);

  useEffect(() => {
    const el = tileVideoRef.current;
    if (!el) return;
    if (!participant.videoTrack) {
      (el as any).srcObject = null;
      return;
    }
    const ms = new MediaStream([participant.videoTrack]);
    (el as any).srcObject = ms;
    try {
      el.play().catch(() => {});
    } catch {}
  }, [compact, dense, featured, participant.id, participant.videoTrack, sidebarMode, spotlightMode]);

  const hasLiveVideoTrack = !!participant.videoTrack && participant.videoTrack.readyState === 'live';
  const shouldShowVideo = !!participant.isVideoOn && hasLiveVideoTrack;
  const displayAvatarUrl = participant.isLocal
    ? localSessionAvatarUrl || participant.avatarUrl
    : participant.avatarUrl;

  const tileRadiusClass = compact ? 'rounded-lg' : 'rounded-[1.2rem] md:rounded-[2rem]';
  const avatarRadiusClass = compact ? 'rounded-lg' : 'rounded-[1.1rem] md:rounded-[1.75rem]';
  const transparentSecondaryCard = spotlightMode || sidebarMode;
  const roleLabel = participant.role?.trim() || '\u00A0';
  const canEndSession = !!onEndSession && !participant.isLocal && !participant.isHost;
  const endSessionButton = (small = false) => canEndSession ? (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const confirmed = typeof window === 'undefined'
          ? true
          : window.confirm(`End ${participant.name}'s Loft session?`);
        if (confirmed) onEndSession?.();
      }}
      className={`absolute right-2 top-2 z-40 flex items-center justify-center rounded-lg border border-red-400/35 bg-red-500/85 text-white shadow-xl backdrop-blur-md transition hover:bg-red-500 ${small ? 'h-7 w-7' : 'h-9 w-9'}`}
      aria-label={`End ${participant.name}'s Loft session`}
      data-loft-tooltip="End session"
    >
      <UserX className={small ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </button>
  ) : null;

  if (featured) {
    return (
      <div className="relative h-full min-h-0 w-full">
        <div className={`personal-room-card relative overflow-hidden group shadow-2xl flex aspect-video h-full max-h-full w-full rounded-2xl border bg-[var(--loft-surface)]/70 transition-[border-color,box-shadow,transform] duration-300 hover:border-cafe/40 ${isSpeaking ? 'border-cafe shadow-cafe/30 ring-2 ring-cafe/70 ring-offset-2 ring-offset-[var(--loft-bg)]' : 'border-[var(--loft-border)]'}`}>
          <div className={`absolute inset-0 transition-all duration-500 ring-inset ring-4 ring-cafe z-10 ${isSpeaking ? 'opacity-100' : 'opacity-0'}`} />
          {endSessionButton(false)}
          {isSpeaking && (
            <div className="absolute left-4 top-4 z-30 rounded-full border border-cafe/40 bg-black/45 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-cafe backdrop-blur-md">
              Speaking
            </div>
          )}

          {shouldShowVideo ? (
            <video
              ref={tileVideoRef}
              autoPlay
              playsInline
              muted={!!participant.isLocal}
              className="absolute inset-0 h-full w-full bg-black object-cover"
            />
          ) : displayAvatarUrl ? (
            <img
              src={displayAvatarUrl}
              alt={participant.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6 md:p-8">
              <div className="aspect-square h-[min(72%,22rem)] rounded-[1.75rem] border border-[var(--loft-border)] bg-[var(--loft-surface-2)] shadow-inner flex items-center justify-center overflow-hidden">
                  <span className="text-5xl font-black text-cafe/55 uppercase md:text-6xl">
                    {participant.name.charAt(0)}
                  </span>
              </div>
            </div>
          )}

          {!hideLabels && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-5 pb-4 pt-16">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold leading-none tracking-normal text-white/95 drop-shadow md:text-2xl">
                  {participant.name}
                </div>
                <div className="mt-2 text-[10px] font-medium uppercase leading-none tracking-[0.24em] text-white/70">
                  {roleLabel}
                </div>
              </div>

              <div className="personal-room-card-status-tray flex flex-shrink-0 items-center gap-2">
                <div
                  className={`personal-room-card-status flex h-10 w-10 items-center justify-center rounded-lg border ${
                    participant.audio
                      ? 'bg-green-500/20 border-green-400/35 text-green-300'
                      : 'bg-red-500/20 border-red-400/35 text-red-300'
                  }`}
                  data-loft-tooltip={participant.audio ? 'Microphone on' : 'Microphone muted'}
                >
                  {participant.audio ? <Mic className="personal-room-card-status-icon h-5 w-5" /> : <MicOff className="personal-room-card-status-icon h-5 w-5" />}
                </div>
                <div
                  className={`personal-room-card-status flex h-10 w-10 items-center justify-center rounded-lg border ${
                    shouldShowVideo
                      ? 'bg-green-500/20 border-green-400/35 text-green-300'
                      : 'bg-red-500/20 border-red-400/35 text-red-300'
                  }`}
                  data-loft-tooltip={shouldShowVideo ? 'Camera on' : 'Camera off'}
                >
                  {shouldShowVideo ? <VideoIcon className="personal-room-card-status-icon h-5 w-5" /> : <VideoOff className="personal-room-card-status-icon h-5 w-5" />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (dense) {
    return (
      <div className="relative">
        <div
          className={`personal-room-card relative overflow-hidden group flex ${spotlightMode ? 'aspect-[4/3]' : 'aspect-video'} w-full rounded-xl border transition-[border-color,box-shadow,transform] duration-300 hover:border-cafe/40 ${spotlightMode ? 'bg-transparent shadow-none' : 'bg-[var(--loft-surface)]/75 shadow-2xl'} ${isSpeaking ? 'border-cafe shadow-cafe/25 ring-2 ring-cafe/70 ring-offset-2 ring-offset-[var(--loft-bg)]' : 'border-[var(--loft-border)]'}`}
          style={spotlightMode ? {
            background: 'transparent',
            backgroundImage: 'none',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          } : {}}
        >
          <div className={`absolute inset-0 transition-all duration-500 ring-inset ring-2 ring-cafe z-10 ${isSpeaking ? 'opacity-100' : 'opacity-0'}`} />
          {endSessionButton(true)}
          {isSpeaking && (
            <div className="absolute left-2 top-2 z-30 rounded-full border border-cafe/40 bg-black/45 px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-cafe backdrop-blur-md">
              Speaking
            </div>
          )}

          {shouldShowVideo ? (
            <video
              ref={tileVideoRef}
              autoPlay
              playsInline
              muted={!!participant.isLocal}
              className="absolute inset-0 h-full w-full bg-black object-cover"
            />
          ) : displayAvatarUrl ? (
            <img
              src={displayAvatarUrl}
              alt={participant.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-x-0 top-8 bottom-14 flex items-center justify-center px-3 pb-3 pt-2">
              <div className={`${spotlightMode ? 'h-20 w-20 bg-transparent shadow-none' : 'h-16 w-16 bg-[var(--loft-surface-2)] shadow-inner md:h-20 md:w-20'} rounded-xl border border-[var(--loft-border)] flex items-center justify-center overflow-hidden`}>
                  <span className="text-xl font-black text-cafe/55 uppercase">
                    {participant.name.charAt(0)}
                  </span>
              </div>
            </div>
          )}

          {!hideLabels && (
            <div className={`absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 px-3 pb-2 pt-8 ${spotlightMode ? 'bg-transparent' : 'bg-gradient-to-t from-black/70 via-black/35 to-transparent'}`}>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold leading-none tracking-normal text-white/95 drop-shadow">
                  {participant.name}
                </div>
                <div className="mt-1 text-[7px] font-medium uppercase leading-none tracking-[0.2em] text-white/70">
                  {roleLabel}
                </div>
              </div>

              <div className="personal-room-card-status-tray flex flex-shrink-0 items-center gap-1">
                <div
                  className={`personal-room-card-status personal-room-card-status--dense flex h-7 w-7 items-center justify-center rounded-lg border ${
                    participant.audio
                      ? 'bg-green-500/20 border-green-400/35 text-green-300'
                      : 'bg-red-500/20 border-red-400/35 text-red-300'
                  }`}
                  data-loft-tooltip={participant.audio ? 'Microphone on' : 'Microphone muted'}
                >
                  {participant.audio ? <Mic className="personal-room-card-status-icon personal-room-card-status-icon--dense h-3.5 w-3.5" /> : <MicOff className="personal-room-card-status-icon personal-room-card-status-icon--dense h-3.5 w-3.5" />}
                </div>
                <div
                  className={`personal-room-card-status personal-room-card-status--dense flex h-7 w-7 items-center justify-center rounded-lg border ${
                    shouldShowVideo
                      ? 'bg-green-500/20 border-green-400/35 text-green-300'
                      : 'bg-red-500/20 border-red-400/35 text-red-300'
                  }`}
                  data-loft-tooltip={shouldShowVideo ? 'Camera on' : 'Camera off'}
                >
                  {shouldShowVideo ? <VideoIcon className="personal-room-card-status-icon personal-room-card-status-icon--dense h-3.5 w-3.5" /> : <VideoOff className="personal-room-card-status-icon personal-room-card-status-icon--dense h-3.5 w-3.5" />}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className={`personal-room-card relative overflow-hidden group flex flex-col ${compact ? 'aspect-video' : 'min-h-0'} w-full transition-[border-color,box-shadow,transform] duration-300 hover:border-cafe/40 ${tileRadiusClass} ${transparentSecondaryCard ? 'bg-transparent shadow-none' : shouldShowVideo ? 'bg-transparent shadow-2xl' : 'bg-[var(--loft-surface)]/75 shadow-2xl'} border ${isSpeaking ? 'border-cafe shadow-cafe/25 ring-2 ring-cafe/70 ring-offset-2 ring-offset-[var(--loft-bg)]' : 'border-[var(--loft-border)]'}`} style={transparentSecondaryCard ? {
        backgroundColor: 'transparent',
        background: 'transparent',
        backgroundImage: 'none',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none'
      } : {}}>
        
        {/* Active speaking indicator */}
        <div className={`absolute inset-0 transition-all duration-500 ring-inset ring-2 md:ring-4 ring-cafe z-10 ${isSpeaking ? 'opacity-100' : 'opacity-0'}`} />
        {endSessionButton(compact)}
        {isSpeaking && (
          <div className="absolute left-2 top-2 z-30 rounded-full border border-cafe/40 bg-cafe/20 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-cafe backdrop-blur-md md:left-3 md:top-3">
            Speaking
          </div>
        )}

        <div className={`${compact ? 'flex-1' : 'aspect-video w-full flex-none'} relative overflow-hidden ${compact || shouldShowVideo ? '' : 'p-3 md:p-5'}`}>
          {shouldShowVideo ? (
            <video
              ref={tileVideoRef}
              autoPlay
              playsInline
              muted={!!participant.isLocal}
              className="absolute inset-0 h-full w-full rounded-[inherit] bg-black object-cover"
            />
          ) : displayAvatarUrl ? (
            <img
              src={displayAvatarUrl}
              alt={participant.name}
              className="absolute inset-0 h-full w-full rounded-[inherit] object-cover"
            />
          ) : (
            <div className={`absolute inset-0 flex items-center justify-center ${compact ? 'px-4 pb-3 pt-4 md:px-5 md:pb-4 md:pt-5' : 'p-3 md:p-5'}`}>
              <div className={`${compact ? 'aspect-square h-[min(78%,5rem)] max-h-20 min-h-12' : 'aspect-square h-[min(100%,11rem)] max-w-full'} ${avatarRadiusClass} ${transparentSecondaryCard ? 'bg-transparent shadow-none' : 'bg-[var(--loft-surface-2)] shadow-inner'} border border-[var(--loft-border)] flex items-center justify-center overflow-hidden`}>
                  <span className={`${compact ? 'text-lg md:text-2xl' : 'text-lg md:text-3xl'} font-black text-cafe/55 uppercase`}>
                    {participant.name.charAt(0)}
                  </span>
              </div>
            </div>
          )}
        </div>

        {!hideLabels && (
          <div className={`w-full flex-shrink-0 border-t border-[var(--loft-border)] ${transparentSecondaryCard ? 'bg-transparent' : 'bg-[var(--loft-surface)]/90'} ${compact ? 'px-2 py-2' : 'min-h-[3.5rem] px-3 py-2 md:min-h-[4rem] md:px-4 md:py-3'} flex items-center justify-between z-20`}>
            <div className="flex flex-col min-w-0">
              <span className={`font-semibold text-[var(--loft-text)] tracking-normal ${compact ? 'text-[8px] md:text-[12px]' : 'text-[11px] md:text-[18px]'} truncate leading-none`}>
                {participant.name}
              </span>
              {!compact && (
                <span className="mt-1 h-3 truncate text-[7px] font-medium uppercase tracking-[0.22em] text-muted md:h-3.5 md:text-[10px]">
                  {roleLabel}
                </span>
              )}
            </div>

            {/* 🔥 FIXED: Consistent icon treatment for both audio and video */}
            <div className={`personal-room-card-status-tray flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
              {/* Audio icon */}
              <div
                className={`personal-room-card-status ${compact ? 'personal-room-card-status--compact w-5 h-5' : 'w-7 h-7 md:w-10 md:h-10'} rounded-lg flex items-center justify-center transition-colors border ${
                  participant.audio
                    ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
                data-loft-tooltip={participant.audio ? 'Microphone on' : 'Microphone muted'}
              >
                {participant.audio ? (
                  <Mic className={`personal-room-card-status-icon ${compact ? 'personal-room-card-status-icon--compact w-2.5 h-2.5' : 'w-3 h-3 md:w-5 md:h-5'}`} />
                ) : (
                  <MicOff className={`personal-room-card-status-icon ${compact ? 'personal-room-card-status-icon--compact w-2.5 h-2.5' : 'w-3 h-3 md:w-5 md:h-5'}`} />
                )}
              </div>

              {/* Video icon */}
              <div
                className={`personal-room-card-status ${compact ? 'personal-room-card-status--compact w-5 h-5' : 'w-7 h-7 md:w-10 md:h-10'} rounded-lg flex items-center justify-center transition-colors border ${
                  shouldShowVideo
                    ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}
                data-loft-tooltip={shouldShowVideo ? 'Camera on' : 'Camera off'}
              >
                {shouldShowVideo ? (
                  <VideoIcon className={`personal-room-card-status-icon ${compact ? 'personal-room-card-status-icon--compact w-2.5 h-2.5' : 'w-3 h-3 md:w-5 md:h-5'}`} />
                ) : (
                  <VideoOff className={`personal-room-card-status-icon ${compact ? 'personal-room-card-status-icon--compact w-2.5 h-2.5' : 'w-3 h-3 md:w-5 md:h-5'}`} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalRoomParticipantCard;

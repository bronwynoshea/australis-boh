import React, { useMemo, useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Monitor, MonitorOff, RotateCw } from 'lucide-react';
import PersonalRoomParticipantCard from './PersonalRoomParticipantCard';

interface PersonalRoomGridProps {
  participants: Array<{
    id: string;
    name: string;
    isLocal: boolean;
    audio: boolean;
    video: boolean;
    avatarUrl?: string;
    videoTrack?: MediaStreamTrack;
    isVideoOn: boolean;
    role: string;
    isOnStage: boolean;
    isHost?: boolean;
    backgroundMode?: 'none' | 'blur' | 'image';
  }>;
  layoutMode: 'grid' | 'spotlight' | 'sidebar' | 'screenShare';
  localBackgroundMode?: 'none' | 'blur' | 'image';
  isCurrentUserHost?: boolean;
  onMuteParticipant?: (participantId: string) => void;
  onRemoveParticipant?: (participantId: string) => void;
  activeScreenTrack?: MediaStreamTrack | null;
  showScreenShareOverlay?: boolean;
  onStopScreenShare?: () => void;
}

const PersonalRoomGrid: React.FC<PersonalRoomGridProps> = ({
  participants,
  layoutMode,
  localBackgroundMode = 'none',
  isCurrentUserHost = false,
  onMuteParticipant,
  onRemoveParticipant,
  activeScreenTrack,
  showScreenShareOverlay = false,
  onStopScreenShare,
}) => {
  const screenShareFrameRef = useRef<HTMLDivElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);
  const spotlightTrackRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [screenShareAspectRatio, setScreenShareAspectRatio] = useState('16 / 9');
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);

  const toggleScreenShareFullscreen = useCallback(() => {
    const frame = screenShareFrameRef.current;
    if (!frame) return;

    try {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        frame.requestFullscreen?.();
      }
    } catch {
      // Fullscreen can be unavailable in embedded/mobile browser contexts.
    }
  }, []);

  const scrollSpotlightTrack = useCallback((direction: 'left' | 'right') => {
    const track = spotlightTrackRef.current;
    if (!track) return;

    track.scrollBy({
      left: direction === 'left' ? -360 : 360,
      behavior: 'smooth',
    });
  }, []);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const query = window.matchMedia('(max-width: 767px) and (orientation: portrait)');
    const updateOrientationState = () => setIsPortraitMobile(query.matches);
    updateOrientationState();

    query.addEventListener?.('change', updateOrientationState);
    window.addEventListener('resize', updateOrientationState);
    window.addEventListener('orientationchange', updateOrientationState);

    return () => {
      query.removeEventListener?.('change', updateOrientationState);
      window.removeEventListener('resize', updateOrientationState);
      window.removeEventListener('orientationchange', updateOrientationState);
    };
  }, []);

  React.useEffect(() => {
    const videoEl = screenShareVideoRef.current;
    if (!videoEl) return;

    if (!activeScreenTrack || activeScreenTrack.readyState === 'ended') {
      videoEl.srcObject = null;
      setScreenShareAspectRatio('16 / 9');
      return;
    }

    const updateAspectRatio = () => {
      const settings = activeScreenTrack.getSettings?.() || {};
      const width = Number(settings.width);
      const height = Number(settings.height);
      if (width > 0 && height > 0) {
        setScreenShareAspectRatio(`${width} / ${height}`);
      }
    };

    const stream = new MediaStream([activeScreenTrack]);
    videoEl.srcObject = stream;
    videoEl.muted = true;
    videoEl.playsInline = true;
    updateAspectRatio();
    videoEl.onloadedmetadata = updateAspectRatio;
    videoEl.play().catch(() => {
      // The user can still start playback with a gesture if the browser delays autoplay.
    });

    return () => {
      videoEl.onloadedmetadata = null;
      if (videoEl.srcObject === stream) {
        videoEl.srcObject = null;
      }
    };
  }, [activeScreenTrack, layoutMode]);

  // 🔥 FIX: Memoize sorted participants to prevent unnecessary re-sorts
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      // Host always gets priority for spotlight
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      // For non-hosts, maintain some order but don't prioritize local user
      return 0;
    });
  }, [participants]);

  const gridDensityClass = useMemo(() => {
    const count = sortedParticipants.length;
    if (count <= 1) return 'grid-cols-1 max-w-[min(100%,calc(100dvh-13rem))]';
    if (count <= 2) return 'grid-cols-2 max-w-[min(100%,72rem)]';
    if (count === 3) return 'grid-cols-1 sm:grid-cols-3 max-w-6xl';
    if (count <= 4) return 'grid-cols-2 max-w-[min(100%,calc(100dvh-13rem))]';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3 max-w-5xl';
    if (count <= 9) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-[min(100%,calc((100dvh-17rem)*1.62))]';
    if (count <= 16) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 max-w-[min(100%,calc((100dvh-17rem)*1.72))]';
    return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5 max-w-[min(100%,calc((100dvh-17rem)*2.15))]';
  }, [sortedParticipants.length]);

  // 🔥 FIX: Memoize layout renderers to prevent recreation on every render
  const renderGridLayout = useCallback(() => {
    const shouldUseComfortGrid = sortedParticipants.length >= 5 && sortedParticipants.length <= 6;
    const shouldUseDenseGrid = sortedParticipants.length >= 7;

    if (sortedParticipants.length === 0) {
      return (
        <div className="flex min-h-full w-full items-center justify-center p-4 text-center">
          <div className="rounded-3xl border border-[var(--loft-border)] bg-[var(--loft-surface)]/86 px-6 py-5 shadow-xl backdrop-blur-xl">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-main">Opening Loft session</div>
            <div className="mt-2 text-xs font-semibold text-muted">Your video tile will appear here when the room finishes connecting.</div>
          </div>
        </div>
      );
    }

    if (shouldUseComfortGrid) {
      return (
        <div className="flex min-h-full w-full items-center justify-center p-4 md:p-6">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap justify-center gap-4 md:gap-5 xl:gap-6">
            {sortedParticipants.map((participant) => (
              <div key={participant.id} className="w-[min(100%,18rem)] md:w-[min(31%,18.5rem)]">
                <PersonalRoomParticipantCard
                  participant={{
                    ...participant,
                    isLocal: participant.isLocal,
                    isVideoOn: participant.isVideoOn,
                    isOnStage: true,
                  }}
                  localBackgroundMode={localBackgroundMode}
                  onEndSession={isCurrentUserHost && !participant.isLocal && !participant.isHost ? () => onRemoveParticipant?.(participant.id) : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className={`flex min-h-full w-full justify-center p-3 md:p-4 ${shouldUseDenseGrid ? 'items-start overflow-y-auto pb-28 md:pb-28' : 'items-center'}`}>
        <div className={`grid ${gridDensityClass} w-full mx-auto ${shouldUseDenseGrid ? 'gap-2 md:gap-3' : 'gap-3 md:gap-4 xl:gap-5'}`}>
        {sortedParticipants.map((participant) => (
          <PersonalRoomParticipantCard
            key={participant.id}
            participant={{
              ...participant,
              isLocal: participant.isLocal,
              isVideoOn: participant.isVideoOn,
              isOnStage: true,
            }}
            localBackgroundMode={localBackgroundMode}
                  onEndSession={isCurrentUserHost && !participant.isLocal && !participant.isHost ? () => onRemoveParticipant?.(participant.id) : undefined}
            dense={shouldUseDenseGrid}
          />
        ))}
        </div>
      </div>
    );
  }, [sortedParticipants, localBackgroundMode, gridDensityClass, isCurrentUserHost, onRemoveParticipant]);

  const renderSpotlightLayout = useCallback(() => {
    if (sortedParticipants.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-muted">No participants in the session</div>
            <div className="text-sm text-muted">Waiting for others to join...</div>
          </div>
        </div>
      );
    }

    const spotlightParticipant = sortedParticipants.find((participant) => participant.isHost) || sortedParticipants[0];
    const participantTiles = sortedParticipants.filter((participant) => participant.id !== spotlightParticipant.id);

    return (
      <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden p-3 pb-4 md:gap-5 md:p-5 md:pb-5">
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <div className="aspect-video h-full max-h-[calc(100dvh-28rem)] min-h-[11rem] w-auto max-w-full">
            <PersonalRoomParticipantCard
              participant={{
                ...spotlightParticipant,
                isLocal: spotlightParticipant.isLocal,
                isVideoOn: spotlightParticipant.isVideoOn,
                isOnStage: true,
              }}
              localBackgroundMode={localBackgroundMode}
                  onEndSession={isCurrentUserHost && !spotlightParticipant.isLocal && !spotlightParticipant.isHost ? () => onRemoveParticipant?.(spotlightParticipant.id) : undefined}
              featured={true}
            />
          </div>
        </main>

        {participantTiles.length > 0 && (
          <section className="mt-auto min-h-0 w-full flex-shrink-0 border-t border-[var(--loft-border)] pt-4 md:pt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted">
                Participants
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--loft-border)] bg-[var(--loft-surface-2)] text-muted transition-colors hover:bg-[var(--loft-surface-strong)] hover:text-[var(--loft-text)]"
                  onClick={() => scrollSpotlightTrack('left')}
                  aria-label="Scroll participants left"
                  data-loft-tooltip="Scroll left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="rounded-full border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-2 py-1 text-[10px] font-black text-muted">
                  {participantTiles.length}
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--loft-border)] bg-[var(--loft-surface-2)] text-muted transition-colors hover:bg-[var(--loft-surface-strong)] hover:text-[var(--loft-text)]"
                  onClick={() => scrollSpotlightTrack('right')}
                  aria-label="Scroll participants right"
                  data-loft-tooltip="Scroll right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              ref={spotlightTrackRef}
              className="loft-scrollbar-hidden max-w-full overflow-x-auto overflow-y-hidden bg-transparent pb-2"
              style={{
                overscrollBehaviorX: 'contain',
                background: 'transparent',
                backgroundImage: 'none',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              }}
            >
              <div className="flex w-max gap-2 bg-transparent md:gap-3">
              {participantTiles.map((participant) => (
                <div key={participant.id} className="w-40 flex-shrink-0 sm:w-44 md:w-48">
                  <PersonalRoomParticipantCard
                    participant={{
                      ...participant,
                      isLocal: participant.isLocal,
                      isVideoOn: participant.isVideoOn,
                      isOnStage: true,
                    }}
                    localBackgroundMode={localBackgroundMode}
                  onEndSession={isCurrentUserHost && !participant.isLocal && !participant.isHost ? () => onRemoveParticipant?.(participant.id) : undefined}
                    dense={true}
                    spotlightMode={true}
                  />
                </div>
              ))}
              </div>
            </div>
          </section>
        )}
      </div>
    );
  }, [sortedParticipants, localBackgroundMode, isCurrentUserHost, onRemoveParticipant]);

  const renderSidebarLayout = useCallback(() => {
    if (sortedParticipants.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-muted">No participants in the session</div>
            <div className="text-sm text-muted">Waiting for others to join...</div>
          </div>
        </div>
      );
    }

    const mainParticipant = sortedParticipants.find((participant) => participant.isHost) || sortedParticipants[0];
    const sidebarParticipants = sortedParticipants.filter((participant) => participant.id !== mainParticipant.id);

    return (
      <div className="flex h-full min-h-0 w-full flex-col gap-4 p-3 pb-3 md:flex-row md:gap-6 md:p-5 md:pb-4 lg:p-6">
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-transparent px-2 py-2 md:px-4 md:py-3 lg:px-6">
          <div className="w-full max-w-[min(100%,54rem)]">
            <PersonalRoomParticipantCard
              participant={{
                ...mainParticipant,
                isLocal: mainParticipant.isLocal,
                isVideoOn: mainParticipant.isVideoOn,
                isOnStage: true,
              }}
              localBackgroundMode={localBackgroundMode}
                  onEndSession={isCurrentUserHost && !mainParticipant.isLocal && !mainParticipant.isHost ? () => onRemoveParticipant?.(mainParticipant.id) : undefined}
              sidebarMode={true}
            />
          </div>
        </main>

        {sidebarParticipants.length > 0 && (
          <aside className="flex max-h-36 flex-shrink-0 flex-col overflow-hidden pt-3 md:max-h-none md:h-full md:w-56 lg:w-64 xl:w-72 md:pt-0 sidebar-force-transparent" style={{
            backgroundColor: 'transparent',
            background: 'transparent',
            backgroundImage: 'none',
            backgroundClip: 'initial',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            opacity: 1,
            filter: 'none',
            zIndex: 1000,
            position: 'relative',
            '--loft-bg': 'transparent'
          } as React.CSSProperties}>
            <div className="mb-3 flex flex-shrink-0 items-center justify-between px-1">
              <div className="text-[10px] font-black text-muted uppercase tracking-[0.24em]">
                Participants
              </div>
              <div className="rounded-full bg-[var(--loft-surface-2)]/70 px-2 py-1 text-[10px] font-black text-muted">
                {sidebarParticipants.length}
              </div>
            </div>
            <div className="loft-scrollbar-hidden min-h-0 flex-1 overflow-x-auto overflow-y-hidden md:overflow-x-hidden md:overflow-y-auto sidebar-force-transparent" style={{
              overscrollBehavior: 'contain',
              scrollbarWidth: 'thin',
              scrollbarColor: 'transparent transparent',
              backgroundColor: 'transparent',
              background: 'transparent',
              backgroundImage: 'none',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              opacity: 1,
              filter: 'none',
              zIndex: 1000,
              position: 'relative',
              '--loft-bg': 'transparent'
            } as React.CSSProperties}>
              <div className="flex gap-2 md:grid md:grid-cols-1 md:gap-3">
                {sidebarParticipants.map((participant) => (
                  <div key={participant.id} className="h-28 w-40 flex-shrink-0 md:h-auto md:w-full">
                    <PersonalRoomParticipantCard
                      participant={{
                        ...participant,
                        isLocal: participant.isLocal,
                        isVideoOn: participant.isVideoOn,
                        isOnStage: true,
                      }}
                      localBackgroundMode={localBackgroundMode}
                  onEndSession={isCurrentUserHost && !participant.isLocal && !participant.isHost ? () => onRemoveParticipant?.(participant.id) : undefined}
                      compact={true}
                      sidebarMode={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    );
  }, [sortedParticipants, localBackgroundMode, isCurrentUserHost, onRemoveParticipant]);

  const renderScreenShareLayout = useCallback(() => {
    if (sortedParticipants.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-muted">No participants in the session</div>
            <div className="text-sm text-muted">Waiting for others to join...</div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 w-full flex-col gap-3 p-3 md:flex-row md:gap-4 md:p-4">
        <div className="min-h-0 flex-1 md:h-full">
          <div
            ref={screenShareFrameRef}
            className={`group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-cafe/25 bg-[var(--loft-bg)]/45 p-2 shadow-2xl shadow-cafe/10 md:h-full md:min-h-0 md:p-4 ${
              isFullscreen ? 'h-full' : 'h-auto'
            }`}
          >
            {activeScreenTrack ? (
              <>
                {isPortraitMobile && (
                  <div className="mb-2 flex w-full items-center gap-3 rounded-lg border border-cafe/30 bg-[var(--loft-surface)]/95 px-3 py-2 text-left shadow-xl backdrop-blur-md md:hidden">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-cafe/15 text-cafe">
                      <RotateCw className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--loft-text)]">
                        Rotate for screen sharing
                      </div>
                      <div className="mt-1 text-[11px] font-semibold leading-snug text-muted">
                        Turn your phone sideways or use fullscreen for a readable shared screen.
                      </div>
                    </div>
                  </div>
                )}
                <div
                  className="relative flex max-h-full w-full max-w-full items-center justify-center overflow-hidden rounded-lg bg-black shadow-2xl ring-1 ring-white/10"
                  style={{ aspectRatio: screenShareAspectRatio }}
                >
                  <video
                    ref={screenShareVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="block h-full w-full object-fill"
                  />
                </div>

                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 via-black/20 to-transparent p-3 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/55 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-lg backdrop-blur-md">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                    Screen sharing
                  </div>
                  <div className="pointer-events-auto flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/15"
                      onClick={toggleScreenShareFullscreen}
                      aria-label={isFullscreen ? 'Exit fullscreen' : 'View screen share fullscreen'}
                      data-loft-tooltip={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
                    >
                      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </button>
                    {showScreenShareOverlay && onStopScreenShare && (
                      <button
                        type="button"
                        className="flex h-10 items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/20 px-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-lg backdrop-blur-md transition-colors hover:bg-red-500/35"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onStopScreenShare();
                        }}
                      >
                        <MonitorOff className="h-4 w-4" />
                        Stop
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/70">
                <Monitor className="h-10 w-10" />
                <div className="text-xs font-bold uppercase tracking-[0.24em]">Waiting for shared content</div>
              </div>
            )}
          </div>
        </div>

        <aside className="flex max-h-28 flex-shrink-0 gap-2 overflow-x-auto border-t border-[var(--loft-border)] pt-3 md:max-h-none md:w-44 md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-l md:border-t-0 md:pl-3 md:pt-0">
          <div className="hidden text-[10px] font-black uppercase tracking-[0.24em] text-muted md:block">
            Participants
          </div>
          <div className="flex gap-2 md:flex-col">
            {sortedParticipants.map((participant) => (
              <div 
                key={participant.id} 
                className={`h-20 w-24 flex-shrink-0 overflow-hidden rounded-lg border md:h-24 md:w-full ${
                  participant.isLocal ? 'border-cafe' : 'border-[var(--loft-border)]'
                } bg-[var(--loft-surface-2)] shadow-lg`}
              >
                <PersonalRoomParticipantCard
                  participant={{
                    ...participant,
                    isLocal: participant.isLocal,
                    isVideoOn: participant.isVideoOn,
                    isOnStage: true,
                  }}
                  localBackgroundMode={localBackgroundMode}
                  onEndSession={isCurrentUserHost && !participant.isLocal && !participant.isHost ? () => onRemoveParticipant?.(participant.id) : undefined}
                  compact={true}
                />
              </div>
            ))}
          </div>
        </aside>
      </div>
    );
  }, [activeScreenTrack, sortedParticipants, localBackgroundMode, showScreenShareOverlay, onStopScreenShare, toggleScreenShareFullscreen, isFullscreen, isCurrentUserHost, onRemoveParticipant]);

  // 🔥 FIX: Memoize the current layout renderer
  const renderCurrentLayout = useCallback(() => {
    if (participants.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-muted">No participants in the session</div>
            <div className="text-sm text-muted">Waiting for others to join...</div>
          </div>
        </div>
      );
    }

    switch (layoutMode) {
      case 'spotlight':
        return renderSpotlightLayout();
      case 'sidebar':
        return renderSidebarLayout();
      case 'screenShare':
        return renderScreenShareLayout();
      default:
        return renderGridLayout();
    }
  }, [participants.length, layoutMode, renderSpotlightLayout, renderSidebarLayout, renderScreenShareLayout, renderGridLayout]);

  return (
    <div 
      className={`flex-1 h-full min-h-0 ${layoutMode === 'sidebar' || layoutMode === 'screenShare' || layoutMode === 'grid' ? 'overflow-hidden' : 'overflow-y-auto'}`} 
      style={layoutMode === 'sidebar' || layoutMode === 'screenShare' ? {
        backgroundColor: 'transparent',
        background: 'transparent',
        backgroundImage: 'none',
        backgroundClip: 'initial'
      } as React.CSSProperties : {}}
    >
      {renderCurrentLayout()}
    </div>
  );
};

// 🔥 FIX: Memoize the entire component to prevent unnecessary re-renders
export default React.memo(PersonalRoomGrid, (prevProps, nextProps) => {
  return (
    prevProps.layoutMode === nextProps.layoutMode &&
    prevProps.localBackgroundMode === nextProps.localBackgroundMode &&
    prevProps.isCurrentUserHost === nextProps.isCurrentUserHost &&
    prevProps.activeScreenTrack === nextProps.activeScreenTrack &&
    prevProps.showScreenShareOverlay === nextProps.showScreenShareOverlay &&
    prevProps.onStopScreenShare === nextProps.onStopScreenShare &&
    prevProps.onMuteParticipant === nextProps.onMuteParticipant &&
    prevProps.onRemoveParticipant === nextProps.onRemoveParticipant &&
    prevProps.participants.length === nextProps.participants.length &&
    prevProps.participants.every((prevP, idx) => {
      const nextP = nextProps.participants[idx];
      return (
        prevP.id === nextP?.id &&
        prevP.audio === nextP?.audio &&
        prevP.video === nextP?.video &&
        prevP.isVideoOn === nextP?.isVideoOn &&
        prevP.videoTrack === nextP?.videoTrack &&
        prevP.avatarUrl === nextP?.avatarUrl &&
        prevP.role === nextP?.role &&
        prevP.isOnStage === nextP?.isOnStage &&
        prevP.isHost === nextP?.isHost &&
        prevP.isLocal === nextP?.isLocal &&
        prevP.backgroundMode === nextP?.backgroundMode
      );
    })
  );
});

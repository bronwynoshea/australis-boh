import React from 'react';
import { Hand, LogOut, Mic, MicOff, Monitor, MonitorOff, MessageSquare, Users, Video as VideoIcon, VideoOff, VolumeX } from 'lucide-react';
import type { ReactionType } from '../types';

interface LoftTransportBarProps {
  isSidebarOpen: boolean;
  reactionTypes: ReactionType[];
  onTriggerReaction: (reactionId: string) => void;
  isHost: boolean;
  isOnStage: boolean;
  canRaiseHand?: boolean;
  localHandRaised: boolean;
  onToggleHand: () => void;
  isMicEnabled: boolean;
  onToggleMic: () => void;
  isVideoEnabled: boolean;
  onToggleVideo: () => void;
  isHostScreenSharing: boolean;
  isScreenShareStarting?: boolean;
  screenShareSupported?: boolean;
  onToggleScreenShare: () => void;
  onMuteAll?: () => void;
  hasUnmutedParticipants?: boolean;
  remoteParticipantCount?: number;
  onHostEndRoom: () => void;
  onLeave: () => void;
  onOpenChat?: () => void;
  onOpenQueue?: () => void;
  raisedHandCount?: number;
}

const ControlBtn = ({
  icon,
  onClick,
  color,
  label,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  color: string;
  label: string;
}) => (
  <button
    type="button"
    aria-label={label}
    data-loft-tooltip={label}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`loft-transport-control h-11 w-11 rounded-2xl flex items-center justify-center transition-all border active:scale-95 shrink-0 md:h-12 md:w-12 max-[900px]:h-10 max-[900px]:w-10 max-[900px]:rounded-xl ${color}`}
    style={{ touchAction: 'manipulation', minWidth: '44px', minHeight: '44px' }}
  >
    {icon}
  </button>
);

const LoftTransportBar: React.FC<LoftTransportBarProps> = ({
  isSidebarOpen,
  isHost,
  isOnStage,
  canRaiseHand,
  localHandRaised,
  onToggleHand,
  isMicEnabled,
  onToggleMic,
  isVideoEnabled,
  onToggleVideo,
  isHostScreenSharing,
  isScreenShareStarting = false,
  screenShareSupported = true,
  onToggleScreenShare,
  onMuteAll,
  hasUnmutedParticipants = false,
  remoteParticipantCount = 0,
  onHostEndRoom,
  onLeave,
  onOpenChat,
  onOpenQueue,
  raisedHandCount = 0,
}) => {
  const hasRaisedHands = isHost && raisedHandCount > 0;
  const openConversationPanel = hasRaisedHands && onOpenQueue ? onOpenQueue : onOpenChat;
  const screenShareTitle = !screenShareSupported && !isHostScreenSharing
    ? 'Screen sharing is not available in this browser'
    : isScreenShareStarting
      ? 'Starting screen share'
      : isHostScreenSharing
        ? 'Stop screen share'
        : 'Share screen';
  const screenShareDisabled = isScreenShareStarting || (!screenShareSupported && !isHostScreenSharing);
  const muteAllTitle = remoteParticipantCount === 0
    ? 'No other participants to mute'
    : hasUnmutedParticipants
      ? 'Mute all participants'
      : 'All participants muted';
  const muteAllClass = hasUnmutedParticipants
    ? 'bg-rose-500/10 text-rose-500 dark:text-rose-300 border-rose-400/20 hover:bg-rose-500/16'
    : 'bg-[var(--loft-surface-2)] text-main/50 dark:text-white/50 border-[var(--loft-border)] hover:text-cafe';
  const offControlClass = 'bg-rose-500/10 text-rose-500 dark:text-rose-300 border-rose-400/20 shadow-sm hover:bg-rose-500/16';
  const endControlClass = 'bg-rose-500/12 text-rose-500 dark:text-rose-200 border-rose-400/25 shadow-xl shadow-rose-950/10 hover:bg-rose-500/20';

  return (
    <nav 
      className={`loft-transport-nav w-full pointer-events-auto overflow-visible bg-transparent transition-all duration-500 ${isSidebarOpen ? 'md:pr-[400px]' : ''}`}
      style={{
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      <div className="loft-transport-outer mx-auto overflow-visible px-2 md:px-12 max-[900px]:px-2">
        <div className="loft-transport-shell mx-auto flex w-fit max-w-[calc(100vw-1rem)] items-center justify-center gap-2 loft-glass-strong rounded-[2rem] border border-[var(--loft-border)] px-3 py-2 shadow-2xl text-main dark:text-white overflow-visible md:gap-3 md:px-4 md:py-3 max-[900px]:gap-1.5 max-[900px]:rounded-2xl max-[900px]:px-2 max-[900px]:py-1.5" style={{ WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'manipulation', position: 'relative', zIndex: 101 }}>
        <div className="flex items-center justify-start">
          {openConversationPanel && (
            <div className="relative">
              <ControlBtn
                label={hasRaisedHands ? `${raisedHandCount} raised ${raisedHandCount === 1 ? 'hand' : 'hands'}` : 'Open chat and queue'}
                icon={hasRaisedHands ? <Hand className="w-5 h-5 fill-current" /> : <MessageSquare className="w-5 h-5" />}
                onClick={openConversationPanel}
                color={hasRaisedHands ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.32)]' : 'bg-[var(--loft-surface-2)] text-main/70 dark:text-white/70 border-[var(--loft-border)] shadow-sm hover:text-cafe'}
              />
              {hasRaisedHands && (
                <span className="absolute -right-1.5 -top-1.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white border border-white/70 shadow-lg flex items-center justify-center text-[10px] font-black leading-none">
                  {raisedHandCount > 9 ? '9+' : raisedHandCount}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 px-1 md:gap-3 md:px-2 max-[900px]:gap-1.5 max-[900px]:px-0">
          {canRaiseHand && (
            <ControlBtn
              label={localHandRaised ? 'Lower hand' : 'Raise hand'}
              icon={<Hand className={`w-5 h-5 ${localHandRaised ? 'fill-current' : ''}`} />}
              onClick={onToggleHand}
              color={localHandRaised ? 'bg-amber-500 text-white border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.32)]' : 'bg-[var(--loft-surface-2)] text-main/70 dark:text-white/70 border-[var(--loft-border)] shadow-sm hover:text-cafe'}
            />
          )}

          {isOnStage && (
            <div className="flex items-center gap-2 border-x border-[var(--loft-border)] px-2 md:gap-3 md:px-4 max-[900px]:gap-1.5 max-[900px]:px-1.5">
              <ControlBtn
                label={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                icon={isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                onClick={onToggleMic}
                color={isMicEnabled ? 'bg-[var(--loft-surface-2)] text-main/70 dark:text-white/70 border-[var(--loft-border)] shadow-sm hover:text-cafe' : offControlClass}
              />
              <ControlBtn
                label={isVideoEnabled ? 'Turn camera off' : 'Turn camera on'}
                icon={isVideoEnabled ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                onClick={onToggleVideo}
                color={isVideoEnabled ? 'bg-[var(--loft-surface-2)] text-main/70 dark:text-white/70 border-[var(--loft-border)] shadow-sm hover:text-cafe' : offControlClass}
              />
              {isHost && (
                <>
                  <button
                    type="button"
                    aria-label={screenShareTitle}
                    data-loft-tooltip={screenShareTitle}
                    disabled={screenShareDisabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleScreenShare();
                    }}
                    className={`loft-transport-control h-11 w-11 rounded-2xl flex items-center justify-center transition-all border active:scale-95 shrink-0 md:h-12 md:w-12 max-[900px]:h-10 max-[900px]:w-10 max-[900px]:rounded-xl ${
                      isHostScreenSharing
                        ? 'bg-cafe text-white border-white/20 shadow-lg shadow-[color-mix(in_srgb,var(--loft-accent)_30%,transparent)]'
                        : 'bg-[var(--loft-surface-2)] text-main/70 dark:text-white/70 border-[var(--loft-border)] shadow-sm hover:text-cafe'
                    } ${screenShareDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ touchAction: 'manipulation', minWidth: '44px', minHeight: '44px' }}
                  >
                    {isHostScreenSharing || isScreenShareStarting ? <Monitor className="w-5 h-5" /> : <MonitorOff className="w-5 h-5" />}
                  </button>
                  {onMuteAll && (
                    <button
                      type="button"
                      aria-label={muteAllTitle}
                      data-loft-tooltip={muteAllTitle}
                      onClick={(event) => {
                        event.stopPropagation();
                        onMuteAll();
                      }}
                    className={`loft-transport-control h-11 w-11 rounded-2xl flex items-center justify-center transition-all border active:scale-95 shrink-0 md:h-12 md:w-12 max-[900px]:h-10 max-[900px]:w-10 max-[900px]:rounded-xl ${muteAllClass}`}
                      style={{ touchAction: 'manipulation', minWidth: '44px', minHeight: '44px' }}
                    >
                      <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
                        <Users className="h-5 w-5" />
                        <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--loft-glass-strong)]">
                          <VolumeX className="h-3 w-3" />
                        </span>
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 max-[900px]:gap-1.5">
          {isHost && (
            <button
              onClick={onHostEndRoom}
              aria-label="End Table For Everyone"
              data-loft-tooltip="End table for everyone"
              className={`loft-transport-end hidden lg:flex items-center gap-2 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.24em] active:scale-95 transition-all ${endControlClass}`}
              style={{ touchAction: 'manipulation', minHeight: '44px' }}
            >
              End Table
            </button>
          )}
          <button
            onClick={onLeave}
            aria-label="Leave Table"
            data-loft-tooltip="Leave table"
            className={`loft-transport-control h-11 w-11 rounded-2xl flex items-center justify-center active:scale-95 shrink-0 transition-colors md:h-12 md:w-12 max-[900px]:h-10 max-[900px]:w-10 max-[900px]:rounded-xl ${endControlClass}`}
            style={{ touchAction: 'manipulation', minWidth: '44px', minHeight: '44px' }}
          >
            <span className="sr-only">Leave Table</span>
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        </div>
      </div>
    </nav>
  );
};

export default LoftTransportBar;

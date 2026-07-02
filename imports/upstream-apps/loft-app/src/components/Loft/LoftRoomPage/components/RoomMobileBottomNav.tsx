import React from 'react';
import { Mic, MicOff, Video, VideoOff, Hand, Monitor, MonitorOff, LogOut, Users, VolumeX } from 'lucide-react';
import type { ReactionType } from '../types';

interface RoomMobileBottomNavProps {
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
}

const RoomMobileBottomNav: React.FC<RoomMobileBottomNavProps> = ({
  reactionTypes,
  onTriggerReaction,
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
}) => {
  const screenShareDisabled = isScreenShareStarting || (!screenShareSupported && !isHostScreenSharing);
  const screenShareTitle = !screenShareSupported && !isHostScreenSharing
    ? 'Screen sharing is not available in this browser'
    : isScreenShareStarting
      ? 'Starting screen share'
      : isHostScreenSharing
        ? 'Stop screen share'
        : 'Start screen share';
  const muteAllTitle = remoteParticipantCount === 0
    ? 'No other participants to mute'
    : hasUnmutedParticipants
      ? 'Mute all participants'
      : 'All participants muted';
  const handleTouchStart = (e: React.TouchEvent, handler: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    handler();
  };

  const handlePointerDown = (e: React.PointerEvent, handler: () => void) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      e.preventDefault();
      e.stopPropagation();
      handler();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[var(--loft-surface-2)] border-t border-[var(--loft-border)] z-[1000] md:hidden safe-area-bottom backdrop-blur-3xl">
      <div className="flex items-center justify-around py-2 px-4">
        {/* Mic Button */}
        <button
          type="button"
          onPointerDown={(e) => handlePointerDown(e, onToggleMic)}
          onTouchStart={(e) => handleTouchStart(e, onToggleMic)}
          onClick={onToggleMic}
          className={`w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-95 ${
            isMicEnabled 
              ? 'bg-cafe text-white shadow-lg shadow-cafe/30' 
              : 'bg-[var(--loft-surface)] border border-[var(--loft-border)] text-main/60 dark:text-white/60'
          }`}
          style={{ touchAction: 'manipulation' }}
          aria-label={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Video Button */}
        <button
          type="button"
          onPointerDown={(e) => handlePointerDown(e, onToggleVideo)}
          onTouchStart={(e) => handleTouchStart(e, onToggleVideo)}
          onClick={onToggleVideo}
          className={`w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-95 ${
            isVideoEnabled 
              ? 'bg-cafe text-white shadow-lg shadow-cafe/30' 
              : 'bg-[var(--loft-surface)] border border-[var(--loft-border)] text-main/60 dark:text-white/60'
          }`}
          style={{ touchAction: 'manipulation' }}
          aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Hand Raise Button (for non-hosts) */}
        {!isHost && canRaiseHand && (
          <button
            type="button"
            onPointerDown={(e) => handlePointerDown(e, onToggleHand)}
            onTouchStart={(e) => handleTouchStart(e, onToggleHand)}
            onClick={onToggleHand}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-95 ${
              localHandRaised 
                ? 'bg-cafe text-white shadow-lg shadow-cafe/30' 
                : 'bg-[var(--loft-surface)] border border-[var(--loft-border)] text-main/60 dark:text-white/60'
            }`}
            style={{ touchAction: 'manipulation' }}
            aria-label={localHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="w-5 h-5" />
          </button>
        )}

        {/* Screen Share Button (for hosts) */}
        {isHost && (
          <button
            type="button"
            onPointerDown={(e) => handlePointerDown(e, onToggleScreenShare)}
            onTouchStart={(e) => handleTouchStart(e, onToggleScreenShare)}
            onClick={onToggleScreenShare}
            disabled={screenShareDisabled}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-95 ${
              isHostScreenSharing 
                ? 'bg-cafe text-white shadow-lg shadow-cafe/30' 
                : 'bg-[var(--loft-surface)] border border-[var(--loft-border)] text-main/60 dark:text-white/60'
            } ${screenShareDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ touchAction: 'manipulation' }}
            aria-label={screenShareTitle}
          >
            {isHostScreenSharing || isScreenShareStarting ? <Monitor className="w-5 h-5" /> : <MonitorOff className="w-5 h-5" />}
          </button>
        )}

        {isHost && onMuteAll && (
          <button
            type="button"
            onPointerDown={(e) => handlePointerDown(e, onMuteAll)}
            onTouchStart={(e) => handleTouchStart(e, onMuteAll)}
            onClick={onMuteAll}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-95 ${
              hasUnmutedParticipants
                ? 'bg-red-500/15 text-red-500 border border-red-500/30'
                : 'bg-[var(--loft-surface)] border border-[var(--loft-border)] text-main/50 dark:text-white/50'
            }`}
            style={{ touchAction: 'manipulation' }}
            aria-label={muteAllTitle}
            title={muteAllTitle}
          >
            <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
              <Users className="h-5 w-5" />
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--loft-glass-strong)]">
                <VolumeX className="h-3 w-3" />
              </span>
            </span>
          </button>
        )}

        {/* Leave/End Room Button */}
        <button
          type="button"
          onPointerDown={(e) => handlePointerDown(e, isHost ? onHostEndRoom : onLeave)}
          onTouchStart={(e) => handleTouchStart(e, isHost ? onHostEndRoom : onLeave)}
          onClick={isHost ? onHostEndRoom : onLeave}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500 text-white transition-all active:scale-95"
          style={{ touchAction: 'manipulation' }}
          aria-label={isHost ? 'End room for all' : 'Leave room'}
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default RoomMobileBottomNav;

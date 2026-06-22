import React from 'react';
import { Mic, MicOff, Video as VideoIcon, VideoOff, Monitor, MonitorOff, MessageCircle, LogOut, Users, VolumeX } from 'lucide-react';
import { getIconButtonClass } from '../utils/buttonStyles';

interface PersonalRoomTransportBarProps {
  isMicEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isScreenShareStarting?: boolean;
  screenShareSupported?: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onMuteAll?: () => void;
  hasUnmutedParticipants?: boolean;
  remoteParticipantCount?: number;
  onOpenSettings: () => void;
  onOpenChat: () => void;
  onLeave: () => void;
  isHost?: boolean;
  activeScreenOwnerId?: string | null;
  isCurrentUserOwnerOrHost?: boolean;
}

const PersonalRoomTransportBar: React.FC<PersonalRoomTransportBarProps> = ({
  isMicEnabled,
  isVideoEnabled,
  isScreenSharing,
  isScreenShareStarting = false,
  screenShareSupported = true,
  onToggleMic,
  onToggleVideo,
  onToggleScreenShare,
  onMuteAll,
  hasUnmutedParticipants = false,
  remoteParticipantCount = 0,
  onOpenSettings,
  onOpenChat,
  onLeave,
  isHost = false,
  activeScreenOwnerId,
  isCurrentUserOwnerOrHost = false,
}) => {
  const canControlShare = isCurrentUserOwnerOrHost;
  const isScreenShareActiveAndNotControllable = isScreenSharing && !canControlShare;
  const isScreenShareDisabled = isScreenShareStarting || isScreenShareActiveAndNotControllable || (!screenShareSupported && !isScreenSharing);
  const screenShareTitle = !screenShareSupported && !isScreenSharing
    ? 'Screen sharing is not available in this browser'
    : isScreenShareStarting
      ? 'Starting screen share'
      : isScreenSharing
        ? canControlShare ? 'Stop sharing screen' : 'Viewing shared screen'
        : 'Share screen';
  const muteAllTitle = remoteParticipantCount === 0
    ? 'No other participants to mute'
    : hasUnmutedParticipants
      ? 'Mute all participants'
      : 'All participants muted';
  const muteAllClass = hasUnmutedParticipants
    ? 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/25 hover:bg-red-500/20'
    : 'bg-[var(--loft-surface-2)] text-muted border-[var(--loft-border)] hover:bg-[var(--loft-surface-strong)]';

  return (
    <div className="personal-room-transport px-4 py-4 safe-area-bottom bg-[var(--loft-glass-strong)] backdrop-blur-lg border-t border-[var(--loft-border)]"
      style={{
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        WebkitTapHighlightColor: 'transparent', 
        WebkitUserSelect: 'none', 
        userSelect: 'none', 
        touchAction: 'manipulation'
      }}>
      <div className="personal-room-transport-shell flex items-center justify-center gap-3 max-w-2xl mx-auto">
        {/* Mic toggle - GREEN when ON, RED when OFF */}
        <button
          onClick={onToggleMic}
          className={`personal-room-transport-control ${getIconButtonClass(isMicEnabled, 'green', 'red')}`}
          style={{ borderRadius: '0.5rem' }}
          data-loft-tooltip={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
          aria-label={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
          aria-pressed={isMicEnabled}
        >
          {isMicEnabled ? (
            <Mic className="w-5 h-5" aria-hidden="true" />
          ) : (
            <MicOff className="w-5 h-5" aria-hidden="true" />
          )}
        </button>

        {/* Video toggle - GREEN when ON, RED when OFF */}
        <button
          onClick={onToggleVideo}
          className={`personal-room-transport-control ${getIconButtonClass(isVideoEnabled, 'green', 'red')}`}
          style={{ borderRadius: '0.5rem' }}
          data-loft-tooltip={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          aria-label={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          aria-pressed={isVideoEnabled}
        >
          {isVideoEnabled ? (
            <VideoIcon className="w-5 h-5" aria-hidden="true" />
          ) : (
            <VideoOff className="w-5 h-5" aria-hidden="true" />
          )}
        </button>

        {/* Screen share toggle - GREEN when sharing, RED when not */}
        <button
          onClick={onToggleScreenShare}
          disabled={isScreenShareDisabled}
          className={`personal-room-transport-control ${getIconButtonClass(isScreenSharing, 'green', 'red')} ${isScreenShareDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{ borderRadius: '0.5rem' }}
          data-loft-tooltip={screenShareTitle}
          aria-label={screenShareTitle}
          aria-pressed={isScreenSharing}
        >
          {isScreenSharing || isScreenShareStarting ? (
            <Monitor className="w-5 h-5" aria-hidden="true" />
          ) : (
            <MonitorOff className="w-5 h-5" aria-hidden="true" />
          )}
        </button>

        {/* 🔥 FIX: Mute all participants button - Host only */}
        {isHost && onMuteAll && (
          <button
            onClick={onMuteAll}
          className={`personal-room-transport-control p-3 border transition-all flex items-center justify-center ${muteAllClass}`}
            style={{ borderRadius: '0.5rem' }}
            data-loft-tooltip={muteAllTitle}
            aria-label={muteAllTitle}
          >
            <span className="relative flex h-5 w-5 items-center justify-center" aria-hidden="true">
              <Users className="h-5 w-5" />
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--loft-glass-strong)]">
                <VolumeX className="h-3 w-3" />
              </span>
            </span>
          </button>
        )}

        <button
          onClick={onOpenChat}
          className="personal-room-transport-control p-3 bg-cafe/10 text-cafe border border-cafe/25 hover:bg-cafe/20 transition-all flex items-center justify-center"
          style={{ borderRadius: '0.5rem' }}
          data-loft-tooltip="Open chat"
          aria-label="Open chat"
        >
          <MessageCircle className="w-5 h-5" aria-hidden="true" />
        </button>

        <button
          onClick={onLeave}
          className={`personal-room-transport-end px-4 py-3 transition-all font-bold text-sm uppercase tracking-widest flex items-center gap-2 ${
            isHost 
              ? 'bg-cafe text-[var(--loft-accent-contrast)] hover:opacity-90 border border-cafe/50' 
              : 'bg-red-600 text-white hover:bg-red-700 border border-red-500/50'
          }`}
          style={{ borderRadius: '0.5rem' }}
          data-loft-tooltip={isHost ? 'End session for everyone' : 'Leave session'}
          aria-label={isHost ? 'End session for everyone' : 'Leave session'}
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          {isHost ? 'END' : 'LEAVE'}
        </button>
      </div>
    </div>
  );
};

export default PersonalRoomTransportBar;

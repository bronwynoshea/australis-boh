import React, { useState, useEffect } from 'react';
import { MonitorOff, Monitor, LogOut, Radio } from 'lucide-react';

interface ScreenShareToolbarProps {
  isScreenSharing: boolean;
  isRecording: boolean;
  isHost: boolean;
  isScreenShareOwner?: boolean;
  onStopScreenShare: () => void;
  onToggleRecording: () => void;
  onLeave: () => void;
}

const ScreenShareToolbar: React.FC<ScreenShareToolbarProps> = ({
  isScreenSharing,
  isRecording,
  isHost,
  isScreenShareOwner = false,
  onStopScreenShare,
  onToggleRecording,
  onLeave,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);

  // Auto-hide after 3 seconds if not hovered
  useEffect(() => {
    if (!isScreenSharing) return;

    const timeout = setTimeout(() => {
      if (!isHovered) {
        setIsVisible(false);
      }
    }, 3000);

    setHideTimeout(timeout);

    return () => {
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [isScreenSharing, isHovered]);

  if (!isScreenSharing) return null;

  const handleMouseEnter = () => {
    setIsHovered(true);
    setIsVisible(true);
    if (hideTimeout) clearTimeout(hideTimeout);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    const timeout = setTimeout(() => {
      setIsVisible(false);
    }, 1000);
    setHideTimeout(timeout);
  };

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[1001] transition-all duration-500 ease-out"
      style={{
        top: isVisible ? '24px' : '-80px',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover trigger area - invisible but captures mouse */}
      <div
        className="absolute -top-16 left-0 right-0 h-20"
        onMouseEnter={handleMouseEnter}
      />

      {/* Main toolbar */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all"
        style={{
          backgroundColor: 'var(--loft-glass-strong)',
          borderColor: 'var(--loft-border)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.28), 0 0 0 1px var(--loft-border)',
        }}
      >
        {/* Loft branding indicator */}
        <div className="flex items-center gap-2 pr-3 border-r border-[var(--loft-border)]">
          <div className="w-2 h-2 rounded-full bg-cafe animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
            Loft
          </span>
        </div>

        {/* Stop Sharing - Primary action (only if owner) */}
        {isScreenShareOwner ? (
          <button
            onClick={onStopScreenShare}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
            title="Stop sharing screen"
            aria-label="Stop sharing screen"
          >
            <MonitorOff className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Stop Sharing</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--loft-surface-2)] text-muted border border-[var(--loft-border)]">
            <Monitor className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Viewing</span>
          </div>
        )}

        {/* Recording toggle - Host only */}
        {isHost && (
          <button
            onClick={onToggleRecording}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
              isRecording
                ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse'
                : 'bg-[var(--loft-surface-2)] text-muted border-[var(--loft-border)] hover:bg-[var(--loft-surface-strong)]'
            }`}
            title={isRecording ? 'Stop recording' : 'Start recording'}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <Radio className={`w-4 h-4 ${isRecording ? 'fill-current' : ''}`} />
            <span className="text-xs font-bold uppercase tracking-wider">
              {isRecording ? 'Recording' : 'Record'}
            </span>
          </button>
        )}

        {/* Leave button */}
        <button
          onClick={onLeave}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
            isHost
              ? 'bg-cafe/15 text-cafe border-cafe/30 hover:bg-cafe/25'
              : 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
          }`}
          title={isHost ? 'End session' : 'Leave session'}
          aria-label={isHost ? 'End session' : 'Leave session'}
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">
            {isHost ? 'End' : 'Leave'}
          </span>
        </button>
      </div>

      {/* Subtle hint when hidden */}
      {!isVisible && (
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-8 w-12 h-1 rounded-full bg-cafe/30 opacity-60"
          onMouseEnter={handleMouseEnter}
        />
      )}
    </div>
  );
};

export default ScreenShareToolbar;

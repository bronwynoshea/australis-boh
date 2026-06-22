import React from 'react';
import { Hand, Settings, Users, Circle } from 'lucide-react';

interface RoomHeaderProps {
  roomTitle?: string;
  participantCount: number;
  isRecorded: boolean;
  onOpenSetup: () => void;
  showSetupButton?: boolean;
  canRecord?: boolean;
  onToggleRecording?: () => void;
  queueCount?: number;
  onOpenQueue?: () => void;
  previewEnabled?: boolean;
  onTogglePreview?: () => void;
}

const RoomHeader: React.FC<RoomHeaderProps> = ({
  roomTitle,
  participantCount,
  isRecorded,
  onOpenSetup,
  showSetupButton = true,
  canRecord = false,
  onToggleRecording,
  queueCount = 0,
  onOpenQueue,
  previewEnabled = false,
  onTogglePreview,
}) => {
  const hasQueue = queueCount > 0;

  return (
    <header 
      className="px-3 md:px-6 py-4 flex items-center justify-between border-b border-black/5 dark:border-white/10 backdrop-blur-3xl bg-transparent relative z-[100]" 
      style={{ 
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        WebkitTapHighlightColor: 'transparent', 
        WebkitUserSelect: 'none', 
        userSelect: 'none', 
        touchAction: 'manipulation' 
      }}
    >
      <div className="flex flex-col min-w-0">
        <h1 className="text-md md:text-2xl font-bold uppercase tracking-tighter text-main dark:text-white truncate max-w-[200px] md:max-w-md">
          {roomTitle}
        </h1>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-2 text-main/50 dark:text-white/40 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">
            <Users className="w-3 h-3" /> {participantCount} Active
          </div>
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[8px] md:text-[9px] font-bold uppercase tracking-widest ${
            isRecorded 
              ? 'bg-red-500/10 text-red-600 border-red-500/20' 
              : 'bg-black/5 dark:bg-white/5 text-main/40 dark:text-white/30 border-black/10 dark:border-white/10'
          }`}>
            <Circle className={`w-2 h-2 ${isRecorded ? 'fill-red-500 animate-pulse' : 'fill-current'}`} />
            {isRecorded ? 'Recording' : 'Not Recording'}
          </div>
          {canRecord && onToggleRecording && (
            <button
              onClick={onToggleRecording}
              className={`px-2 py-1 rounded-lg border text-[8px] md:text-[9px] font-bold uppercase tracking-widest transition-colors ${
                isRecorded 
                  ? 'bg-red-500 text-white border-red-400' 
                  : 'bg-black/5 dark:bg-white/5 text-main/60 dark:text-white/40 border-black/10 dark:border-white/5'
              }`}
            >
              {isRecorded ? 'Stop' : 'Record'}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onTogglePreview && (
          <button
            type="button"
            onClick={onTogglePreview}
            className={`hidden h-10 items-center gap-2 rounded-lg border px-3 text-[10px] font-black uppercase tracking-[0.16em] transition-all md:flex ${
              previewEnabled
                ? 'border-cafe/40 bg-cafe/15 text-cafe shadow-lg shadow-cafe/10'
                : 'border-[var(--loft-border)] bg-[var(--loft-surface-2)] text-main/60 dark:text-white/60 hover:bg-[var(--loft-surface-strong)]'
            }`}
            aria-pressed={previewEnabled}
            aria-label={previewEnabled ? 'Hide preview participants' : 'Show preview participants'}
            data-loft-tooltip={previewEnabled ? 'Hide preview participants' : 'Show preview participants'}
            data-loft-tooltip-placement="bottom"
          >
            <Users className="h-4 w-4" />
            {previewEnabled ? 'Preview on' : 'Preview'}
          </button>
        )}
        {onOpenQueue && (
          <button
            type="button"
            onClick={onOpenQueue}
            className={`relative flex h-10 w-10 items-center justify-center rounded-lg border transition-all md:h-11 md:w-11 ${
              hasQueue
                ? 'border-amber-400/45 bg-amber-500/18 text-amber-200 shadow-lg shadow-amber-500/15'
                : 'border-[var(--loft-border)] bg-[var(--loft-surface-2)] text-main/55 dark:text-white/55 hover:bg-[var(--loft-surface-strong)]'
            }`}
            aria-label={hasQueue ? `${queueCount} waiting in the queue` : 'Open participant queue'}
            data-loft-tooltip={hasQueue ? `${queueCount} waiting in the queue` : 'Open participant queue'}
            data-loft-tooltip-placement="bottom"
          >
            <Hand className={`h-5 w-5 ${hasQueue ? 'fill-current' : ''}`} />
            {hasQueue && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-white/60 bg-amber-400 px-1 text-[10px] font-black leading-none text-black shadow-lg">
                {queueCount > 9 ? '9+' : queueCount}
              </span>
            )}
          </button>
        )}
        {showSetupButton && (
          <button
            type="button"
            onClick={() => { onOpenSetup(); }}
            className="p-2.5 md:p-3 rounded-xl transition-all bg-black/5 dark:bg-white/5 text-main/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10 active:scale-90 pointer-events-auto"
            style={{ touchAction: 'manipulation', minWidth: '44px', minHeight: '44px' }}
            aria-label="Open setup"
            title="Setup"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  );
};

export default RoomHeader;

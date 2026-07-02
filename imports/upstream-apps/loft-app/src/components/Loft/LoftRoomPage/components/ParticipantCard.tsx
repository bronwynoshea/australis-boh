import React, { useEffect, useRef } from 'react';
import { MicOff, VideoOff, Mic, Video as VideoIcon } from 'lucide-react';
import { Participant, BackgroundMode } from '../types';
import { LoftRole } from '@/types';

interface ParticipantCardProps {
  participant: Participant;
  isHost?: boolean;
  localBackgroundMode?: BackgroundMode;
  aspectClassName?: string;
}

const ParticipantCard: React.FC<ParticipantCardProps> = ({ participant, localBackgroundMode, aspectClassName = 'aspect-square' }) => {
  const tileVideoRef = useRef<HTMLVideoElement>(null);

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
      el.play().catch(() => {
        // ignore
      });
    } catch {
      // ignore
    }
  }, [participant.videoTrack]);

  const isLocalBlur = !!participant.isLocal && localBackgroundMode === 'blur';

  const shouldShowVideo = !!participant.isVideoOn && !!participant.videoTrack;
  const isHostRole = participant.role === LoftRole.HOST;
  const isSpeakerRole = participant.role === LoftRole.SPEAKER || participant.role === LoftRole.COHOST;
  const roleLabel = isHostRole ? 'Host' : isSpeakerRole ? 'On stage' : 'Listener';
  const stageTone = isHostRole
    ? 'border-[color-mix(in_srgb,var(--loft-accent)_68%,transparent)] shadow-[0_22px_70px_rgba(79,99,215,0.18)]'
    : 'border-[var(--loft-border)] shadow-xl';
  const activeRing = participant.audio
    ? isHostRole
      ? 'opacity-100 ring-[color-mix(in_srgb,var(--loft-accent)_72%,transparent)]'
      : 'opacity-100 ring-[color-mix(in_srgb,var(--loft-text)_26%,transparent)]'
    : 'opacity-0 ring-transparent';

  return (
    <div className={`localTileWrap ${isLocalBlur ? 'bg-blur-on' : ''}`}>
      <div className={`loft-stage-participant-card relative loft-card overflow-hidden group flex flex-col ${aspectClassName} w-full transition-all border ${stageTone}`}>
        <div className={`absolute inset-0 transition-all duration-500 ring-inset ring-2 z-10 ${activeRing}`} />
        <div className="flex-1 relative min-h-0 overflow-hidden bg-gradient-to-br from-[color-mix(in_srgb,var(--loft-accent)_8%,transparent)] to-transparent">
          {shouldShowVideo ? (
            <video
              ref={tileVideoRef}
              autoPlay
              playsInline
              muted={!!participant.isLocal}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-black/5 shadow-inner dark:border-white/10 dark:bg-white/5 md:h-28 md:w-28">
                {participant.avatarUrl ? (
                  <img
                    src={participant.avatarUrl}
                    alt={participant.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-3xl font-black uppercase text-main/20 dark:text-white/10 md:text-6xl">
                    {participant.name?.charAt(0) || '?'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="w-full flex-shrink-0 bg-[var(--loft-surface-strong)] border-t border-[var(--loft-border)] px-3 py-3 md:px-4 md:py-3.5 flex flex-col gap-2 z-20">
          <span className="min-w-0 truncate font-black uppercase leading-none tracking-wide text-main dark:text-white text-[11px] md:text-[14px]">
            {participant.name}
          </span>

          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate font-bold uppercase tracking-[0.28em] text-main/45 dark:text-white/40 text-[7px] md:text-[9px]">{roleLabel}</span>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center">
                {participant.audio ? (
                  <div className="w-full h-full rounded-lg flex items-center justify-center border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400">
                    <Mic className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </div>
                ) : (
                  <div className="w-full h-full rounded-lg flex items-center justify-center border border-rose-400/20 bg-rose-500/10">
                    <MicOff className="w-3.5 h-3.5 md:w-4 md:h-4 text-rose-300" />
                  </div>
                )}
              </div>

              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center">
                {participant.video ? (
                  <div className="w-full h-full rounded-lg flex items-center justify-center border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400">
                    <VideoIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </div>
                ) : (
                  <div className="w-full h-full rounded-lg flex items-center justify-center border border-rose-400/20 bg-rose-500/10">
                    <VideoOff className="w-3.5 h-3.5 md:w-4 md:h-4 text-rose-300" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticipantCard;

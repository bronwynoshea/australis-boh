import React from 'react';
import { ChevronDown } from 'lucide-react';
import AnimatedBackgroundBlobs from '../../AnimatedBackgroundBlobs';

interface JoinGateScreenProps {
  title?: string;
  joinBlockedMessage?: string | null;
  roomInitError?: string | null;
  onTap?: () => void;
  tapLabel?: string;
  tapDisabled?: boolean;
  showDiagnostics?: boolean;
  diagnostics?: string[];
}

const JoinGateScreen: React.FC<JoinGateScreenProps> = ({
  title = 'Tap to join',
  joinBlockedMessage,
  roomInitError,
  onTap,
  tapLabel,
  tapDisabled = false,
  showDiagnostics,
  diagnostics = [],
}) => {
  const bodyText = joinBlockedMessage || roomInitError || null;
  const buttonLabel = tapLabel || 'Tap to join';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 9999 }}>
      <div className="fixed inset-0 z-[550] flex items-center justify-center pointer-events-auto bg-[var(--loft-bg)]/40 backdrop-blur-xl">
        <AnimatedBackgroundBlobs />
        <div className="relative z-[560] loft-card loft-card--flat px-7 sm:px-10 py-8 sm:py-10 shadow-2xl w-[min(92vw,30rem)] mx-6 text-center bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-3xl space-y-6 text-main">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] shadow-lg">
            <img src="/brand/loft-icon-signal-final-light.svg" alt="Loft" className="h-10 w-10 dark:hidden" />
            <img src="/brand/loft-icon-signal-final-dark.svg" alt="Loft" className="hidden h-10 w-10 dark:block" />
          </div>
          <div className="space-y-2">
            <div className="text-xl font-black text-main uppercase tracking-tight">{title}</div>
            <div className="mx-auto h-1 w-16 rounded-full bg-[var(--loft-accent)]/75" />
          </div>
          {bodyText ? (
            <div className="text-[11px] font-bold text-muted whitespace-pre-line">{bodyText}</div>
          ) : (
            <div className="text-[11px] font-bold text-muted">
              Enter the session. You can adjust your mic, camera, and background from settings once you are inside.
            </div>
          )}
          {onTap && (
            <button
              type="button"
              onClick={onTap}
              disabled={tapDisabled}
              aria-disabled={tapDisabled}
              className={`w-full font-bold py-4 rounded-2xl text-[11px] uppercase tracking-[0.3em] shadow-lg ${
                tapDisabled
                  ? 'bg-main/20 text-main/60 cursor-not-allowed shadow-none'
                  : 'bg-[var(--loft-accent)] text-[var(--loft-accent-contrast)] shadow-[0_18px_42px_color-mix(in_srgb,var(--loft-accent)_28%,transparent)] hover:brightness-110 active:scale-95 transition-all'
              }`}
            >
              {buttonLabel}
            </button>
          )}
          {showDiagnostics && diagnostics.length > 0 && (
            <details className="text-left w-full loft-card loft-card--flat bg-[var(--loft-surface-2)] border border-[var(--loft-border)] rounded-2xl p-4 space-y-3">
              <summary className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.3em] text-main/60 cursor-pointer">
                Diagnostics
                <ChevronDown className="w-4 h-4 text-main/40" />
              </summary>
              <div className="font-mono text-[11px] text-main/80 whitespace-pre-wrap max-h-48 overflow-auto">
                {diagnostics.slice(-10).map((line, idx) => (
                  <div key={`${line}-${idx}`}>{line}</div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinGateScreen;

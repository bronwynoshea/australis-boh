import React from 'react';
import { Sparkles } from 'lucide-react';
import AnimatedBackgroundBlobs from '../../AnimatedBackgroundBlobs';

interface WrapUpScreenProps {
  roomTitle?: string;
  finalSummary: string | null;
  hiddenMediaPipeline?: React.ReactNode;
  onLeave: () => void;
}

const WrapUpScreen: React.FC<WrapUpScreenProps> = ({ roomTitle, finalSummary, hiddenMediaPipeline, onLeave }) => {
  return (
    <div className="fixed inset-0 z-[500] bg-[var(--loft-bg)] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
      <AnimatedBackgroundBlobs />
      {hiddenMediaPipeline}
      <div className="max-w-xl w-full space-y-12 relative z-10">
        <div className="flex justify-center">
          <Sparkles className="w-16 h-16 text-cafe animate-pulse drop-shadow-[0_0_25px_rgba(37,99,235,0.45)]" />
        </div>
        <h2 className="text-3xl font-black text-main uppercase tracking-tighter">
          {roomTitle ? `Summary: ${roomTitle}` : 'Session Summary'}
        </h2>
        {finalSummary && (
          <div className="loft-card loft-card--flat bg-[var(--loft-surface)] rounded-[2.5rem] p-12 text-left shadow-2xl text-main">
            <p className="text-main/80 leading-relaxed whitespace-pre-wrap">{finalSummary}</p>
            <button
              onClick={onLeave}
              className="w-full mt-8 bg-cafe text-white font-bold py-6 rounded-2xl text-[14px] uppercase tracking-[0.3em] shadow-lg shadow-cafe/30"
            >
              Finish
            </button>
          </div>
        )}
        {!finalSummary && (
          <div className="loft-card loft-card--flat bg-[var(--loft-surface)] rounded-[2.5rem] p-12 text-center shadow-2xl text-main">
            <p className="text-main/70 text-sm md:text-base">No transcript to summarize yet.</p>
            <button
              onClick={onLeave}
              className="w-full mt-8 bg-cafe text-white font-bold py-6 rounded-2xl text-[14px] uppercase tracking-[0.3em] shadow-lg shadow-cafe/30"
            >
              Finish
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WrapUpScreen;

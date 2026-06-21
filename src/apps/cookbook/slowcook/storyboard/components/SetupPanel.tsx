import React from "react";
import type { SoundbyteStrategyOption } from "../types/storyboard";

type SetupPanelProps = {
  soundbytes: SoundbyteStrategyOption[];
  selectedSoundbyteId: string;
  onSelectSoundbyte: (id: string) => void;
  bookTitle: string;
  onBookTitleChange: (value: string) => void;
  bookSubtitle: string;
  onBookSubtitleChange: (value: string) => void;
  canContinue: boolean;
  onContinue: () => void;
  soundbyteProfile: {
    core_soundbyte: string | null;
    hole_we_own: string | null;
    ppr_result: string | null;
  } | null;
  interviewerPrompt: string;
  onInterviewerPromptChange: (value: string) => void;
  interviewerPromptStatus: "idle" | "saving" | "saved" | "error";
  interviewerPromptError: string | null;
  interviewerPromptDirty: boolean;
  canEditInterviewerPrompt: boolean;
};

const SetupPanel: React.FC<SetupPanelProps> = ({
  soundbytes,
  selectedSoundbyteId,
  onSelectSoundbyte,
  bookTitle,
  onBookTitleChange,
  bookSubtitle,
  onBookSubtitleChange,
  canContinue,
  onContinue,
  soundbyteProfile,
  interviewerPrompt,
  onInterviewerPromptChange,
  interviewerPromptStatus,
  interviewerPromptError,
  interviewerPromptDirty,
  canEditInterviewerPrompt,
}) => {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text">Soundbyte Strategy</label>
          <select
            className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
            value={selectedSoundbyteId}
            onChange={(e) => onSelectSoundbyte(e.target.value)}
          >
            <option value="">Select a Soundbyte</option>
            {soundbytes.map((sb) => (
              <option key={sb.id} value={sb.id}>
                {sb.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text">Working title</label>
          <input
            type="text"
            className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
            value={bookTitle}
            onChange={(e) => onBookTitleChange(e.target.value)}
            placeholder="e.g. Sunset the Resume"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text">Subtitle (optional)</label>
          <input
            type="text"
            className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
            value={bookSubtitle}
            onChange={(e) => onBookSubtitleChange(e.target.value)}
            placeholder="Clarify the promise or angle"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-boh-text-light dark:text-boh-text">Interviewer prompt</label>
            <span
              className={`text-[11px] font-semibold ${
                interviewerPromptStatus === "error"
                  ? "text-red-600"
                  : interviewerPromptStatus === "saving"
                    ? "text-primary"
                    : interviewerPromptDirty
                      ? "text-orange-500"
                      : "text-emerald-600"
              }`}
            >
              {interviewerPromptStatus === "saving"
                ? "Saving…"
                : interviewerPromptStatus === "error"
                  ? "Save failed"
                  : interviewerPromptDirty
                    ? "Unsaved changes"
                    : "Saved"}
            </span>
          </div>
          <textarea
            className="w-full rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
            rows={6}
            value={interviewerPrompt}
            onChange={(e) => onInterviewerPromptChange(e.target.value)}
            disabled={!canEditInterviewerPrompt}
            placeholder="Describe how Harper should conduct the interview…"
          />
          <p className="text-[11px] text-boh-text-sub-light">
            This guides how Harper asks questions during interviews. You can update it anytime.
          </p>
          {interviewerPromptError && <p className="text-[11px] text-red-600">{interviewerPromptError}</p>}
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 disabled:opacity-60"
          >
            Continue to Outline + References
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/70 dark:bg-boh-bg p-4">
        <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Strategy at a glance</h3>
        <div className="mt-2 space-y-2 text-[12px] text-boh-text-sub-light dark:text-boh-text-sub">
          {soundbyteProfile?.core_soundbyte && (
            <p>
              <b>Core Soundbyte:</b> {soundbyteProfile.core_soundbyte}
            </p>
          )}
          {soundbyteProfile?.hole_we_own && (
            <p>
              <b>Hole We Own:</b> {soundbyteProfile.hole_we_own}
            </p>
          )}
          {soundbyteProfile?.ppr_result && (
            <p>
              <b>PPR Result:</b> {soundbyteProfile.ppr_result}
            </p>
          )}
          {!soundbyteProfile && <p>Select a Soundbyte Strategy to see the snapshot.</p>}
        </div>
      </div>
    </div>
  );
};

export default SetupPanel;

import React from "react";
import StoryboardOutline from "./StoryboardOutline";
import type { ContentSection } from "../../../types/content";

type PlanPanelProps = {
  projectId: string;
  outlineSections: ContentSection[];
  rawOutlineText: string;
  onOutlineChange: (value: string) => void;
  isSavingOutline: boolean;
  outlineStatus: string | null;
  outlineError: string | null;
  canGoInterview: boolean;
  onSaveOutline: () => void;
  onContinueToInterview: () => void;
  activeChapterSectionId: string | null;
  onSelectChapter: (id: string) => void;
  referenceText: string;
  onReferenceChange: (value: string) => void;
  onCopyReferences: () => void;
  onClearReferences: () => void;
  onSaveReferences: () => void;
  referenceStatus: "idle" | "saving" | "saved" | "error";
  referenceError: string | null;
  referenceSaveDisabledUntilChange: boolean;
};

const PlanPanel: React.FC<PlanPanelProps> = ({
  projectId,
  outlineSections,
  rawOutlineText,
  onOutlineChange,
  isSavingOutline,
  outlineStatus,
  outlineError,
  canGoInterview,
  onSaveOutline,
  onContinueToInterview,
  activeChapterSectionId,
  onSelectChapter,
  referenceText,
  onReferenceChange,
  onCopyReferences,
  onClearReferences,
  onSaveReferences,
  referenceStatus,
  referenceError,
  referenceSaveDisabledUntilChange,
}) => {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Outline (editable)</h3>
          <button
            type="button"
            onClick={onSaveOutline}
            disabled={!projectId || isSavingOutline}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 disabled:opacity-60"
          >
            {isSavingOutline ? "Saving…" : "Save outline"}
          </button>
        </div>

        <textarea
          className="mt-3 w-full min-h-[260px] rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
          value={rawOutlineText}
          onChange={(e) => onOutlineChange(e.target.value)}
          placeholder={`PART I — ...\nChapter 1 — ...\nChapter 2 — ...\n\nPART II — ...\nChapter 3 — ...`}
        />

        <div className="mt-2 flex items-center gap-3">
          {outlineStatus && <p className="text-xs text-emerald-700">{outlineStatus}</p>}
          {outlineError && <p className="text-xs text-red-700">{outlineError}</p>}
          {!projectId && <p className="text-xs text-red-700">No projectId in URL. Choose a project first.</p>}
        </div>

        <div className="mt-4">
          <h4 className="text-xs font-semibold text-boh-text-light dark:text-boh-text">Chapters</h4>
          <div className="mt-2">
            {outlineSections.length > 0 ? (
              <StoryboardOutline
                sections={outlineSections}
                activeSectionId={activeChapterSectionId}
                partsAreHeaders
                onSelectSection={onSelectChapter}
              />
            ) : (
              <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Save an outline to generate chapters.</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={onContinueToInterview}
            disabled={!canGoInterview || isSavingOutline}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/80 disabled:opacity-60"
          >
            {isSavingOutline ? "Saving…" : "Continue to Interview"}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">References</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopyReferences}
              className="inline-flex items-center rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-xs font-semibold text-boh-text-light shadow-sm hover:bg-slate-50"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={onClearReferences}
              className="inline-flex items-center rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-xs font-semibold text-boh-text-light shadow-sm hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onSaveReferences}
              disabled={!projectId || referenceStatus === "saving"}
              className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary/80 disabled:opacity-60"
            >
              {referenceStatus === "saving" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <textarea
          className="mt-3 w-full min-h-[360px] rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-sm text-boh-text-light focus:outline-none focus:ring-2 focus:ring-primary dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
          value={referenceText}
          onChange={(e) => onReferenceChange(e.target.value)}
          placeholder="Paste research, links, notes, excerpts, or context here…"
        />

        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-boh-text-sub-light">
            {referenceStatus === "saving" ? "Saving…" : referenceStatus === "saved" ? "Saved" : ""}
          </span>
          {referenceError && <span className="text-xs text-red-700">{referenceError}</span>}
        </div>

        {referenceSaveDisabledUntilChange && (
          <div className="mt-2 text-[11px] text-boh-text-sub-light">
            Autosave paused after an error. Make a small edit, then click <b>Save</b>.
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanPanel;

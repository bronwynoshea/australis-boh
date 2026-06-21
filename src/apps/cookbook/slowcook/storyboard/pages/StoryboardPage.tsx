import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import BohAppLayout from "../../../../../boh/layouts/BohAppLayout";
import HarperHeader from "../components/HarperHeader";
import SetupPanel from "../components/SetupPanel";
import PlanPanel from "../components/PlanPanel";
import InterviewPanel from "../components/InterviewPanel";
import { LAST_PROJECT_STORAGE_KEY } from "./storyboardConfig";
import { useStoryboardPageState, type TabId } from "./useStoryboardPageState";

const StoryboardPage: React.FC = () => {
  const { projectType: projectTypeParam } = useParams<{ projectType?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const {
    humanTitle,
    humanSubtitle,
    contentKind,
    projectType,
    project,
    selectedSoundbyte,
    soundbytes,
    selectedSoundbyteId,
    setSelectedSoundbyteId,
    soundbyteProfile,
    bookTitle,
    setBookTitle,
    bookSubtitle,
    setBookSubtitle,
    interviewerPrompt,
    setInterviewerPrompt,
    outlineSections,
    activeTab,
    setActiveTab,
    canGoPlan,
    canGoInterview,
    canGoPublish,
    rawOutlineText,
    setRawOutlineText,
    isSavingOutline,
    outlineStatus,
    outlineError,
    handleSaveOutline,
    activeChapterSectionId,
    setActiveChapterSectionId,
    referenceText,
    setReferenceText,
    referenceStatus,
    referenceError,
    referenceSaveDisabledUntilChange,
    handleManualReferenceSave,
    handleCopyReferences,
    isBuildingRaw,
    isGeneratingDraft,
    isCompilingBook,
    handleBuildRaw,
    handleGenerateDraft,
    handleCompileBook,
    compiledDraftMd,
    actionStatus,
    actionError,
    projectHydrationState,
    interviewerPromptStatus,
    interviewerPromptError,
    interviewerPromptDirty,
    canEditInterviewerPrompt,
  } = useStoryboardPageState({ projectTypeParam, projectId, setSearchParams });

  const showMissingProject = !projectId;

  const TabButton: React.FC<{ id: TabId; label: string; enabled: boolean }> = ({ id, label, enabled }) => {
    const isActive = activeTab === id;
    return (
      <button
        type="button"
        disabled={!enabled}
        onClick={() => setActiveTab(id)}
        className={[
          "inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold transition",
          isActive ? "bg-primary text-white" : "bg-boh-surface-light dark:bg-boh-surface text-boh-text-light border border-boh-border-light",
          !enabled ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-50",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  return (
    <BohAppLayout>
      <div className="min-h-full w-full px-4 py-6 lg:px-8 lg:py-8">
        <div className="mb-2">
          <Link
            to="/boh/cookbook/slow-cook"
            className="inline-flex items-center text-xs font-medium text-boh-text-sub-light hover:text-boh-text-light"
          >
            <span className="mr-1">←</span>
            Back to Slow Cook
          </Link>
        </div>

        <div className="mb-4 space-y-1">
          <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">{humanTitle}</h1>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{humanSubtitle}</p>
        </div>

        <HarperHeader blueprintName={(project as any)?.title ?? (bookTitle || undefined)} soundbyteName={selectedSoundbyte?.name} />

        {showMissingProject && (
          <div className="mt-4 rounded-lg border border-boh-border-light/70 bg-boh-surface-light dark:bg-boh-surface p-4">
            <p className="text-sm text-boh-text-light">
              No project loaded yet. Choose a project from the Books list, or paste a projectId into the URL.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                to="/boh/cookbook/slow-cook/books"
                className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/80"
              >
                Choose a book project
              </Link>
              <button
                type="button"
                onClick={() => {
                  const storedId = window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY) ?? "";
                  if (storedId) setSearchParams({ projectId: storedId });
                }}
                className="inline-flex items-center rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-4 py-2 text-sm font-semibold text-boh-text-light shadow-sm hover:bg-slate-50"
              >
                Restore last project
              </button>
              {projectHydrationState !== "ready" && <span className="text-xs text-boh-text-sub-light">Loading…</span>}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <TabButton id="setup" label="1) Setup" enabled />
          <TabButton id="plan" label="2) Outline + References" enabled={canGoPlan} />
          <TabButton id="interview" label="3) Interview" enabled={canGoInterview} />
          <TabButton id="publish" label="4) Publishing" enabled={canGoPublish} />
        </div>

        <div className="mt-4 rounded-lg border border-boh-border-light/70 dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-bg p-4">
          {activeTab === "setup" && (
            <SetupPanel
              soundbytes={soundbytes}
              selectedSoundbyteId={selectedSoundbyteId}
              onSelectSoundbyte={setSelectedSoundbyteId}
              bookTitle={bookTitle}
              onBookTitleChange={setBookTitle}
              bookSubtitle={bookSubtitle}
              onBookSubtitleChange={setBookSubtitle}
              canContinue={canGoPlan}
              onContinue={() => setActiveTab("plan")}
              soundbyteProfile={soundbyteProfile}
              interviewerPrompt={interviewerPrompt}
              onInterviewerPromptChange={setInterviewerPrompt}
              interviewerPromptStatus={interviewerPromptStatus}
              interviewerPromptError={interviewerPromptError}
              interviewerPromptDirty={interviewerPromptDirty}
              canEditInterviewerPrompt={canEditInterviewerPrompt}
            />
          )}

          {activeTab === "plan" && (
            <PlanPanel
              projectId={projectId}
              outlineSections={outlineSections}
              rawOutlineText={rawOutlineText}
              onOutlineChange={setRawOutlineText}
              isSavingOutline={isSavingOutline}
              outlineStatus={outlineStatus}
              outlineError={outlineError}
              canGoInterview={canGoInterview}
              onSaveOutline={() => handleSaveOutline(false)}
              onContinueToInterview={() => handleSaveOutline(true)}
              activeChapterSectionId={activeChapterSectionId}
              onSelectChapter={setActiveChapterSectionId}
              referenceText={referenceText}
              onReferenceChange={setReferenceText}
              onCopyReferences={handleCopyReferences}
              onClearReferences={() => setReferenceText("")}
              onSaveReferences={handleManualReferenceSave}
              referenceStatus={referenceStatus}
              referenceError={referenceError}
              referenceSaveDisabledUntilChange={referenceSaveDisabledUntilChange}
            />
          )}

          {activeTab === "interview" && (
            <InterviewPanel
              projectId={projectId || null}
              soundbyteId={selectedSoundbyteId || null}
              activeSectionId={activeChapterSectionId}
              outlineSections={outlineSections}
              contentKind={contentKind}
              projectType={projectType}
              interviewerPrompt={interviewerPrompt}
              onSelectSection={(id) => setActiveChapterSectionId(id)}
            />
          )}

          {activeTab === "publish" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Publishing</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("interview")}
                  className="inline-flex items-center rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-xs font-semibold text-boh-text-light shadow-sm hover:bg-slate-50"
                >
                  Back to Interview
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleBuildRaw}
                  disabled={!projectId || !activeChapterSectionId || isBuildingRaw}
                  className="inline-flex items-center rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-xs font-semibold text-boh-text-light shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  {isBuildingRaw ? "Building…" : "Build raw transcript"}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateDraft}
                  disabled={!projectId || !activeChapterSectionId || isGeneratingDraft}
                  className="inline-flex items-center rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-xs font-semibold text-boh-text-light shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  {isGeneratingDraft ? "Generating…" : "Generate chapter draft"}
                </button>
                <button
                  type="button"
                  onClick={handleCompileBook}
                  disabled={!projectId || isCompilingBook}
                  className="inline-flex items-center rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface px-3 py-2 text-xs font-semibold text-boh-text-light shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  {isCompilingBook ? "Compiling…" : "Compile book draft"}
                </button>
              </div>

              {actionStatus && <p className="text-xs text-emerald-700">{actionStatus}</p>}
              {actionError && <p className="text-xs text-red-700">{actionError}</p>}

              {compiledDraftMd && (
                <div className="rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface p-3 text-xs text-boh-text-light">
                  <div className="mb-2 font-semibold">Compiled draft</div>
                  <pre className="whitespace-pre-wrap">{compiledDraftMd}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BohAppLayout>
  );
};

export default StoryboardPage;

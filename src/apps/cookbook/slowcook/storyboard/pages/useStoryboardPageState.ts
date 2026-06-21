import { useEffect, useMemo, useRef, useState } from "react";
import type { SetURLSearchParams } from "react-router-dom";
import {
  fetchSoundbyteStrategies,
  getContentSections,
  fetchSoundbyteProfile,
  syncOutlineSections,
  buildRawTranscript,
  generateChapterDraft,
  compileBookDraft,
  updateProjectReference,
  fetchBookProject,
  updateProjectInterviewerPrompt,
} from "../services/storyboardApi";
import type { ContentBlueprint, SoundbyteStrategyOption } from "../types/storyboard";
import type { ContentSection } from "../../../types/content";
import {
  DEFAULT_INTERVIEWER_PROMPT,
  LAST_PROJECT_STORAGE_KEY,
  PROJECT_TYPE_CONFIG,
  REFERENCE_AUTOSAVE_DELAY,
  isChapter,
  outlineFromSections,
  parseOutlineText,
} from "./storyboardConfig";

export type TabId = "setup" | "plan" | "interview" | "publish";

type UseStoryboardPageStateParams = {
  projectTypeParam?: string;
  projectId: string;
  setSearchParams: SetURLSearchParams;
};

export function useStoryboardPageState({ projectTypeParam, projectId, setSearchParams }: UseStoryboardPageStateParams) {
  const slug = projectTypeParam && PROJECT_TYPE_CONFIG[projectTypeParam] ? projectTypeParam : "books";
  const { humanTitle, humanSubtitle, contentKind, projectType } = PROJECT_TYPE_CONFIG[slug];

  const [activeTab, setActiveTab] = useState<TabId>("setup");
  const [soundbytes, setSoundbytes] = useState<SoundbyteStrategyOption[]>([]);
  const [selectedSoundbyteId, setSelectedSoundbyteId] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookSubtitle, setBookSubtitle] = useState("");
  const [project, setProject] = useState<ContentBlueprint | null>(null);
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [activeChapterSectionId, setActiveChapterSectionId] = useState<string | null>(null);
  const [rawOutlineText, setRawOutlineText] = useState("");
  const [isSavingOutline, setIsSavingOutline] = useState(false);
  const [outlineStatus, setOutlineStatus] = useState<string | null>(null);
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [referenceText, setReferenceText] = useState("");
  const [referenceStatus, setReferenceStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceHydratedProjectId, setReferenceHydratedProjectId] = useState<string | null>(null);
  const [referenceSaveDisabledUntilChange, setReferenceSaveDisabledUntilChange] = useState(false);
  const referenceDebounceRef = useRef<number | null>(null);
  const lastSavedReferenceRef = useRef<Record<string, string>>({});
  const [interviewerPrompt, setInterviewerPrompt] = useState(DEFAULT_INTERVIEWER_PROMPT);
  const [interviewerPromptStatus, setInterviewerPromptStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [interviewerPromptError, setInterviewerPromptError] = useState<string | null>(null);
  const interviewerPromptSavedRef = useRef(DEFAULT_INTERVIEWER_PROMPT);
  const interviewerPromptDebounceRef = useRef<number | null>(null);
  const [isBuildingRaw, setIsBuildingRaw] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isCompilingBook, setIsCompilingBook] = useState(false);
  const [compiledDraftMd, setCompiledDraftMd] = useState("");
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [soundbyteProfile, setSoundbyteProfile] = useState<{
    core_soundbyte: string | null;
    hole_we_own: string | null;
    ppr_result: string | null;
  } | null>(null);
  const [projectHydrationState, setProjectHydrationState] = useState<"pending" | "loading" | "ready">(
    projectId ? "ready" : "pending",
  );

  const selectedSoundbyte = useMemo(
    () => soundbytes.find((soundbyte) => soundbyte.id === selectedSoundbyteId),
    [soundbytes, selectedSoundbyteId],
  );
  const outlineSections = useMemo(
    () => sections.filter((section) => section.status !== "archived" && section.label !== "Harper Interview"),
    [sections],
  );
  const chapterSections = useMemo(() => outlineSections.filter((section) => isChapter(section)), [outlineSections]);
  const canGoPlan = Boolean(selectedSoundbyteId && (bookTitle.trim() || project?.name));
  const canGoInterview = Boolean(projectId && chapterSections.length > 0);
  const canGoPublish = Boolean(projectId && activeChapterSectionId);

  useEffect(() => {
    void (async () => {
      const strategies = await fetchSoundbyteStrategies();
      setSoundbytes(strategies);
      if (strategies[0]) setSelectedSoundbyteId(strategies[0].id);
    })();
  }, []);

  useEffect(() => {
    if (projectId) {
      setProjectHydrationState("ready");
      return;
    }
    setProjectHydrationState("loading");
    try {
      const storedId = window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY) ?? "";
      if (storedId) setSearchParams({ projectId: storedId });
    } catch (error) {
      console.error("[Content] Failed to restore last project id", error);
    } finally {
      setProjectHydrationState("ready");
    }
  }, [projectId, setSearchParams]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setBookTitle("");
      setBookSubtitle("");
      return;
    }
    void (async () => {
      const fetchedProject = await fetchBookProject(projectId);
      if (!fetchedProject) return;
      setProject((fetchedProject as unknown) as ContentBlueprint);
      setBookTitle((fetchedProject as any).title ?? "");
      setBookSubtitle((fetchedProject as any).subtitle ?? "");
      const resolvedPrompt =
        typeof (fetchedProject as any).interviewer_prompt === "string" &&
        (fetchedProject as any).interviewer_prompt.trim().length > 0
          ? (fetchedProject as any).interviewer_prompt
          : DEFAULT_INTERVIEWER_PROMPT;
      interviewerPromptSavedRef.current = resolvedPrompt;
      setInterviewerPrompt(resolvedPrompt);
      setInterviewerPromptStatus(resolvedPrompt.trim() ? "saved" : "idle");
      setInterviewerPromptError(null);
      const incomingRef = (fetchedProject as any).reference_md ?? "";
      if (referenceHydratedProjectId !== projectId) {
        setReferenceText(incomingRef);
        lastSavedReferenceRef.current[projectId] = incomingRef;
        setReferenceHydratedProjectId(projectId);
        setReferenceStatus(incomingRef ? "saved" : "idle");
        setReferenceError(null);
        setReferenceSaveDisabledUntilChange(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setSections([]);
      setActiveChapterSectionId(null);
      setRawOutlineText("");
      interviewerPromptSavedRef.current = DEFAULT_INTERVIEWER_PROMPT;
      setInterviewerPrompt(DEFAULT_INTERVIEWER_PROMPT);
      setInterviewerPromptStatus("idle");
      setInterviewerPromptError(null);
      return;
    }
    window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, projectId);
    void (async () => {
      try {
        const loadedSections = await getContentSections(projectId);
        setSections(loadedSections);
        const outlineText = outlineFromSections(loadedSections);
        if (outlineText) setRawOutlineText(outlineText);
        const activeKey = `cookbook_slowcook_active_chapter_${projectId}`;
        const storedChapter = window.localStorage.getItem(activeKey);
        const firstChapter = loadedSections.find((section) => isChapter(section) && section.status !== "archived");
        setActiveChapterSectionId(storedChapter || firstChapter?.id || null);
      } catch (error) {
        console.error("[Content] Failed to load project sections", error);
      }
    })();
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !activeChapterSectionId) return;
    const key = `cookbook_slowcook_active_chapter_${projectId}`;
    window.localStorage.setItem(key, activeChapterSectionId);
  }, [projectId, activeChapterSectionId]);

  useEffect(() => {
    if (!selectedSoundbyteId) {
      setSoundbyteProfile(null);
      return;
    }
    let mounted = true;
    void (async () => {
      const profile = await fetchSoundbyteProfile(selectedSoundbyteId);
      if (!mounted) return;
      if (!profile) {
        setSoundbyteProfile(null);
        return;
      }
      setSoundbyteProfile({
        core_soundbyte: profile.core_soundbyte ?? null,
        hole_we_own: profile.hole_we_own ?? null,
        ppr_result: profile.ppr_result ?? null,
      });
    })();
    return () => {
      mounted = false;
    };
  }, [selectedSoundbyteId]);

  useEffect(() => {
    if (!projectId || referenceHydratedProjectId !== projectId) return;
    const lastSaved = lastSavedReferenceRef.current[projectId] ?? "";
    if (referenceSaveDisabledUntilChange && referenceText !== lastSaved) {
      setReferenceSaveDisabledUntilChange(false);
    }
    if (referenceText === lastSaved) {
      if (referenceDebounceRef.current) {
        window.clearTimeout(referenceDebounceRef.current);
        referenceDebounceRef.current = null;
      }
      if (referenceStatus === "saving") {
        setReferenceStatus(referenceText.trim() ? "saved" : "idle");
      }
      return;
    }
    if (referenceSaveDisabledUntilChange) return;
    if (referenceDebounceRef.current) {
      window.clearTimeout(referenceDebounceRef.current);
      referenceDebounceRef.current = null;
    }
    setReferenceStatus("saving");
    const pendingText = referenceText;
    referenceDebounceRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          await updateProjectReference(projectId, pendingText);
          lastSavedReferenceRef.current[projectId] = pendingText;
          setReferenceStatus(pendingText.trim() ? "saved" : "idle");
          setReferenceError(null);
        } catch (error) {
          console.error("[Content] Failed to autosave references", error);
          setReferenceStatus("error");
          setReferenceError("We couldn't save your references. Try again.");
          setReferenceSaveDisabledUntilChange(true);
        }
      })();
    }, REFERENCE_AUTOSAVE_DELAY);
    return () => {
      if (referenceDebounceRef.current) {
        window.clearTimeout(referenceDebounceRef.current);
        referenceDebounceRef.current = null;
      }
    };
  }, [referenceText, projectId, referenceHydratedProjectId, referenceStatus, referenceSaveDisabledUntilChange]);

  const persistReferences = async () => {
    if (!projectId) throw new Error("Missing projectId");
    await updateProjectReference(projectId, referenceText);
    lastSavedReferenceRef.current[projectId] = referenceText;
    setReferenceStatus(referenceText.trim() ? "saved" : "idle");
  };

  const handleSaveOutline = async (advance?: boolean) => {
    if (!projectId) {
      setOutlineError("No project found. Choose a project first.");
      return;
    }
    setIsSavingOutline(true);
    setOutlineStatus(null);
    setOutlineError(null);
    try {
      await persistReferences();
      const parsed = parseOutlineText(rawOutlineText);
      const payload = parsed.map((part, index) => ({
        section_index: index + 1,
        label: part.label,
        section_type: part.section_type,
      }));
      const savedSections = await syncOutlineSections(projectId, payload);
      setSections(savedSections);
      const firstChapter = savedSections.find((section) => isChapter(section) && section.status !== "archived");
      setActiveChapterSectionId(firstChapter?.id ?? null);
      setOutlineStatus("Outline saved.");
      if (advance) setActiveTab("interview");
    } catch (error) {
      console.error("[Content] Failed to save outline + references", error);
      setOutlineError("We couldn't save your outline or references. Check the console for details.");
    } finally {
      setIsSavingOutline(false);
    }
  };

  const handleManualReferenceSave = async () => {
    if (!projectId) return;
    setReferenceStatus("saving");
    setReferenceError(null);
    setReferenceSaveDisabledUntilChange(false);
    try {
      await persistReferences();
    } catch (error) {
      console.error("[Content] Failed to save references", error);
      setReferenceStatus("error");
      setReferenceError("We couldn't save your references. Try again.");
      setReferenceSaveDisabledUntilChange(true);
    }
  };

  const interviewerPromptDirty = interviewerPrompt !== interviewerPromptSavedRef.current;

  useEffect(() => {
    if (!projectId) {
      if (interviewerPromptDebounceRef.current) {
        window.clearTimeout(interviewerPromptDebounceRef.current);
        interviewerPromptDebounceRef.current = null;
      }
      return;
    }
    if (!interviewerPromptDirty) {
      if (interviewerPromptDebounceRef.current) {
        window.clearTimeout(interviewerPromptDebounceRef.current);
        interviewerPromptDebounceRef.current = null;
      }
      if (interviewerPromptStatus === "saving") {
        setInterviewerPromptStatus(interviewerPrompt.trim() ? "saved" : "idle");
      }
      return;
    }
    if (interviewerPromptDebounceRef.current) {
      window.clearTimeout(interviewerPromptDebounceRef.current);
      interviewerPromptDebounceRef.current = null;
    }
    setInterviewerPromptStatus("saving");
    setInterviewerPromptError(null);
    const pendingPrompt = interviewerPrompt;
    interviewerPromptDebounceRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          await updateProjectInterviewerPrompt(projectId, pendingPrompt);
          interviewerPromptSavedRef.current = pendingPrompt;
          setInterviewerPromptStatus(pendingPrompt.trim() ? "saved" : "idle");
        } catch (error) {
          console.error("[Content] Failed to autosave interviewer prompt", error);
          setInterviewerPromptStatus("error");
          setInterviewerPromptError("We couldn't save the interviewer prompt. Try again.");
        }
      })();
    }, REFERENCE_AUTOSAVE_DELAY);
    return () => {
      if (interviewerPromptDebounceRef.current) {
        window.clearTimeout(interviewerPromptDebounceRef.current);
        interviewerPromptDebounceRef.current = null;
      }
    };
  }, [projectId, interviewerPrompt, interviewerPromptDirty, interviewerPromptStatus]);

  const canEditInterviewerPrompt = Boolean(projectId);

  const handleBuildRaw = async () => {
    if (!projectId || !activeChapterSectionId) return;
    setIsBuildingRaw(true);
    setActionStatus(null);
    setActionError(null);
    try {
      const section = await buildRawTranscript(projectId, activeChapterSectionId);
      setSections((prev) => prev.map((s) => (s.id === section.id ? section : s)));
      setActionStatus("Raw transcript built.");
    } catch (error) {
      console.error("[Content] Failed to build raw transcript", error);
      setActionError("We couldn't build the raw transcript.");
    } finally {
      setIsBuildingRaw(false);
    }
  };

  const handleGenerateDraft = async () => {
    if (!projectId || !activeChapterSectionId) return;
    setIsGeneratingDraft(true);
    setActionStatus(null);
    setActionError(null);
    try {
      const section = await generateChapterDraft(projectId, activeChapterSectionId);
      setSections((prev) => prev.map((s) => (s.id === section.id ? section : s)));
      setActionStatus("Chapter draft generated.");
    } catch (error) {
      console.error("[Content] Failed to generate chapter draft", error);
      setActionError("We couldn't generate the chapter draft.");
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleCompileBook = async () => {
    if (!projectId) return;
    setIsCompilingBook(true);
    setActionStatus(null);
    setActionError(null);
    try {
      const result = await compileBookDraft(projectId);
      setCompiledDraftMd(result.compiled_draft_md);
      setActionStatus("Book draft compiled.");
    } catch (error) {
      console.error("[Content] Failed to compile book draft", error);
      setActionError("We couldn't compile the book draft.");
    } finally {
      setIsCompilingBook(false);
    }
  };

  const handleCopyReferences = () => {
    if (!referenceText.trim()) return;
    navigator.clipboard
      .writeText(referenceText)
      .then(() => {
        setActionStatus("References copied.");
        setActionError(null);
      })
      .catch((error) => {
        console.error("[Content] Failed to copy references", error);
        setActionError("Copy failed. Your browser may not allow clipboard access.");
      });
  };

  return {
    slug,
    humanTitle,
    humanSubtitle,
    contentKind,
    projectType,
    selectedSoundbyte,
    activeTab,
    setActiveTab,
    soundbytes,
    selectedSoundbyteId,
    setSelectedSoundbyteId,
    soundbyteProfile,
    bookTitle,
    setBookTitle,
    bookSubtitle,
    setBookSubtitle,
    project,
    outlineSections,
    sections,
    activeChapterSectionId,
    setActiveChapterSectionId,
    rawOutlineText,
    setRawOutlineText,
    isSavingOutline,
    outlineStatus,
    outlineError,
    handleSaveOutline,
    canGoPlan,
    canGoInterview,
    canGoPublish,
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
    interviewerPrompt,
    setInterviewerPrompt,
    interviewerPromptStatus,
    interviewerPromptError,
    interviewerPromptDirty,
    canEditInterviewerPrompt,
  };
}

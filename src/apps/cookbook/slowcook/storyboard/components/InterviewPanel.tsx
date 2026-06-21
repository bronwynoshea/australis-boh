import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AnswerEditor from "./AnswerEditor";
import StoryboardOutline from "./StoryboardOutline";
import QuestionBox from "./QuestionBox";
import {
  ensureHarperKickoffQuestion,
  fetchChapterExchanges,
  submitUserAnswer,
  resetChapterInterview,
  resetProjectInterview,
  deleteExchange,
} from "../services/storyboardApi";
import type { ContentSection } from "../../../types/content";
import Toast from "../../../../../components/Toast";

type InterviewPanelProps = {
  projectId: string | null;
  soundbyteId: string | null;
  activeSectionId: string | null;
  outlineSections: ContentSection[];
  contentKind: string;
  projectType: string;
  interviewerPrompt?: string | null;
  onSelectSection?: (id: string) => void;
};

const INTERVIEW_FETCH_LIMIT = 50;

const PLACEHOLDER_MARKERS = [
  "placeholder",
  "replace with gemini",
  "voice transcript placeholder",
  "gemini transcription",
] as const;

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") return null;
  const globalWindow = window as typeof window & {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  };
  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition ?? null;
};

const InterviewPanel: React.FC<InterviewPanelProps> = ({
  projectId,
  soundbyteId,
  activeSectionId,
  outlineSections,
  contentKind,
  projectType,
  onSelectSection,
  interviewerPrompt,
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isKickoffInFlight, setIsKickoffInFlight] = useState(false);

  const [answerMode, setAnswerMode] = useState<"type" | "voiceLive">("type");

  // Voice mode state
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [autoSubmitVoice, setAutoSubmitVoice] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  // Reset UI
  const [isResetting, setIsResetting] = useState(false);
  const [resetMenuOpen, setResetMenuOpen] = useState(false);
  const resetMenuRef = useRef<HTMLDivElement | null>(null);

  // Delete UI
  const [deletingExchangeId, setDeletingExchangeId] = useState<string | null>(null);
  const [confirmExchangeId, setConfirmExchangeId] = useState<string | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);

  // Voice recognition refs
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceTranscriptRef = useRef("");
  const suppressEmptyToastRef = useRef(false);

  const activeSection = outlineSections.find((s) => s.id === activeSectionId) ?? null;

  const isPlaceholder = useCallback((text: string | null | undefined) => {
    const normalized = String(text ?? "").trim().toLowerCase();
    if (!normalized) return false;
    return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
  }, []);

  const showToastMessage = useCallback((message: string) => {
    setToastMessage(message);
    setIsToastVisible(true);
  }, []);

  const speakQuestion = useCallback((question: string | null) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (!question) return;
    const utterance = new SpeechSynthesisUtterance(question);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, []);

  const deriveCurrentQuestion = useCallback(
    (rows: any[]): string | null => {
      // Ignore system rows
      const relevant = rows.filter((row) => row.role !== "system");
      const reversed = [...relevant].reverse();

      // Prefer newest unanswered question
      const unanswered = reversed.find((row) => {
        const q = String(row.question_text ?? "").trim();
        const a = String(row.answer_text ?? "").trim();

        if (isPlaceholder(row.question_text) || isPlaceholder(row.answer_text)) return false;
        return q.length > 0 && a.length === 0;
      });

      if (unanswered?.question_text) return unanswered.question_text;

      // Otherwise latest non-placeholder question
      const latestQuestion = reversed.find((row) => {
        const q = String(row.question_text ?? "").trim();
        if (!q) return false;
        return !isPlaceholder(row.question_text);
      });

      return latestQuestion?.question_text ?? null;
    },
    [isPlaceholder],
  );

  const loadExchanges = useCallback(async () => {
    if (!projectId || !activeSectionId) {
      setExchanges([]);
      setCurrentQuestion(null);
      return;
    }
    const rows = await fetchChapterExchanges(projectId, activeSectionId, INTERVIEW_FETCH_LIMIT);
    setExchanges(rows);
    setCurrentQuestion(deriveCurrentQuestion(rows));
  }, [projectId, activeSectionId, deriveCurrentQuestion]);

  useEffect(() => {
    void loadExchanges();
  }, [loadExchanges]);

  // Close reset dropdown when clicking away
  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (!resetMenuRef.current) return;
      if (!resetMenuRef.current.contains(event.target as Node)) setResetMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, []);

  const handleKickoff = async () => {
    if (!projectId || !activeSectionId) return;
    setIsKickoffInFlight(true);
    try {
      await ensureHarperKickoffQuestion({
        projectId,
        sectionId: activeSectionId,
        chapterLabel: activeSection?.label ?? null,
        interviewerPrompt: interviewerPrompt ?? null,
      });
      await loadExchanges();
    } finally {
      setIsKickoffInFlight(false);
    }
  };

  const hasExchanges = exchanges.length > 0;
  const visibleExchanges = useMemo(
    () =>
      exchanges.filter((row) => {
        if (row.role !== "harper" && row.role !== "user") return false;
        if (isPlaceholder(row.question_text) || isPlaceholder(row.answer_text)) return false;
        return true;
      }),
    [exchanges, isPlaceholder],
  );
  const hasVisibleExchanges = visibleExchanges.length > 0;
  const canStartInterview = Boolean(projectId && activeSectionId && soundbyteId);
  const editorDisabled = !projectId || !activeSectionId || !soundbyteId;

  const handleStartInterview = async () => {
    if (!canStartInterview || hasExchanges) return;
    await handleKickoff();
  };

  const canRecordVoice = Boolean(
    isSpeechSupported && canStartInterview && currentQuestion && hasVisibleExchanges && !isKickoffInFlight,
  );
  const voiceButtonDisabled = !isVoiceRecording && !canRecordVoice;
  const interviewCtaLabel = isKickoffInFlight ? "Starting…" : "Start interview";
  const interviewCtaDisabled = !canStartInterview || isKickoffInFlight;
  const voiceStatus = useMemo(() => {
    if (isVoiceRecording) return "Recording… tap Stop when you’re finished.";
    if (voiceTranscript && autoSubmitVoice) return "Transcript captured and submitted automatically.";
    if (voiceTranscript) return "Transcript captured. You can edit before submitting.";
    if (canRecordVoice) return "Ready to record your answer.";
    return "Start the interview to unlock voice mode.";
  }, [autoSubmitVoice, canRecordVoice, isVoiceRecording, voiceTranscript]);

  const handleSendAnswer = async (overrideText?: string): Promise<boolean> => {
    if (!projectId || !activeSectionId || !soundbyteId) return false;
    const payload = (overrideText ?? answer).trim();
    if (!payload) return false;

    setIsSubmitting(true);
    try {
      const result = await submitUserAnswer({
        projectId,
        sectionId: activeSectionId,
        previousQuestion: currentQuestion ?? "",
        answer: payload,
        contentKind,
        projectType,
      });

      // refresh
      setAnswer("");
      setVoiceTranscript("");
      const rows = await fetchChapterExchanges(projectId, activeSectionId, INTERVIEW_FETCH_LIMIT);
      setExchanges(rows);
      setCurrentQuestion(result.nextQuestion ?? deriveCurrentQuestion(rows));
      return true;
    } catch (err) {
      console.error("[Content] Failed to submit interview answer", err);
      showToastMessage("Unable to submit your answer. Please try again.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const cleanupVoiceStream = () => {
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
    }
  };

  const stopVoiceRecording = useCallback(
    (suppressEmptyToast = false) => {
      if (!speechRecognitionRef.current) {
        cleanupVoiceStream();
        return;
      }
      suppressEmptyToastRef.current = suppressEmptyToast;
      try {
        speechRecognitionRef.current.stop();
      } catch (error) {
        console.error("[Content] Failed to stop speech recognition", error);
        cleanupVoiceStream();
        speechRecognitionRef.current = null;
        setIsVoiceRecording(false);
      }
    },
    [],
  );

  const startVoiceRecording = async () => {
    if (!projectId || !activeSectionId || !soundbyteId || !currentQuestion) {
      showToastMessage("Select a chapter and start the interview before using voice mode.");
      return;
    }
    if (isVoiceRecording) return;

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      showToastMessage("Voice capture isn't supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
    } catch (error) {
      console.error("[Content] Unable to access microphone", error);
      const message = "We couldn't access your microphone. Check permissions and try again.";
      setVoiceError(message);
      showToastMessage(message);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    voiceTranscriptRef.current = "";
    setVoiceTranscript("");
    setVoiceError(null);

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalChunk += transcript;
        } else {
          interimChunk += transcript;
        }
      }
      if (finalChunk) {
        voiceTranscriptRef.current = `${voiceTranscriptRef.current} ${finalChunk}`.trim();
      } else if (interimChunk) {
        voiceTranscriptRef.current = `${voiceTranscriptRef.current.split("\n")[0] ?? ""} ${interimChunk}`.trim();
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("[Content] Speech recognition error", event.error);
      setVoiceError("We couldn't process that audio. Please try again.");
      showToastMessage("Voice processing failed. Please try again.");
      stopVoiceRecording(true);
    };

    recognition.onend = () => {
      const finalText = voiceTranscriptRef.current.trim();
      voiceTranscriptRef.current = "";
      cleanupVoiceStream();
      speechRecognitionRef.current = null;
      setIsVoiceRecording(false);

      if (!finalText) {
        if (!suppressEmptyToastRef.current) {
          showToastMessage("We didn’t catch that—try again.");
        }
        suppressEmptyToastRef.current = false;
        setVoiceTranscript("");
        return;
      }

      suppressEmptyToastRef.current = false;
      setVoiceTranscript(finalText);
      setAnswer(finalText);
      if (autoSubmitVoice) {
        void handleSendAnswer(finalText);
      }
    };

    speechRecognitionRef.current = recognition;
    recognition.start();
    setIsVoiceRecording(true);
  };

  useEffect(() => {
    setIsSpeechSupported(Boolean(getSpeechRecognition()));
  }, []);

  useEffect(() => {
    if (answerMode !== "voiceLive") {
      stopVoiceRecording(true);
      setVoiceError(null);
    } else if (currentQuestion) {
      speakQuestion(currentQuestion);
    }
  }, [answerMode, currentQuestion, speakQuestion, stopVoiceRecording]);

  useEffect(() => {
    if (answerMode === "voiceLive" && currentQuestion) {
      speakQuestion(currentQuestion);
    }
  }, [answerMode, currentQuestion, speakQuestion]);

  useEffect(() => {
    return () => {
      stopVoiceRecording(true);
      cleanupVoiceStream();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopVoiceRecording]);

  const renderModeTabs = () => (
    <div className="inline-flex rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface text-sm font-semibold shadow-sm">
      {[
        { label: "Type", value: "type" as const },
        { label: "Voice", value: "voiceLive" as const },
      ].map((mode, idx) => {
        const isActive = answerMode === mode.value;
        const disabled = mode.value === "voiceLive" && !isSpeechSupported;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => !disabled && setAnswerMode(mode.value)}
            className={[
              "px-4 py-2 transition-colors",
              idx === 0 ? "rounded-l-md" : "",
              idx === 1 ? "rounded-r-md" : "",
              disabled
                ? "bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light opacity-60"
                : isActive
                  ? "bg-primary text-white"
                  : "bg-boh-surface-light dark:bg-boh-surface text-boh-text-light hover:bg-slate-50",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={disabled}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );

  const handleResetChapter = async () => {
    if (!projectId || !activeSectionId) return;
    const confirmed = window.confirm("Reset this chapter interview? This clears exchanges for this chapter only.");
    if (!confirmed) return;

    setIsResetting(true);
    try {
      stopVoiceRecording();
      await resetChapterInterview(projectId, activeSectionId);
      setAnswer("");
      setVoiceTranscript("");
      setCurrentQuestion(null);
      await loadExchanges();
    } catch (error) {
      console.error("[Content] Failed to reset chapter interview", error);
      showToastMessage("Unable to reset chapter. Please try again.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetProject = async () => {
    if (!projectId) return;
    const confirmed = window.confirm("Reset this project interview? This clears all Harper exchanges for the project.");
    if (!confirmed) return;

    setIsResetting(true);
    try {
      stopVoiceRecording();
      await resetProjectInterview(projectId);
      setAnswer("");
      setVoiceTranscript("");
      setCurrentQuestion(null);
      await loadExchanges();
    } catch (error) {
      console.error("[Content] Failed to reset project interview", error);
      showToastMessage("Unable to reset project. Please try again.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleRemoveExchange = (exchangeId: string) => {
    setConfirmExchangeId(exchangeId);
  };

  const handleConfirmRemove = async (exchangeId: string) => {
    setDeletingExchangeId(exchangeId);

    // Optimistic UI removal
    setExchanges((prev) => prev.filter((e) => e.id !== exchangeId));

    try {
      await deleteExchange(exchangeId);
      const rows = await fetchChapterExchanges(projectId!, activeSectionId!, INTERVIEW_FETCH_LIMIT);
      setExchanges(rows);
      setCurrentQuestion(deriveCurrentQuestion(rows));
    } catch (error) {
      console.error("[Content] Failed to delete exchange", error);
      showToastMessage("Unable to remove that message. Please try again.");
      await loadExchanges();
    } finally {
      setDeletingExchangeId(null);
    }
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* Chapters */}
        <div className="rounded-lg border border-boh-border-light/70 bg-boh-surface-light dark:bg-boh-surface/70 p-3">
          <div className="text-xs font-semibold text-boh-text-light">Chapters</div>
          <div className="mt-2">
            <StoryboardOutline
              sections={outlineSections}
              activeSectionId={activeSectionId}
              partsAreHeaders
              onSelectSection={onSelectSection}
            />
          </div>
          {!activeSectionId && (
            <div className="mt-2 text-[11px] text-boh-text-sub-light">Pick a chapter to begin.</div>
          )}
        </div>

        {/* Interview */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Interview</h3>

              {hasExchanges && (
                <div className="relative" ref={resetMenuRef}>
                  <button
                    type="button"
                    onClick={() => setResetMenuOpen((prev) => !prev)}
                    className="inline-flex items-center rounded-md border border-boh-border-light px-2 py-1 text-[11px] font-semibold text-boh-text-light hover:bg-slate-50 disabled:opacity-60"
                    disabled={isResetting}
                  >
                    {isResetting ? "Resetting…" : "Reset"}
                  </button>

                  {resetMenuOpen && (
                    <div className="absolute left-0 mt-1 w-56 rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface p-2 text-xs shadow-lg">
                      <button
                        type="button"
                        className="w-full rounded-md px-2 py-1 text-left hover:bg-slate-50"
                        onClick={() => {
                          setResetMenuOpen(false);
                          void handleResetChapter();
                        }}
                      >
                        Reset chapter
                      </button>

                      <button
                        type="button"
                        className="mt-1 w-full rounded-md px-2 py-1 text-left hover:bg-slate-50"
                        onClick={() => {
                          setResetMenuOpen(false);
                          void handleResetProject();
                        }}
                      >
                        Reset entire project
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!hasExchanges && (
              <button
                type="button"
                onClick={handleKickoff}
                disabled={interviewCtaDisabled}
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary/80 disabled:opacity-60"
              >
                {interviewCtaLabel}
              </button>
            )}

            {hasExchanges && renderModeTabs()}
          </div>

          <QuestionBox
            question={currentQuestion}
            canStartInterview={canStartInterview}
            isStarting={isKickoffInFlight}
            onStartInterview={handleStartInterview}
          />

          {answerMode === "type" ? (
            <AnswerEditor
              value={answer}
              onChange={setAnswer}
              onSubmit={() => handleSendAnswer()}
              disabled={editorDisabled}
              isSubmitting={isSubmitting}
            />
          ) : (
            <div className="space-y-3 rounded-lg border border-boh-border-light/70 bg-boh-surface-light dark:bg-boh-surface/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-boh-text-light">Answer</p>
                  <p className="text-xs text-boh-text-sub-light">{voiceStatus}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isVoiceRecording) {
                      stopVoiceRecording(true);
                    } else {
                      void startVoiceRecording();
                    }
                  }}
                  disabled={voiceButtonDisabled}
                  className={[
                    "inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold shadow-sm transition",
                    isVoiceRecording ? "bg-red-600 text-white hover:bg-red-700" : "bg-primary text-white hover:bg-primary/80",
                    voiceButtonDisabled ? "opacity-60" : "",
                  ].join(" ")}
                >
                  {isVoiceRecording ? "Stop recording" : "Record answer"}
                </button>
              </div>

              {voiceError && <p className="text-xs text-red-600">{voiceError}</p>}

              <div className="space-y-2 rounded-md border border-dashed border-boh-border-light bg-boh-surface-light dark:bg-boh-surface/80 p-3 text-sm text-boh-text">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Transcript preview</p>
                <p className="whitespace-pre-wrap text-boh-text-sub-light">
                  {voiceTranscript ? voiceTranscript : "No transcript captured yet."}
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs text-boh-text-sub-light">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-boh-border-light text-primary focus:ring-primary"
                  checked={autoSubmitVoice}
                  onChange={(event) => setAutoSubmitVoice(event.target.checked)}
                />
                Auto-submit answers after recording
              </label>
            </div>
          )}
        </div>

        {/* Recent exchanges */}
        <div className="rounded-lg border border-boh-border-light/70 bg-boh-surface-light dark:bg-boh-surface/70 p-3">
          <h4 className="text-xs font-semibold text-boh-text-light">Recent exchanges</h4>

          <div className="mt-2 max-h-[520px] space-y-2 overflow-auto">
            {visibleExchanges.length === 0 ? (
              <p className="text-xs text-boh-text-sub-light">No exchanges yet.</p>
            ) : (
              visibleExchanges.map((exchange) => (
                <div
                  key={exchange.id ?? `${exchange.sequence}`}
                  className="rounded-md border border-boh-border-light bg-boh-surface-light dark:bg-boh-surface p-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-boh-text-light">
                      {String(exchange.role ?? "unknown")}
                    </div>

                    {exchange?.id && (
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-60"
                        onClick={() => handleRemoveExchange(exchange.id)}
                        disabled={deletingExchangeId === exchange.id}
                      >
                        {deletingExchangeId === exchange.id ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </div>

                  <div className="whitespace-pre-wrap text-boh-text-sub-light">
                    {String(exchange.answer_text ?? exchange.question_text ?? "")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Confirm delete */}
      {confirmExchangeId && (
        <div
          className="modal-backdrop visible"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmExchangeId(null);
          }}
        >
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ textAlign: "left" }}>
              <h3>Delete this message?</h3>
              <p>This removes it from this chapter.</p>
            </div>

            <div className="modal-footer">
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmExchangeId(null)}
                  disabled={Boolean(deletingExchangeId)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const targetId = confirmExchangeId;
                    setConfirmExchangeId(null);
                    if (targetId) void handleConfirmRemove(targetId);
                  }}
                  disabled={Boolean(deletingExchangeId)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMessage} isVisible={isToastVisible} onClose={() => setIsToastVisible(false)} />
    </>
  );
};

export default InterviewPanel;

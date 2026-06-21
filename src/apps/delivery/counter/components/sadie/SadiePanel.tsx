// Main conversation panel for Sadie

import React, { useEffect, useRef, useState } from 'react';
import type { SadieSlots, SadieMode } from './SadieTypes';
import SadieMessageList from './SadieMessageList';
import SadieTextInput from './SadieTextInput';
import ManualTicketForm from './ManualTicketForm';
import SadiePillGroup from './SadiePillGroup';
import SadieErrorBanner from './SadieErrorBanner';
import { SadieThinking } from './SadieThinking';
import { useSadieConversation } from './SadieHooks';
import { useSadieSpeechRecognition } from './hooks/useSadieSpeechRecognition';
import { speakText } from './sadieTts';

const SADIE_TEXT_DRAFT_KEY = 'boh_counter_sadie_text_draft';
const USER_FRIENDLY_ERROR = "Sorry, I couldn't reach the ticket assistant right now. Please try again in a moment.";

interface SadiePanelProps {
  initialMode: SadieMode;
  onComplete: (slots: SadieSlots, aiSessionId: string | null) => void;
  onBack: () => void;
  onTicketCreated?: (ticketId: string) => void;
}

const SadiePanel: React.FC<SadiePanelProps> = ({
  initialMode,
  onComplete,
  onBack,
  onTicketCreated,
}) => {
  const {
    messages,
    slots,
    readyForReview,
    mode,
    expectingStructuredInput,
    structuredInputType,
    structuredInputOptions,
    isLoading,
    isThinking,
    isListening,
    error,
    aiSessionId,
    addUserMessage,
    updateSlot,
    setMode,
    setIsListening,
    initializeConversation,
    onMessageSent,
  } = useSadieConversation(initialMode);

  // Local error state for user-friendly display
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Alert dialog state for microphone errors
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: '', message: '' });

  // Local draft state with localStorage persistence
  const [draft, setDraft] = useState(() => {
    try {
      const saved = localStorage.getItem(SADIE_TEXT_DRAFT_KEY);
      return saved || '';
    } catch {
      return '';
    }
  });

  // Sync error state from hook to user-friendly message
  useEffect(() => {
    if (error) {
      console.error('Sadie error:', error);
      setErrorMessage(USER_FRIENDLY_ERROR);
    } else {
      setErrorMessage(null);
    }
  }, [error]);

  // Clear any visible error banner when the user switches input modes
  useEffect(() => {
    if (errorMessage) {
      setErrorMessage(null);
    }
  }, [mode]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speak new assistant messages in voice mode only
  useEffect(() => {
    if (mode !== 'voice') return;
    if (!messages.length) return;

    const last = messages[messages.length - 1];
    if (last.role !== 'assistant') return;

    speakText(last.content, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [messages, mode]);

  // Shared handler for user messages (typed OR voice)
  const handleUserMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      await addUserMessage(trimmed);
    } catch (error) {
      // Error is already handled by the hook's error state
      // This catch prevents unhandled promise rejection
      console.error('Error in handleUserMessage:', error);
    }
  };

  // Wire up the new speech recognition hook
  const {
    isRecording,
    micStatus,
    startRecording,
    stopRecording,
  } = useSadieSpeechRecognition({
    onFinalTranscript: (text) => {
      // When voice finishes, treat it exactly like typed text
      handleUserMessage(text);
    },
    onError: (title, message) => {
      setAlertDialog({ isOpen: true, title, message });
    },
  });

  // Sync isRecording with isListening state from conversation hook
  useEffect(() => {
    if (isRecording !== isListening) {
      setIsListening(isRecording);
    }
  }, [isRecording, isListening, setIsListening]);

  // Cleanup: ensure we stop recording and any ongoing TTS when leaving the panel
  useEffect(() => {
    return () => {
      try {
        stopRecording();
      } catch {
        // no-op
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // no-op
        }
      }
    };
  }, [stopRecording]);

  // Smart Talk button behaviour
  const handleTalkClick = async () => {
    // Clear any previous mic error dialog
    if (alertDialog.isOpen) {
      setAlertDialog({ isOpen: false, title: '', message: '' });
    }

    if (expectingStructuredInput) {
      setAlertDialog({
        isOpen: true,
        title: 'Action Required',
        message: 'Please select an option above before continuing with voice input.',
      });
      return;
    }

    if (isLoading) {
      setAlertDialog({
        isOpen: true,
        title: 'Please Wait',
        message: "I'm still connecting / processing. Please wait a moment, then try talking again.",
      });
      return;
    }

    // Case 1: Sadie is currently speaking → interrupt and start listening
    if (isSpeaking) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch (e) {
          console.error('Error cancelling speech synthesis:', e);
        }
      }
      setIsSpeaking(false);
      const started = await startRecording();
      if (!started && !alertDialog.isOpen) {
        setAlertDialog({
          isOpen: true,
          title:
            micStatus === 'denied'
              ? 'Microphone Permission Required'
              : 'Voice Unavailable',
          message:
            micStatus === 'denied'
              ? 'Microphone permission is required for voice input.'
              : 'Voice input could not be started. Please check your microphone permissions and try again.',
        });
      }
      return;
    }

    // Case 2: We are currently listening → stop and let hook send transcript
    if (isRecording) {
      stopRecording();
      return;
    }

    // Case 3: Idle → start listening
    const started = await startRecording();
    if (!started && !alertDialog.isOpen) {
      setAlertDialog({
        isOpen: true,
        title:
          micStatus === 'denied'
            ? 'Microphone Permission Required'
            : 'Voice Unavailable',
        message:
          micStatus === 'denied'
            ? 'Microphone permission is required for voice input.'
            : 'Voice input could not be started. Please check your microphone permissions and try again.',
      });
    }
  };

  // Set up draft clearing callback when message is successfully sent
  useEffect(() => {
    const clearDraft = () => {
      setDraft('');
      try {
        localStorage.removeItem(SADIE_TEXT_DRAFT_KEY);
      } catch (e) {
        console.error('Failed to clear draft from localStorage:', e);
      }
    };
    onMessageSent(clearDraft);
  }, [onMessageSent]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    try {
      localStorage.setItem(SADIE_TEXT_DRAFT_KEY, value);
    } catch (e) {
      console.error('Failed to save draft to localStorage:', e);
    }
  };

  const handleTextSend = async (text: string) => {
    // Use the shared handler for consistency
    await handleUserMessage(text);
    // Don't clear draft here - it will be cleared on successful response via onMessageSent
  };

  const handlePillChange = (value: string) => {
    if (structuredInputType) {
      updateSlot(structuredInputType, value);
    }
  };

  const handleReviewTicketClick = () => {
    if (readyForReview) {
      // Ensure mic and TTS are stopped before navigating away
      try {
        stopRecording();
      } catch {
        // no-op
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // no-op
        }
      }
      onComplete(slots, aiSessionId);
    }
  };

  // Initialize conversation on mount
  useEffect(() => {
    initializeConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant');
  const assistantAlreadyPromptedReview = (() => {
    const content = lastAssistantMessage?.content?.toLowerCase() ?? '';
    if (!content) return false;
    return (
      content.includes('review') &&
      (content.includes('draft') || content.includes('ticket'))
    );
  })();

  const handleManualTicketCreated = (ticketId: string) => {
    if (onTicketCreated) {
      onTicketCreated(ticketId);
    }
  };

  if (mode === 'type') {
    return (
      <ManualTicketForm
        onCancel={() => setMode('voice')}
        onCreated={handleManualTicketCreated}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-boh-bg-light dark:bg-boh-bg flex justify-center items-stretch h-full z-50 px-4">
      <div className="flex flex-col h-full w-full max-w-md">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface flex-shrink-0">
        <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Sadie</h2>
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text transition-colors"
        >
          Back
        </button>
      </header>

      {/* Error banner - pinned directly under header, card-width */}
      {errorMessage && <SadieErrorBanner message={errorMessage} />}

      {/* Messages List - Single scroll container */}
      <div className="flex-1 min-h-0 overflow-y-auto boh-hide-scrollbars bg-boh-surface-light dark:bg-boh-surface p-4">
        {messages.length === 0 && isThinking && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub text-center mt-8">
              Connecting you with Sadie…
            </p>
          </div>
        )}
        <SadieMessageList messages={messages} />
        
        {/* Review Ticket CTA - shown when ready for review */}
        {readyForReview && (
          <div className="mt-4 flex justify-start">
            <div className="max-w-[80%] rounded-xl p-4 bg-boh-primary/10 dark:bg-boh-primary/20 border border-boh-primary/20 dark:border-boh-primary/30">
              {!assistantAlreadyPromptedReview && (
                <p className="text-sm text-boh-text-light dark:text-boh-text mb-3 leading-relaxed">
                  I've drafted a ticket based on what you've told me. Want to review and edit it before submitting?
                </p>
              )}
              <button
                type="button"
                onClick={handleReviewTicketClick}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-boh-primary border border-transparent rounded-md shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2 transition-colors"
              >
                Review draft ticket
              </button>
            </div>
          </div>
        )}
        
        {/* Thinking indicator */}
        {isThinking && !readyForReview && (
          <div className="mt-2">
            <SadieThinking />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Footer */}
      <footer className="border-t border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface px-4 py-3 flex-shrink-0 space-y-4">
        {/* Structured Input (Pills) */}
        {expectingStructuredInput && structuredInputType && structuredInputOptions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-boh-text-light dark:text-boh-text">
              Select {structuredInputType}:
            </p>
            <SadiePillGroup
              options={structuredInputOptions}
              value={slots[structuredInputType] || null}
              onChange={handlePillChange}
            />
          </div>
        )}

        {/* Input Area */}
        {mode === 'voice' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTalkClick}
              className={`
                inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors
                focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2
                ${(isLoading || expectingStructuredInput) ? 'opacity-50 cursor-not-allowed' : ''}
                ${
                  isRecording
                    ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                    : 'bg-boh-primary text-white hover:opacity-90'
                }
              `}
              aria-disabled={isLoading || expectingStructuredInput}
              title={
                isRecording
                  ? 'Listening… tap to finish'
                  : isSpeaking
                  ? 'Tap to interrupt Sadie'
                  : 'Start talking with Sadie'
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${isRecording ? 'animate-pulse' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span>
                {isRecording
                  ? 'Listening… tap to finish'
                  : isSpeaking
                  ? 'Tap to interrupt Sadie'
                  : 'Talk'}
              </span>
            </button>
            {isRecording && (
              <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                Sadie is listening…
              </p>
            )}
          </div>
        ) : (
          <SadieTextInput
            value={draft}
            onChange={handleDraftChange}
            onSend={handleTextSend}
            disabled={isLoading || expectingStructuredInput}
            placeholder="Type your message..."
          />
        )}

        {/* Mode toggle */}
        <div className="text-center">
          <button
            onClick={() => setMode(mode === 'voice' ? 'type' : 'voice')}
            className="text-xs text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text underline"
          >
            {mode === 'voice' ? 'Switch to type input' : 'Switch to voice input'}
          </button>
        </div>
      </footer>

      {/* Alert Dialog for microphone errors */}
      {alertDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-2">
              {alertDialog.title}
            </h3>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-4">
              {alertDialog.message}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-white bg-boh-primary border border-transparent rounded-md shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2 transition-colors"
                onClick={() =>
                  setAlertDialog({ isOpen: false, title: '', message: '' })
                }
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default SadiePanel;


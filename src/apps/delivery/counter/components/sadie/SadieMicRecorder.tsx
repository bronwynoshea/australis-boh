// Microphone recorder for Sadie voice input

import React, { useState, useRef, useEffect } from 'react';

interface SadieMicRecorderProps {
  isListening: boolean;
  onTranscript: (transcript: string) => void;
  disabled?: boolean;
  onListeningChange?: (listening: boolean) => void;
  onError?: (error: Error) => void;
}

const SadieMicRecorder: React.FC<SadieMicRecorderProps> = ({
  isListening: externalIsListening,
  onTranscript,
  disabled = false,
  onListeningChange,
  onError,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      streamRef.current = stream;
      // Don't stop the stream yet - we'll use it for recording
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setHasPermission(false);
      return false;
    }
  };

  const startRecording = async () => {
    if (disabled || isProcessing) return;

    try {
      // Request permission if not already granted
      if (hasPermission === null || !streamRef.current) {
        const granted = await requestMicrophonePermission();
        if (!granted) return;
      }

      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current!, {
        mimeType: 'audio/webm',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setIsProcessing(true);
        onListeningChange?.(false);

        try {
          const { transcribeAudio } = await import('./SadieApi');
          const transcript = await transcribeAudio(blob);
          onTranscript(transcript);
        } catch (error) {
          console.error('Error transcribing audio:', error);
          // Propagate error to parent for centralized error handling
          if (onError && error instanceof Error) {
            onError(error);
          }
          // Don't call onTranscript - error will be shown in error banner
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      onListeningChange?.(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setHasPermission(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      onListeningChange?.(false);
      
      // Stop the stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  if (hasPermission === false) {
    return (
      <div className="text-center p-4">
        <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-2">
          Microphone permission is required for voice input.
        </p>
        <button
          onClick={requestMicrophonePermission}
          className="text-sm text-boh-primary underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-1">
      {externalIsListening ? (
        <>
          <div className="relative flex items-center justify-center">
            <div className="absolute h-14 w-14 rounded-full bg-boh-primary/30 animate-ping" />
            <button
              onClick={handleClick}
              disabled={disabled}
              className="relative h-12 w-12 rounded-full bg-boh-primary flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2 disabled:opacity-50"
              aria-label="Stop recording"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-white"
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
            </button>
          </div>
          <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Sadie is listening…</p>
        </>
      ) : (
        <>
          <button
            onClick={handleClick}
            disabled={disabled || isProcessing}
            className={`
              h-12 w-12 rounded-full flex items-center justify-center
              ${isProcessing
                ? 'bg-boh-primary/50 text-white cursor-wait'
                : 'bg-boh-primary text-white hover:opacity-90'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2
            `}
            aria-label="Start recording"
          >
            {isProcessing ? (
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
            )}
          </button>
        </>
      )}
    </div>
  );
};

export default SadieMicRecorder;


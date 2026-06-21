import { useCallback, useRef, useState } from 'react';

// TypeScript declarations for SpeechRecognition API
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent {
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

type MicStatus = 'off' | 'on' | 'denied';

interface UseSadieSpeechRecognitionOptions {
  onFinalTranscript: (text: string) => void;
  onError?: (title: string, message: string) => void;
}

/**
 * Sadie-specific speech recognition hook, extracted from the Journey Journal logic.
 * - Uses browser SpeechRecognition / webkitSpeechRecognition
 * - Handles mic permission
 * - Streams interim text
 * - Calls onFinalTranscript once with the final spoken text
 */
export function useSadieSpeechRecognition(options: UseSadieSpeechRecognitionOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [micStatus, setMicStatus] = useState<MicStatus>('off');

  // Refs for speech recognition
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const transcriptionRef = useRef<string>('');

  const startRecording = useCallback(async () => {
    // Check for SpeechRecognition API support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      options.onError?.(
        'Browser Not Supported',
        'Speech recognition is not supported in this browser. Please use a modern browser like Chrome, Edge, or Safari.'
      );
      return false;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setMicStatus('on');
      setIsRecording(true);
      transcriptionRef.current = '';

      // Create SpeechRecognition instance
      const recognition = new SpeechRecognition();
      speechRecognitionRef.current = recognition;

      // Configure SpeechRecognition
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      // Handle recognition results
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          const finalText = finalTranscript.trim();

          // Accumulate final transcripts in ref
          transcriptionRef.current = `${
            (transcriptionRef.current || '').trim()
          } ${finalText}`.trim();
        } else if (interimTranscript) {
          // Store interim transcript in ref (not displayed, but kept for final accumulation)
          transcriptionRef.current = interimTranscript;
        }
      };

      // Handle recognition end
      recognition.onend = () => {
        const finalTranscription = (transcriptionRef.current || '').trim();

        // Cleanup
        setIsRecording(false);
        transcriptionRef.current = '';
        speechRecognitionRef.current = null;

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        // Send final text back to caller (Sadie chat)
        if (finalTranscription) {
          options.onFinalTranscript(finalTranscription);
        }
      };

      // Handle errors
      recognition.onerror = (event: any) => {
        console.error('Sadie speech recognition error:', event.error);

        if (event.error === 'not-allowed') {
          setMicStatus('denied');
          options.onError?.(
            'Microphone Access Denied',
            'Microphone access denied. Please enable your microphone in browser settings.'
          );
        } else {
          options.onError?.(
            'Microphone Error',
            'There was a problem using the microphone. Please check your microphone connection.'
          );
        }

        setIsRecording(false);
        speechRecognitionRef.current = null;

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      // Start recognition
      recognition.start();
      return true;
    } catch (error: any) {
      console.error('Error starting Sadie recording:', error);

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setMicStatus('denied');
        options.onError?.(
          'Microphone Access Denied',
          'Microphone access denied. Please enable your microphone in browser settings.'
        );
      } else {
        options.onError?.(
          'Microphone Error',
          'Could not access microphone. Please check your microphone connection.'
        );
      }

      setIsRecording(false);
      return false;
    }
  }, [options]);

  const stopRecording = useCallback(() => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {
        console.error('Error stopping Sadie SpeechRecognition:', e);
      }
      speechRecognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    setIsRecording(false);
    transcriptionRef.current = '';
  }, [options]);

  return {
    isRecording,
    micStatus,
    startRecording,
    stopRecording,
  };
}


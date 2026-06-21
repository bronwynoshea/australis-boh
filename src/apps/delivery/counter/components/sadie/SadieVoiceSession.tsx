import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Blob,
} from '@google/genai';
import { CloseIcon, MicIcon } from '../../components/Icons';
import { decode, decodeAudioData } from '../../../../../shared/utils/audioUtils';
import { getModuleStyling } from '../../../../../shared/styling';
import StaticBackgroundBlobs from '../../../../../shared/components/StaticBackgroundBlobs';

type SadieTranscriptItem = {
  speaker: 'user' | 'sadie' | 'system';
  text: string;
};

type SessionStatus = 'idle' | 'connecting' | 'live' | 'error';
type VoiceState = 'idle' | 'sadieSpeaking' | 'userTurn';

interface SadieVoiceSessionProps {
  theme: 'dark' | 'light';
  /** Close the voice session without using the transcript */
  onClose: () => void;
  /** Use the full transcript to create / refine a ticket */
  onComplete: (transcript: SadieTranscriptItem[]) => void;
}

/**
 * Persona + behaviour for Sadie.
 */
const SADIE_PERSONA = {
  name: 'Sadie',
  avatarUrl: '/assets/avatars/sadie.png', // update path if needed
  roleLabel: 'AI Support Assistant',
  moduleName: 'BOH',
};

const sadieSystemInstruction = `
You are Sadie, the AI support assistant for the JOBZ CAFE® Back of House (BOH) Counter.

Your job:
- Help the user describe an issue or improvement request.
- Ask short, clear follow-up questions, ONE at a time.
- Never use the word "bug". Use "issue", "problem", or "something that isn't working" instead.
- Ask about:
  • What they were trying to do
  • What they expected to happen
  • What actually happened, or what is missing
  • How much this affects their work:
      - "Can't work at all"
      - "Major inconvenience"
      - "Minor inconvenience"
      - "Nice to have"

Style:
- Warm, calm, practical.
- Keep each spoken reply to 1–2 short sentences.
- Avoid jargon and therapy language.
- You are not a therapist or coach. Focus only on the product experience and JOBZ CAFE®.

At the end of the conversation, make sure you:
- Understand the issue clearly.
- Understand the severity (using the four phrases above).
`;

const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const createBlob = (data: Float32Array): Blob => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
};

const PulsingOrb: React.FC<{
  isSpeaking: boolean;
  moduleName: string;
  theme: 'dark' | 'light';
}> = ({ isSpeaking, moduleName, theme }) => {
  const { style } = getModuleStyling(moduleName as any, theme);
  return (
    <div className="relative w-40 h-40 flex items-center justify-center" style={style}>
      <div className="absolute w-full h-full bg-[var(--primary-module-accent-color)]/10 rounded-full" />
      <div className="absolute w-2/3 h-2/3 bg-[var(--primary-module-accent-color)]/20 rounded-full blur-lg" />
      <div className="absolute w-1/3 h-2/3 bg-[var(--primary-module-accent-color)]/30 rounded-full blur-xl" />
      {isSpeaking && (
        <>
          <div
            className="absolute w-full h-full rounded-full border border-[var(--module-accent-color)]/80 animate-pulse-ring"
            style={{ animationDelay: '0s' }}
          />
          <div
            className="absolute w-full h-full rounded-full border border-[var(--module-accent-color)]/80 animate-pulse-ring"
            style={{ animationDelay: '0.8s' }}
          />
        </>
      )}
    </div>
  );
};

const VoiceModeUI: React.FC<{
  voiceState: VoiceState;
  personaName: string;
  moduleName: string;
  theme: 'dark' | 'light';
  voiceStatusText: string;
}> = ({ voiceState, personaName, moduleName, theme, voiceStatusText }) => {
  const isSadieSpeaking = voiceState === 'sadieSpeaking';
  return (
    <div className="flex flex-col items-center justify-center text-center p-4 gap-4">
      <PulsingOrb isSpeaking={isSadieSpeaking} moduleName={moduleName} theme={theme} />
      <p className="font-semibold text-brand-bg-dark/80 dark:text-white/80">
        {voiceStatusText ||
          (voiceState === 'sadieSpeaking'
            ? `${personaName} is speaking...`
            : voiceState === 'userTurn'
            ? 'Listening...'
            : 'Tap the microphone and start talking.')}
      </p>
    </div>
  );
};

type LiveSession = Awaited<
  ReturnType<InstanceType<typeof GoogleGenAI>['live']['connect']>
>;

const SadieVoiceSession: React.FC<SadieVoiceSessionProps> = ({
  theme,
  onClose,
  onComplete,
}) => {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceStatusText, setVoiceStatusText] = useState('');
  const [transcript, setTranscript] = useState<SadieTranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const liveSessionRef = useRef<LiveSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(
    null
  );
  const hasStartedRef = useRef(false);

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const isListeningRef = useRef(false);
  const isConnectingRef = useRef(false);

  const moduleName = SADIE_PERSONA.moduleName;
  const { style } = getModuleStyling(moduleName as any, theme);

  const sendRealtimeInput = useCallback((data: { media?: Blob; text?: string }) => {
    const session = liveSessionRef.current;
    if (!session || !isListeningRef.current) {
      return;
    }
    try {
      session.sendRealtimeInput(data);
    } catch (err) {
      console.warn('Error sending realtime input:', err);
    }
  }, []);

  const stopVoiceMode = useCallback(() => {
    const session = liveSessionRef.current;
    const wasListening = isListeningRef.current;
    const wasConnecting = isConnectingRef.current;

    isListeningRef.current = false;
    isConnectingRef.current = false;
    setVoiceState('idle');
    setVoiceStatusText('');

    if (session && (wasListening || wasConnecting)) {
      try {
        session.close();
      } catch (err) {
        console.warn('Error closing LiveSession:', err);
      }
    }
    liveSessionRef.current = null;

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.mediaStream
        .getTracks()
        .forEach((track) => track.stop());
      mediaStreamSourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (
      outputAudioContextRef.current &&
      outputAudioContextRef.current.state !== 'closed'
    ) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    audioSourcesRef.current.forEach((source) => source.stop());
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const sendWelcomeMessage = useCallback(
    async (session: LiveSession) => {
      // Brief, focused greeting so the model starts the conversation.
      const welcomePrompt = `
Start the conversation as Sadie.

Use 1–2 short sentences to:
- Greet the user by saying "Hi, I'm Sadie".
- Tell them you'll help them describe an issue.
- Ask them to briefly explain what's going wrong or what they'd like added.`;

      try {
        // While Sadie is speaking, mic is off
        isListeningRef.current = false;
        setVoiceState('sadieSpeaking');
        setVoiceStatusText(`${SADIE_PERSONA.name} is speaking...`);
        session.sendRealtimeInput({ text: welcomePrompt });
      } catch (err) {
        console.error('Error sending welcome prompt:', err);
      }
    },
    []
  );

  const startVoiceMode = useCallback(async () => {
    if (liveSessionRef.current && (isListeningRef.current || isConnectingRef.current)) {
      return;
    }

    if (liveSessionRef.current) {
      try {
        liveSessionRef.current.close();
      } catch {
        // ignore
      }
      liveSessionRef.current = null;
    }

    setStatus('connecting');
    setVoiceStatusText('Connecting...');
    setError(null);
    isConnectingRef.current = true;

    try {
      const ai = new GoogleGenAI({
        apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      outputAudioContextRef.current = new (window.AudioContext ||
        (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
      await outputAudioContextRef.current.resume();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            isConnectingRef.current = false;
            setStatus('live');

            audioContextRef.current = new (window.AudioContext ||
              (window as any).webkitAudioContext)({
              sampleRate: 16000,
            });
            mediaStreamSourceRef.current =
              audioContextRef.current.createMediaStreamSource(stream);
            scriptProcessorRef.current =
              audioContextRef.current.createScriptProcessor(4096, 1, 1);

            scriptProcessorRef.current.onaudioprocess = (evt) => {
              if (!isListeningRef.current) return;
              const inputData = evt.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sendRealtimeInput({ media: pcmBlob });
            };

            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current.destination);

            // Send initial greeting
            setTimeout(() => {
              if (liveSessionRef.current) {
                sendWelcomeMessage(liveSessionRef.current);
              }
            }, 80);
          },

          onmessage: async (message: LiveServerMessage) => {
            const base64Audio =
              message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              isListeningRef.current = false;
              setVoiceState('sadieSpeaking');
              setVoiceStatusText(`${SADIE_PERSONA.name} is speaking...`);

              const outCtx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(
                nextStartTimeRef.current,
                outCtx.currentTime
              );

              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                outCtx,
                24000,
                1
              );

              const source = outCtx.createBufferSource();
              source.buffer = audioBuffer;
              const gainNode = outCtx.createGain();
              source.connect(gainNode);
              gainNode.connect(outCtx.destination);

              source.addEventListener('ended', () => {
                audioSourcesRef.current.delete(source);
                if (audioSourcesRef.current.size === 0) {
                  isListeningRef.current = true;
                  setVoiceState('userTurn');
                  setVoiceStatusText('Listening...');
                }
              });

              source.start(nextStartTimeRef.current, 0);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              audioSourcesRef.current.forEach((source) => source.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              isListeningRef.current = true;
              setVoiceState('userTurn');
              setVoiceStatusText('Listening...');
            }

            if (message.serverContent?.inputTranscription) {
              currentInputTranscriptionRef.current +=
                message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscriptionRef.current +=
                message.serverContent.outputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const fullInput = currentInputTranscriptionRef.current.trim();
              const fullOutput = currentOutputTranscriptionRef.current.trim();

              if (fullInput || fullOutput) {
                setTranscript((prev) => {
                  const next: SadieTranscriptItem[] = [...prev];
                  if (fullInput) {
                    next.push({ speaker: 'user', text: fullInput });
                  }
                  if (fullOutput) {
                    next.push({ speaker: 'sadie', text: fullOutput });
                  }
                  return next;
                });
              }

              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
            }
          },

          onerror: (e: any) => {
            console.error('Sadie LiveSession error:', e);
            isConnectingRef.current = false;
            isListeningRef.current = false;
            let msg = 'A connection error occurred. Please try again or use text.';
            if (e?.message?.includes('referer') || e?.message?.includes('blocked')) {
              msg = 'Access denied. Please check your API key referrer restrictions.';
            }
            setError(msg);
            setTranscript((prev) => [
              ...prev,
              { speaker: 'system', text: msg },
            ]);
            setVoiceState('idle');
            setVoiceStatusText('');
            setStatus('error');
          },

          onclose: () => {
            isConnectingRef.current = false;
            isListeningRef.current = false;
            setVoiceState('idle');
            setVoiceStatusText('');
            liveSessionRef.current = null;
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                // Reuse Kore (Coach) voice, or change if you prefer.
                voiceName: 'Kore',
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: sadieSystemInstruction,
        },
      });

      liveSessionRef.current = await sessionPromise;
    } catch (e: any) {
      console.error('Sadie failed to start live session', e);
      isConnectingRef.current = false;
      isListeningRef.current = false;
      liveSessionRef.current = null;

      let msg =
        'An unexpected error occurred starting voice. You can still create an issue using text.';
      if (e?.message?.includes('referer') || e?.message?.includes('blocked')) {
        msg = 'Access denied. Please check your API key referrer restrictions.';
      } else if (
        e?.name === 'NotAllowedError' ||
        e?.name === 'NotFoundError'
      ) {
        msg =
          'Could not access your microphone. Please check your browser permissions.';
      }
      setError(msg);
      setTranscript((prev) => [...prev, { speaker: 'system', text: msg }]);
      setVoiceState('idle');
      setVoiceStatusText('');
      setStatus('error');
    }
  }, [sendRealtimeInput, sendWelcomeMessage]);

  const startSession = useCallback(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    setError(null);
    setTranscript([
      {
        speaker: 'sadie',
        text: `Hi, I'm ${SADIE_PERSONA.name}. Let's talk through what's happening.`,
      },
    ]);
    setStatus('live');
  }, []);

  const handleUseTranscript = () => {
    stopVoiceMode();
    onComplete(transcript);
  };

  const handleCancel = () => {
    stopVoiceMode();
    onClose();
  };

  useEffect(() => {
    startSession();

    return () => {
      stopVoiceMode();
    };
  }, [startSession, stopVoiceMode]);

  useEffect(() => {
    if (status === 'live' && voiceState === 'idle') {
      startVoiceMode();
    }
  }, [status, voiceState, startVoiceMode]);

  return (
    <div
      className={`fixed inset-0 z-[99999] bg-gradient-to-b from-brand-bg-light to-boh-bg-light dark:to-boh-bg grain-overlay vignette overflow-hidden ${
        theme === 'dark' ? 'dark' : ''
      }`}
      style={style}
      role="dialog"
      aria-modal="true"
    >
      <StaticBackgroundBlobs />

      <div className="relative h-full w-full flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0 z-20">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative">
              <img
                className="w-10 h-10 rounded-full flex-shrink-0 object-cover border border-[var(--module-color)]"
                src={SADIE_PERSONA.avatarUrl}
                alt={SADIE_PERSONA.name}
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border border-white dark:border-[color:var(--jc-surface)] rounded-full" />
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-bold text-brand-bg-dark dark:text-white text-sm truncate">
                Talk to Sadie about an issue
              </p>
              <p className="text-xs text-brand-bg-dark/60 dark:text-white/60">
                Describe what&apos;s going wrong or what you&apos;d like added.
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 -m-2 text-brand-bg-dark/60 dark:text-white/60 hover:text-brand-bg-dark dark:hover:text-white hover:bg-black/5 dark:hover:bg-boh-surface-light dark:hover:bg-boh-surface/10 rounded-full transition-colors flex-shrink-0"
            aria-label="Close Sadie session"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="border-b border-black/5 dark:border-white/10" />

        <main className="flex-1 flex flex-col overflow-hidden relative z-10 bg-transparent">
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <VoiceModeUI
              voiceState={voiceState}
              personaName={SADIE_PERSONA.name}
              moduleName={moduleName}
              theme={theme}
              voiceStatusText={voiceStatusText}
            />

            {error && (
              <div className="mt-4 max-w-md text-center text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {/** Optional: small hint about severity later in conversation */}
            <p className="mt-6 max-w-md text-xs text-brand-bg-dark/60 dark:text-white/60 text-center">
              Sadie will ask a few short follow-up questions. You can mention how
              much this affects your work, like &quot;can&apos;t work at all&quot; or
              &quot;minor inconvenience&quot;.
            </p>
          </div>
        </main>

        <footer className="px-4 pb-4 pt-2 flex-shrink-0 z-20 flex items-center justify-between gap-3 bg-black/5 dark:bg-black/40 backdrop-blur-sm">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-black/10 dark:border-white/20 text-brand-bg-dark/80 dark:text-white/80 bg-boh-surface-light dark:bg-boh-surface/70 dark:bg-black/40 hover:bg-black/5 dark:hover:bg-boh-surface-light dark:hover:bg-boh-surface/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUseTranscript}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md bg-[var(--module-color)] hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <MicIcon className="w-4 h-4" />
            Use this to create my ticket
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SadieVoiceSession;




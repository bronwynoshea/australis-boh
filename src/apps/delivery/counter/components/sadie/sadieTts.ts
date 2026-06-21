// Simple text-to-speech helper for Sadie assistant messages

interface SpeakTextOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export function speakText(text: string, options?: SpeakTextOptions) {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window)) return;

  const trimmed = text?.trim();
  if (!trimmed) return;

  // Replace brand text for spoken version only so the UI can still
  // render the official JOBZ CAFE® spelling while the voice sounds
  // natural to users.
  const spoken = trimmed
    .replace(/JOBZ CAFE®/gi, 'Jobs Cafe')
    .replace(/JOBZ/gi, 'Jobs');

  try {
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.rate = 1;
    utterance.pitch = 1;

    if (options?.onStart) {
      utterance.onstart = () => {
        try {
          options.onStart?.();
        } catch (e) {
          console.error('Error in speakText onStart callback:', e);
        }
      };
    }

    if (options?.onEnd) {
      utterance.onend = () => {
        try {
          options.onEnd?.();
        } catch (e) {
          console.error('Error in speakText onEnd callback:', e);
        }
      };
    }

    if (options?.onError) {
      utterance.onerror = () => {
        try {
          options.onError?.();
        } catch (e) {
          console.error('Error in speakText onError callback:', e);
        }
      };
    }

    // Cancel any in-flight utterances so Sadie doesn't queue endlessly
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    // Fail silently – TTS is a progressive enhancement
    console.error('Sadie TTS error:', err);
    if (options?.onError) {
      try {
        options.onError();
      } catch (e) {
        console.error('Error in speakText onError callback:', e);
      }
    }
  }
}

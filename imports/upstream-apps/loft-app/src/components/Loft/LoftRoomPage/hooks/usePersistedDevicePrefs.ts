import { useEffect } from 'react';

const AUDIO_DEVICE_KEY = 'loft.audio.device_id';
const VIDEO_DEVICE_KEY = 'loft.video.device_id';
const SPEAKER_DEVICE_KEY = 'loft.speaker.device_id';

export function usePersistedDevicePrefs(params: {
  selectedAudioDeviceId: string | null;
  selectedVideoDeviceId: string | null;
  selectedSpeakerDeviceId?: string | null;
  setSelectedAudioDeviceId: (v: string | null) => void;
  setSelectedVideoDeviceId: (v: string | null) => void;
  setSelectedSpeakerDeviceId?: (v: string | null) => void;
}) {
  // On mount, read from localStorage and hydrate state
  useEffect(() => {
    try {
      const storedAudio = localStorage.getItem(AUDIO_DEVICE_KEY);
      if (storedAudio) {
        params.setSelectedAudioDeviceId(storedAudio);
      }
    } catch {
      // ignore
    }

    try {
      const storedVideo = localStorage.getItem(VIDEO_DEVICE_KEY);
      if (storedVideo) {
        params.setSelectedVideoDeviceId(storedVideo);
      }
    } catch {
      // ignore
    }

    if (params.setSelectedSpeakerDeviceId) {
      try {
        const storedSpeaker = localStorage.getItem(SPEAKER_DEVICE_KEY);
        if (storedSpeaker) {
          params.setSelectedSpeakerDeviceId(storedSpeaker);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Persist audio device when it changes
  useEffect(() => {
    try {
      if (params.selectedAudioDeviceId) {
        localStorage.setItem(AUDIO_DEVICE_KEY, params.selectedAudioDeviceId);
      } else {
        localStorage.removeItem(AUDIO_DEVICE_KEY);
      }
    } catch {
      // ignore
    }
  }, [params.selectedAudioDeviceId]);

  // Persist video device when it changes
  useEffect(() => {
    try {
      if (params.selectedVideoDeviceId) {
        localStorage.setItem(VIDEO_DEVICE_KEY, params.selectedVideoDeviceId);
      } else {
        localStorage.removeItem(VIDEO_DEVICE_KEY);
      }
    } catch {
      // ignore
    }
  }, [params.selectedVideoDeviceId]);

  // Persist speaker device when it changes (if provided)
  useEffect(() => {
    if (!params.setSelectedSpeakerDeviceId) return;
    try {
      if (params.selectedSpeakerDeviceId) {
        localStorage.setItem(SPEAKER_DEVICE_KEY, params.selectedSpeakerDeviceId);
      } else {
        localStorage.removeItem(SPEAKER_DEVICE_KEY);
      }
    } catch {
      // ignore
    }
  }, [params.selectedSpeakerDeviceId, params.setSelectedSpeakerDeviceId]);
}

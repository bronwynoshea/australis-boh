import { useEffect } from 'react';

export function useHydrateDevicePrefs(params: {
  setSelectedAudioDeviceId: (v: string | null) => void;
  setSelectedVideoDeviceId: (v: string | null) => void;
  setSelectedSpeakerDeviceId?: (v: string | null) => void;
}) {
  useEffect(() => {
    try {
      const audioDeviceId = localStorage.getItem('loft.audio.device_id');
      if (audioDeviceId && typeof audioDeviceId === 'string' && audioDeviceId.trim()) {
        params.setSelectedAudioDeviceId(audioDeviceId);
      }
    } catch {
      // ignore storage errors
    }

    try {
      const videoDeviceId = localStorage.getItem('loft.video.device_id');
      if (videoDeviceId && typeof videoDeviceId === 'string' && videoDeviceId.trim()) {
        params.setSelectedVideoDeviceId(videoDeviceId);
      }
    } catch {
      // ignore storage errors
    }

    if (params.setSelectedSpeakerDeviceId) {
      try {
        const speakerDeviceId = localStorage.getItem('loft.speaker.device_id');
        if (speakerDeviceId && typeof speakerDeviceId === 'string' && speakerDeviceId.trim()) {
          params.setSelectedSpeakerDeviceId(speakerDeviceId);
        }
      } catch {
        // ignore storage errors
      }
    }
  }, []);
}

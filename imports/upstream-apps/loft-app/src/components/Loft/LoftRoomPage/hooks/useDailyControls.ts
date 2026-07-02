import { useCallback } from 'react';
import type { DailyCall } from '@daily-co/daily-js';

export function useDailyControls(callObject: DailyCall | null | undefined) {
  const toggleMic = useCallback(async () => {
    if (!callObject) return;
    try {
      const isOn = callObject.localAudio();
      await callObject.setLocalAudio(!isOn);
    } catch (err) {
      console.warn('[LoftControls] toggleMic failed', err);
    }
  }, [callObject]);

  const toggleCamera = useCallback(async () => {
    if (!callObject) return;
    try {
      const isOn = callObject.localVideo();
      await callObject.setLocalVideo(!isOn);
    } catch (err) {
      console.warn('[LoftControls] toggleCamera failed', err);
    }
  }, [callObject]);

  const leaveMeeting = useCallback(async () => {
    if (!callObject) return;
    try {
      await callObject.leave();
    } catch (err) {
      console.warn('[LoftControls] leaveMeeting failed', err);
    }
  }, [callObject]);

  const setInputDevices = useCallback(
    async (next: { micId?: string | null; camId?: string | null }) => {
      if (!callObject) return;
      try {
        const args: any = {};
        if (next.micId && typeof next.micId === 'string' && next.micId.trim()) {
          args.audioDeviceId = next.micId;
        }
        if (next.camId && typeof next.camId === 'string' && next.camId.trim()) {
          args.videoDeviceId = next.camId;
        }
        if (Object.keys(args).length === 0) return;
        await callObject.setInputDevicesAsync(args);
      } catch (err) {
        console.warn('[LoftControls] setInputDevices failed', err);
      }
    },
    [callObject]
  );

  const setSpeakerDevice = useCallback(
    async (next: { speakerId?: string | null }) => {
      if (!callObject) return;
      if (!next.speakerId || typeof next.speakerId !== 'string' || !next.speakerId.trim()) {
        return;
      }
      if (typeof (callObject as any).setOutputDeviceAsync !== 'function') {
        return;
      }
      try {
        await (callObject as any).setOutputDeviceAsync(next.speakerId);
      } catch (err) {
        console.warn('[LoftControls] setSpeakerDevice failed', err);
      }
    },
    [callObject]
  );

  return {
    toggleMic,
    toggleCamera,
    leaveMeeting,
    setInputDevices,
    setSpeakerDevice,
  };
}

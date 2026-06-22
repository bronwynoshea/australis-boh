import { useEffect } from 'react';

export type DailyHandlers = {
  onJoinedMeeting?: () => void;
  onNonfatalError?: (e: any) => void;
  onParticipantJoined?: (e: any) => void;
  onParticipantUpdated?: (e: any) => void;
  onParticipantLeft?: (e: any) => void;
  onWaitingParticipantAdded?: (e: any) => void;
  onWaitingParticipantUpdated?: (e: any) => void;
  onWaitingParticipantRemoved?: (e: any) => void;
  onTrackStarted?: (e: any) => void;
  onTrackStopped?: (e: any) => void;
  onLocalScreenShareStarted?: (e: any) => void;
  onLocalScreenShareStopped?: (e: any) => void;
  onLocalScreenShareCanceled?: (e: any) => void;
  onRecordingStarted?: (e: any) => void;
  onRecordingStopped?: (e: any) => void;
  onRecordingError?: (e: any) => void;
  onAppMessage?: (e: any) => void;
};

export function useDailyEventBindings(callObject: any | null, handlers: DailyHandlers) {
  useEffect(() => {
    if (!callObject) return;

    const handleJoined = () => handlers.onJoinedMeeting?.();
    const handleNonfatal = (e: any) => handlers.onNonfatalError?.(e);
    const handlePJoined = (e: any) => handlers.onParticipantJoined?.(e);
    const handlePUpdated = (e: any) => handlers.onParticipantUpdated?.(e);
    const handlePLeft = (e: any) => handlers.onParticipantLeft?.(e);
    const handleWaitingAdded = (e: any) => handlers.onWaitingParticipantAdded?.(e);
    const handleWaitingUpdated = (e: any) => handlers.onWaitingParticipantUpdated?.(e);
    const handleWaitingRemoved = (e: any) => handlers.onWaitingParticipantRemoved?.(e);
    const handleTrackStarted = (e: any) => handlers.onTrackStarted?.(e);
    const handleTrackStopped = (e: any) => handlers.onTrackStopped?.(e);
    const handleLocalScreenStarted = (e: any) => handlers.onLocalScreenShareStarted?.(e);
    const handleLocalScreenStopped = (e: any) => handlers.onLocalScreenShareStopped?.(e);
    const handleLocalScreenCanceled = (e: any) => handlers.onLocalScreenShareCanceled?.(e);
    const handleRecordingStarted = (e: any) => handlers.onRecordingStarted?.(e);
    const handleRecordingStopped = (e: any) => handlers.onRecordingStopped?.(e);
    const handleRecordingError = (e: any) => handlers.onRecordingError?.(e);
    const handleAppMessage = (e: any) => handlers.onAppMessage?.(e);

    callObject.on('joined-meeting', handleJoined);
    callObject.on('nonfatal-error', handleNonfatal);
    callObject.on('participant-joined', handlePJoined);
    callObject.on('participant-updated', handlePUpdated);
    callObject.on('participant-left', handlePLeft);
    callObject.on('waiting-participant-added', handleWaitingAdded);
    callObject.on('waiting-participant-updated', handleWaitingUpdated);
    callObject.on('waiting-participant-removed', handleWaitingRemoved);
    callObject.on('track-started', handleTrackStarted);
    callObject.on('track-stopped', handleTrackStopped);
    callObject.on('local-screen-share-started', handleLocalScreenStarted);
    callObject.on('local-screen-share-stopped', handleLocalScreenStopped);
    callObject.on('local-screen-share-canceled', handleLocalScreenCanceled);
    callObject.on('recording-started', handleRecordingStarted);
    callObject.on('recording-stopped', handleRecordingStopped);
    callObject.on('recording-error', handleRecordingError);
    callObject.on('app-message', handleAppMessage);

    return () => {
      try {
        callObject.off('joined-meeting', handleJoined);
        callObject.off('nonfatal-error', handleNonfatal);
        callObject.off('participant-joined', handlePJoined);
        callObject.off('participant-updated', handlePUpdated);
        callObject.off('participant-left', handlePLeft);
        callObject.off('waiting-participant-added', handleWaitingAdded);
        callObject.off('waiting-participant-updated', handleWaitingUpdated);
        callObject.off('waiting-participant-removed', handleWaitingRemoved);
        callObject.off('track-started', handleTrackStarted);
        callObject.off('track-stopped', handleTrackStopped);
        callObject.off('local-screen-share-started', handleLocalScreenStarted);
        callObject.off('local-screen-share-stopped', handleLocalScreenStopped);
        callObject.off('local-screen-share-canceled', handleLocalScreenCanceled);
        callObject.off('recording-started', handleRecordingStarted);
        callObject.off('recording-stopped', handleRecordingStopped);
        callObject.off('recording-error', handleRecordingError);
        callObject.off('app-message', handleAppMessage);
      } catch {
        // ignore
      }
    };
  }, [callObject, handlers]);
}

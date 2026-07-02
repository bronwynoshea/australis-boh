import { useEffect, useRef } from 'react';
import { DAILY_SINGLETON_KEY } from '../utils/loftConstants';

export type DailyHandlers = {
  onJoinedMeeting?: () => void;
  onNonfatalError?: (e: any) => void;
  onParticipantEvent?: () => void;
  onTrackStarted?: (e: any) => void;
  onAppMessage?: (e: any) => void;
};

interface UseDailyCallFacadeParams {
  callObjectRef: React.MutableRefObject<any>;
  handlersRef: React.MutableRefObject<DailyHandlers>;
  createCallObject: () => any;
  shouldHaveCallObject: boolean;
}

export function useDailyCallFacade(params: UseDailyCallFacadeParams): void {
  const {
    callObjectRef,
    handlersRef,
    createCallObject,
    shouldHaveCallObject,
  } = params;

  const listenersAttachedRef = useRef(false);

  useEffect(() => {
    // Create call object if needed
    if (shouldHaveCallObject && !callObjectRef.current) {
      callObjectRef.current = createCallObject();
    }

    // Destroy call object if no longer needed
    if (!shouldHaveCallObject && callObjectRef.current) {
      const callObject = callObjectRef.current;
      
      // Remove listeners first
      if (listenersAttachedRef.current) {
        try {
          callObject.off('joined-meeting', handleJoinedMeeting);
          callObject.off('nonfatal-error', handleNonfatalError);
          callObject.off('participant-joined', handleParticipantEvent);
          callObject.off('participant-updated', handleParticipantEvent);
          callObject.off('participant-left', handleParticipantEvent);
          callObject.off('track-stopped', handleParticipantEvent);
          callObject.off('track-started', handleTrackStarted);
          callObject.off('app-message', handleAppMessage);
        } catch {
          // ignore
        }
        listenersAttachedRef.current = false;
      }

      // Destroy call object
      try {
        const isSingleton = typeof window !== 'undefined' && (window as any)[DAILY_SINGLETON_KEY] === callObject;
        if (!isSingleton) {
          try { callObject.destroy(); } catch { /* ignore */ }
        }
      } catch {
        // ignore
      }
      
      callObjectRef.current = null;
      return;
    }

    // Attach listeners if call object exists and listeners not already attached
    const callObject = callObjectRef.current;
    if (callObject && !listenersAttachedRef.current) {
      callObject.on('joined-meeting', handleJoinedMeeting);
      callObject.on('nonfatal-error', handleNonfatalError);
      callObject.on('participant-joined', handleParticipantEvent);
      callObject.on('participant-updated', handleParticipantEvent);
      callObject.on('participant-left', handleParticipantEvent);
      callObject.on('track-stopped', handleParticipantEvent);
      callObject.on('track-started', handleTrackStarted);
      callObject.on('app-message', handleAppMessage);
      
      listenersAttachedRef.current = true;
    }

    // Handler functions that delegate to current handlers
    function handleJoinedMeeting() {
      handlersRef.current.onJoinedMeeting?.();
    }

    function handleNonfatalError(e: any) {
      handlersRef.current.onNonfatalError?.(e);
    }

    function handleParticipantEvent() {
      handlersRef.current.onParticipantEvent?.();
    }

    function handleTrackStarted(e: any) {
      handlersRef.current.onTrackStarted?.(e);
    }

    function handleAppMessage(e: any) {
      handlersRef.current.onAppMessage?.(e);
    }

    // Cleanup on unmount
    return () => {
      const callObject = callObjectRef.current;
      if (callObject && listenersAttachedRef.current) {
        try {
          callObject.off('joined-meeting', handleJoinedMeeting);
          callObject.off('nonfatal-error', handleNonfatalError);
          callObject.off('participant-joined', handleParticipantEvent);
          callObject.off('participant-updated', handleParticipantEvent);
          callObject.off('participant-left', handleParticipantEvent);
          callObject.off('track-stopped', handleParticipantEvent);
          callObject.off('track-started', handleTrackStarted);
          callObject.off('app-message', handleAppMessage);
        } catch {
          // ignore
        }
        listenersAttachedRef.current = false;
      }
    };
  }, [shouldHaveCallObject, createCallObject, callObjectRef, handlersRef]);
}

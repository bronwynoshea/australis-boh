import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { callEdgeFunction, useSupabaseUser } from '@/services/supabaseApi';
import { supabase } from '@/services/supabaseClient';
import AnimatedBackgroundBlobs from '../AnimatedBackgroundBlobs';
import { useDailyControls } from '../LoftRoomPage/hooks/useDailyControls';
import { useDailyEventBindings } from '../LoftRoomPage/hooks/useDailyEventBindings';
import { useClientInstanceId } from '../LoftRoomPage/hooks/useClientInstanceId';
import { useLoftMedia } from '@/hooks/useLoftMedia';
import PersonalRoomHeader from './components/PersonalRoomHeader';
import PersonalRoomGrid from './components/PersonalRoomGrid';
import PersonalRoomParticipantCard from './components/PersonalRoomParticipantCard';
import { LoftSettingsModal } from '../LoftRoomPage/components/LoftSettingsModal';
import PersonalRoomTransportBar from './components/PersonalRoomTransportBar';
import PersonalRoomSidebar from './components/PersonalRoomSidebar';
import PersonalRoomAdmissionSidebar from './components/PersonalRoomAdmissionSidebar';
import ScreenShareToolbar from './components/ScreenShareToolbar';
import { clearPersonalGuestAccessState } from './utils/personalRoomGuestStorage';


const DAILY_DOMAIN = (import.meta.env.VITE_DAILY_DOMAIN || 'jobzcafe.daily.co').replace(/^https?:\/\//, '').replace(/\/$/, '');
const DAILY_SINGLETON_KEY = '__personalRoomDailyCallObject';

// 🔥 FIX: Version for localStorage schema - increment when breaking changes occur
const LOFT_STORAGE_VERSION = '3'; // 🔥 Incremented to preserve auth session
const LOFT_VERSION_KEY = 'loft.storageVersion';
const AUDIO_DEVICE_KEY = 'loft.audio.device_id';
const VIDEO_DEVICE_KEY = 'loft.video.device_id';
const SPEAKER_DEVICE_KEY = 'loft.speaker.device_id';

const readStoredDeviceId = (key: string) => {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(key)?.trim() || '';
  } catch {
    return '';
  }
};

const readSessionAvatarUrl = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem('loft.sessionAvatar')?.trim() || undefined;
  } catch {
    return undefined;
  }
};

const readSessionAvatarSeed = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem('loft.sessionAvatarSeed')?.trim() || undefined;
  } catch {
    return undefined;
  }
};

const readStreamDeviceId = (stream: MediaStream, kind: 'audio' | 'video') => {
  const track = kind === 'audio'
    ? stream.getAudioTracks()[0]
    : stream.getVideoTracks()[0];
  return track?.getSettings?.().deviceId || '';
};

const findAvailableDeviceId = (devices: MediaDeviceInfo[], preferredDeviceId?: string) => {
  if (preferredDeviceId && devices.some((device) => device.deviceId === preferredDeviceId)) {
    return preferredDeviceId;
  }

  const nonDefault = devices.find((device) => device.deviceId !== 'default' && device.deviceId !== 'communications');
  return nonDefault?.deviceId || devices[0]?.deviceId || '';
};

const MOCK_SCENARIO_KEY = 'LOFT_MOCK_SCENARIO';
const MOCK_PARTICIPANT_NAMES = [
  'Amelia Chen',
  'Marcus Lee',
  'Priya Shah',
  'Noah Bennett',
  'Sofia Rivera',
  'Ethan Cole',
  'Isla Morgan',
  'Leo Brooks',
  'Maya Singh',
  'Oliver Grant',
  'Ava Thompson',
  'Theo Walker',
  'Nora Hughes',
  'Mila Carter',
  'James Patel',
  'Zoe Martin',
  'Lucas Young',
  'Grace Wilson',
  'Henry Ford',
  'Ella Scott',
  'Jack Turner',
  'Lily Adams',
  'Oscar King',
  'Ruby Hill',
];

const readMockScenario = () => {
  if (typeof window === 'undefined') return 'none';
  try {
    return localStorage.getItem(MOCK_SCENARIO_KEY) || 'none';
  } catch {
    return 'none';
  }
};

const getMockScenarioTargetCount = (scenario: string) => {
  if (scenario === 'mock-4') return 4;
  if (scenario === 'mock-9') return 9;
  if (scenario === 'mock-16') return 16;
  if (scenario === 'mock-20') return 20;
  if (scenario === 'mock-24') return 20;
  return 0;
};

interface PersonalRoomPageProps {
  roomId: string;
  onLeave: (path?: string) => void;
}

interface Participant {
  id: string;
  name: string;
  isLocal: boolean;
  audio: boolean;
  video: boolean;
  avatarUrl?: string;
  videoTrack?: MediaStreamTrack;
  isVideoOn: boolean;
  role: string;
  isOnStage: boolean;
  isHost?: boolean;
  backgroundMode?: 'none' | 'blur' | 'image'; // 🔥 FIX: Track participant's background mode
}

interface JoinTokenResponse {
  token: string;
  dailyRoomName: string;
  roomTitle?: string;
  role?: string;
  isRecorded?: boolean;
  scheduledStartAt?: string;
  hostProfileId?: string;
  members?: any[];
  currentUserProfile?: {
    profileId?: string;
    userId?: string;
    guestId?: string;
    displayName: string;
    avatarUrl?: string;
    isHost: boolean;
  };
  hostDetails?: {
    profileId: string;
    userId: string;
    displayName: string;
    avatarUrl?: string;
    isHost: true;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T,>(promise: Promise<T> | T, ms = 1500): Promise<T | undefined> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<undefined>((resolve) => {
        timeoutId = setTimeout(() => resolve(undefined), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const describeScreenShareError = (error: any) => {
  const name = error?.name || '';
  const message = String(error?.message || error || '');
  const lowerMessage = message.toLowerCase();

  if (name === 'NotAllowedError' || lowerMessage.includes('permission') || lowerMessage.includes('cancel')) {
    return 'Screen sharing was cancelled or blocked by the browser.';
  }
  if (name === 'NotFoundError') {
    return 'No screen, window, or tab was available to share.';
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The selected screen could not be shared. Try choosing a window or browser tab.';
  }
  if (name === 'NotSupportedError') {
    return 'Screen sharing is not supported in this browser window.';
  }

  return 'Screen sharing could not start. Check browser permissions and try again.';
};

const LoftEntryMark = () => (
  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] shadow-lg">
    <img src="/brand/loft-icon-signal-final-light.svg" alt="Loft" className="h-10 w-10 dark:hidden" />
    <img src="/brand/loft-icon-signal-final-dark.svg" alt="Loft" className="hidden h-10 w-10 dark:block" />
  </div>
);

const getDailyScreenTrack = (screenVideo: any): MediaStreamTrack | null => {
  const track = screenVideo?.persistentTrack || screenVideo?.track;
  return track && track.kind === 'video' ? track : null;
};

const normalizeParticipantNameValue = (value: unknown) =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const isDailyScreenVideoActive = (screenVideo: any) => {
  const track = getDailyScreenTrack(screenVideo);
  if (!track || track.readyState === 'ended') return false;
  return screenVideo?.state === 'playable' ||
    screenVideo?.state === 'sendable' ||
    screenVideo?.state === 'loading';
};

const getActiveDailyScreenShare = (participants: Record<string, any> | undefined | null) => {
  const participantValues = Object.values(participants || {});
  for (const participant of participantValues) {
    const screenVideo = participant?.tracks?.screenVideo;
    const track = getDailyScreenTrack(screenVideo);
    if (track && isDailyScreenVideoActive(screenVideo)) {
      return {
        isLocal: !!participant?.local,
        ownerId: participant?.session_id || null,
        track,
      };
    }
  }
  return null;
};

const waitForLocalScreenTrack = async (callObj: DailyCall, maxAttempts = 64) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const localScreenVideo = callObj.participants?.()?.local?.tracks?.screenVideo;
    const track = getDailyScreenTrack(localScreenVideo);
    if (track && isDailyScreenVideoActive(localScreenVideo)) {
      return track;
    }
    await sleep(125);
  }
  return null;
};

const waitForScreenShareTrack = async (callObj: DailyCall, ownerId: string | null, maxAttempts = 64) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const participants = callObj.participants?.() || {};
    const shares = Object.values(participants)
      .map((participant: any) => {
        const screenVideo = participant?.tracks?.screenVideo;
        const track = getDailyScreenTrack(screenVideo);
        return track && isDailyScreenVideoActive(screenVideo)
          ? { ownerId: participant?.session_id || null, track }
          : null;
      })
      .filter(Boolean) as Array<{ ownerId: string | null; track: MediaStreamTrack }>;

    const matchingShare = ownerId
      ? shares.find((share) => share.ownerId === ownerId)
      : shares[0];
    if (matchingShare?.track) return matchingShare.track;
    await sleep(125);
  }
  return null;
};

const parseDailyUserData = (participant: any) => {
  try {
    const rawUserData = participant?.userData ?? participant?.user_data;
    return typeof rawUserData === 'string'
      ? JSON.parse(rawUserData)
      : (rawUserData && typeof rawUserData === 'object' ? rawUserData : null);
  } catch {
    return null;
  }
};

// 🔥 FIX: Structured logging for production debugging
const log = (event: string, data?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    component: 'PersonalRoomPage',
    event,
    ...data
  };
  // In production, send to logging service (Sentry, LogRocket, etc.)
  // For now, use structured console output
  if (typeof window !== 'undefined' && (window as any).__loft_debug) {
    console.log('[Loft]', JSON.stringify(logEntry));
  }
};

const PersonalRoomPage: React.FC<PersonalRoomPageProps> = ({ roomId, onLeave }) => {
  const { profile } = useSupabaseUser();
  
  // Clear any mock scenario that might cause unwanted avatars
  useEffect(() => {
    // console.log('🔥🔥🔥 PersonalRoomPage MOUNTED');
    // Clear background preference on mount to prevent cross-user contamination
    localStorage.removeItem('loft.bg.mode');
    localStorage.removeItem('loft_bg_id');
    setBackgroundMode('none');
    
    return () => {
      // console.log('🔥🔥🔥 PersonalRoomPage UNMOUNTED');
      localStorage.removeItem('personalRoomTitle');
      localStorage.removeItem('personalRoomHostName');
      sessionStorage.removeItem('userExplicitlyJoined');
      // DO NOT clear guestName on unmount otherwise redirects fail!
      // sessionStorage.removeItem('guestName');
      // Clear background preference on unmount
      localStorage.removeItem('loft.bg.mode');
      localStorage.removeItem('loft_bg_id');
    };
  }, []);

  const resolveGuestAutoJoin = () => {
    if (typeof window === 'undefined') return false;
    
    const hostFlag = sessionStorage.getItem('personalRoomIsHost') === 'true';
    const hostTokenFlag = !!sessionStorage.getItem('personalRoomToken');
    const guestFlag = localStorage.getItem('isPersonalRoomGuest') === 'true';
    const approvalFlag = localStorage.getItem('loft_approval_status') === 'approved';
    const guestNameFlag = !!localStorage.getItem('guestName');
    
    console.log('[PersonalRoomPage] resolveGuestAutoJoin check:', {
      hostFlag,
      hostTokenFlag,
      guestFlag,
      approvalFlag,
      guestNameFlag
    });
    
    const shouldAutoJoin = (hostFlag && hostTokenFlag) || (guestFlag && approvalFlag && guestNameFlag);
    console.log('[PersonalRoomPage] shouldAutoJoin:', shouldAutoJoin);
    
    return shouldAutoJoin;
  };

  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [dailyJoined, setDailyJoined] = useState(false);
  const [tokenData, setTokenData] = useState<JoinTokenResponse | null>(null);
  const [joinRequested, setJoinRequested] = useState(() => resolveGuestAutoJoin());

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [activeScreenTrack, setActiveScreenTrack] = useState<MediaStreamTrack | null>(null);
  const [activeScreenOwnerId, setActiveScreenOwnerId] = useState<string | null>(null);
  const [isScreenShareStarting, setIsScreenShareStarting] = useState(false);
  const [screenShareNotice, setScreenShareNotice] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>(() => readStoredDeviceId(AUDIO_DEVICE_KEY));
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>(() => readStoredDeviceId(VIDEO_DEVICE_KEY));
  const [selectedSpeakerDeviceId, setSelectedSpeakerDeviceId] = useState<string>(() => readStoredDeviceId(SPEAKER_DEVICE_KEY));
  const [videoDeviceError, setVideoDeviceError] = useState<string | null>(null);
  const [setupMicLevel, setSetupMicLevel] = useState(0);
  const [backgroundMode, setBackgroundMode] = useState<'none' | 'blur' | 'image'>('none');
  const [blurDisabled, setBlurDisabled] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'auto'>('dark');
  const [hostName, setHostName] = useState<string>('Personal Table');
  const [hostUserData, setHostUserData] = useState<{name: string, avatarUrl?: string} | null>(null);
  const [hostProfileData, setHostProfileData] = useState<{name: string, avatarUrl?: string} | null>(null);
  const [hostDetails, setHostDetails] = useState<{profileId: string, userId: string, displayName: string, avatarUrl?: string} | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'spotlight' | 'sidebar' | 'screenShare'>('grid');
  const [mockScenario, setMockScenario] = useState<string>(() => readMockScenario());
  const [avatarUpdateTrigger, setAvatarUpdateTrigger] = useState(0); // Force avatar updates
  const [isAdmissionSidebarOpen, setIsAdmissionSidebarOpen] = useState(false);
  const [keepAdmissionSidebarOpen, setKeepAdmissionSidebarOpen] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [localSessionId, setLocalSessionId] = useState<string | null>(null);

  const screenShareSupport = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return { supported: false, message: 'Screen sharing is not available in this browser window.' };
    }

    const browserInfo = DailyIframe.supportedBrowser?.();
    const supportsScreenShare = !!browserInfo?.supportsScreenShare && !!navigator.mediaDevices?.getDisplayMedia;
    const mobileBrowser = !!browserInfo?.mobile || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

    if (supportsScreenShare) {
      return { supported: true, message: null };
    }

    return {
      supported: false,
      message: mobileBrowser
        ? 'Screen sharing is not available on this mobile browser. Join from a supported desktop browser to share a window or tab.'
        : 'Screen sharing is not available in this browser window. Use a supported desktop browser and allow screen capture.',
    };
  }, []);

  // Check if user is a superadmin/superuser to enable layout preview data.
  // BOH profiles can hydrate user_type_id as a string from RPC/JSON paths.
  const isSuperUser = !!((profile as any)?.is_loft_admin || Number((profile as any)?.user_type_id) === 5);

  // 🔥 FIX: Check localStorage version and clear stale data from old app versions
  useEffect(() => {
    try {
      const storedVersion = localStorage.getItem(LOFT_VERSION_KEY);
      if (storedVersion !== LOFT_STORAGE_VERSION) {
        console.log('[PersonalRoomPage] Clearing stale localStorage data from old version');

        localStorage.setItem(LOFT_VERSION_KEY, LOFT_STORAGE_VERSION);

        console.log('[PersonalRoomPage] localStorage version updated');
      }
    } catch (error) {
      console.error('[PersonalRoomPage] Failed to check/clear localStorage version:', error);
    }
  }, []);

  const callObjectRef = useRef<DailyCall | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMountedRef = useRef(true);
  const clientInstanceIdRef = useRef<string | null>(null);
  const hasAttemptedJoinRef = useRef(false);
  const isLeavingRef = useRef(false);
  // 🔥 FIX: Add debounce ref for performance
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // 🔥 FIX: Track current user data for merging when updating
  const currentUserDataRef = useRef<Record<string, any>>({});
  const previousLayoutRef = useRef<'grid' | 'spotlight' | 'sidebar' | 'screenShare'>('grid');
  const processedCanvasStreamRef = useRef<MediaStream | null>(null);
  const processedVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const selectedVideoDeviceIdRef = useRef<string>('');
  const selectedAudioDeviceIdRef = useRef<string>('');
  const accessTokenRef = useRef<string | null>(null);
  const localVideoOverrideRef = useRef<boolean | null>(null);
  const isVideoEnabledRef = useRef(isVideoEnabled);
  const activeScreenOwnerIdRef = useRef<string | null>(null);
  const activeScreenTrackRef = useRef<MediaStreamTrack | null>(null);
  const departedParticipantKeysRef = useRef<Set<string>>(new Set());
  const screenShareRecoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 🔥 FIX: Determine if current user is host or guest using storage markers
  const hostFlagStorage = typeof window !== 'undefined' && sessionStorage.getItem('personalRoomIsHost') === 'true';
  const hostTokenStorage = typeof window !== 'undefined' && !!sessionStorage.getItem('personalRoomToken');
  const autoJoinFlag = resolveGuestAutoJoin();
  const isCurrentUserHost = hostFlagStorage && hostTokenStorage;

  useClientInstanceId(clientInstanceIdRef);

  const getCameraDeviceLabel = useCallback((deviceId: string) => {
    const match = videoDevices.find((device) => device.deviceId === deviceId);
    return match?.label?.trim() || 'Selected camera';
  }, [videoDevices]);

  const describeCameraError = useCallback((error: unknown, deviceLabel: string) => {
    const err = error as { name?: string; message?: string };
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
      return `${deviceLabel} is blocked by browser permissions. Allow camera access for this site, then select it again.`;
    }
    if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
      return `${deviceLabel} is not available to this browser window. Check that it is connected and select it again.`;
    }
    if (err?.name === 'NotReadableError' || err?.name === 'AbortError') {
      return `${deviceLabel} is already in use or could not start. Close any other app using it, then select it again.`;
    }
    return `${deviceLabel} could not start. Check the camera connection and select it again.`;
  }, []);

  // Debug function available if needed
  useEffect(() => {
    // Enable debug logging via console: window.__loft_debug = true
    if (typeof window !== 'undefined') {
      (window as any).__loft_debug = (window as any).__loft_debug || false;
    }
  }, []);

  // Log state changes for debugging
  useEffect(() => {
    log('state_change', { 
      dailyJoined, 
      participantCount: participants.length,
      isMicEnabled, 
      isVideoEnabled,
      backgroundMode 
    });
  }, [dailyJoined, participants.length, isMicEnabled, isVideoEnabled, backgroundMode]);

  // 🔥 FIX: DISABLED useLoftMedia - Using Daily's native processor instead
  // The settings modal handles background effects via Daily's updateInputSettings
  // Keeping hook for API compatibility but disabled to prevent canvas pipeline conflicts
  const { stream, isPreviewOn, toggleMedia, startMedia, setPreferredDevices, selectedBgId, setSelectedBgId } = useLoftMedia(videoRef, canvasRef, { enabled: false, callObject });

  // 🔥 FIX: DISABLED - Auto-start useLoftMedia removed
  // Canvas pipeline is disabled in favor of Daily's native processor
  // useEffect(() => {
  //   if (dailyJoined && !isPreviewOn) {
  //     startMedia();
  //   }
  // }, [dailyJoined, isPreviewOn, startMedia]);

  const captureProcessedTrack = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.captureStream) {
      processedCanvasStreamRef.current = null;
      processedVideoTrackRef.current = null;
      return null;
    }

    if (!processedCanvasStreamRef.current || processedCanvasStreamRef.current.getVideoTracks().length === 0) {
      try {
        processedCanvasStreamRef.current = canvas.captureStream(15);
      } catch (error) {
        processedCanvasStreamRef.current = null;
      }
    }

    const track = processedCanvasStreamRef.current?.getVideoTracks()?.[0] || null;
    processedVideoTrackRef.current = track || null;
    return track;
  }, []);

  const ensureBackgroundVideoSource = useCallback(async () => {
    if (backgroundMode === 'none') {
      return;
    }

    // 🔥 FIX: Wait for isPreviewOn === true before applying background to ensure canvas has valid frames
    if (!isPreviewOn) {
      console.log('[PersonalRoomPage] Camera preview not ready yet, skipping background application');
      return;
    }

    const callObj = callObjectRef.current;
    if (!callObj) return;

    const track = captureProcessedTrack();
    if (!track) {
      console.warn('[PersonalRoomPage] No processed track available');
      return;
    }

    try {
      await callObj.setInputDevicesAsync({
        videoSource: track,
        audioDeviceId: selectedAudioDeviceIdRef.current || undefined,
      });
      console.log('[PersonalRoomPage] Applied processed video track with background');
    } catch (error) {
      console.warn('[PersonalRoomPage] Failed to apply processed video track', error);
    }
  }, [backgroundMode, captureProcessedTrack, isPreviewOn]);

  const clearBackgroundVideoSource = useCallback(async () => {
    const callObj = callObjectRef.current;
    if (!callObj) return;

    // 🔥 FIX: Stop the processed track but keep the raw camera stream alive
    processedVideoTrackRef.current?.stop?.();
    processedCanvasStreamRef.current?.getTracks()?.forEach((track) => track.stop());
    processedCanvasStreamRef.current = null;
    processedVideoTrackRef.current = null;

    // 🔥 FIX: Only restore raw camera if we have a valid device ID
    // This prevents Daily from turning off video entirely
    const hasValidVideoDevice = selectedVideoDeviceIdRef.current && selectedVideoDeviceIdRef.current !== '';
    
    try {
      if (hasValidVideoDevice) {
        await callObj.setInputDevicesAsync({
          audioDeviceId: selectedAudioDeviceIdRef.current || undefined,
          videoDeviceId: selectedVideoDeviceIdRef.current,
        });
        console.log('[PersonalRoomPage] Restored raw camera video');
      } else {
        // If no specific device, just toggle video off and on to reset
        const currentVideoState = callObj.localVideo();
        await callObj.setLocalVideo(false);
        await new Promise(r => setTimeout(r, 50));
        await callObj.setLocalVideo(currentVideoState);
        console.log('[PersonalRoomPage] Reset video state');
      }
    } catch (error) {
      console.warn('[PersonalRoomPage] Failed to restore raw camera video', error);
    }
  }, []);

  // 🔥 FIX: DISABLED - Custom canvas background pipeline conflicts with settings modal's Daily native processor
  // The settings modal (LoftSettingsModal) uses Daily's native updateInputSettings with processor config
  // which is more reliable than the custom canvas-based approach. 
  // PersonalRoomPage should NOT try to apply backgrounds - let the settings modal handle it.
  /*
  useEffect(() => {
    if (!dailyJoined) return;

    console.log('[PersonalRoomPage] Background effect check:', { backgroundMode, isPreviewOn, dailyJoined });

    if (backgroundMode === 'blur' || backgroundMode === 'image') {
      // Only apply background if preview is ready
      if (isPreviewOn) {
        console.log('[PersonalRoomPage] Applying background effect:', backgroundMode);
        ensureBackgroundVideoSource();
      } else {
        console.log('[PersonalRoomPage] Camera not ready yet, deferring background application');
      }
    } else {
      console.log('[PersonalRoomPage] Clearing background effect');
      clearBackgroundVideoSource();
    }

    return () => {
      if (backgroundMode === 'none') {
        clearBackgroundVideoSource();
      }
    };
  }, [backgroundMode, dailyJoined, isPreviewOn, ensureBackgroundVideoSource, clearBackgroundVideoSource]);
  */

  useEffect(() => {
    selectedVideoDeviceIdRef.current = selectedVideoDeviceId;
  }, [selectedVideoDeviceId]);

  useEffect(() => {
    selectedAudioDeviceIdRef.current = selectedAudioDeviceId;
  }, [selectedAudioDeviceId]);

  useEffect(() => {
    isVideoEnabledRef.current = isVideoEnabled;
  }, [isVideoEnabled]);

  useEffect(() => {
    activeScreenOwnerIdRef.current = activeScreenOwnerId;
  }, [activeScreenOwnerId]);

  useEffect(() => {
    activeScreenTrackRef.current = activeScreenTrack;
  }, [activeScreenTrack]);

  useEffect(() => {
    if (!selectedVideoDeviceId) return;
    try {
      localStorage.setItem(VIDEO_DEVICE_KEY, selectedVideoDeviceId);
    } catch {
      // Device preferences are best-effort browser settings.
    }
  }, [selectedVideoDeviceId]);

  useEffect(() => {
    if (!selectedAudioDeviceId) return;
    try {
      localStorage.setItem(AUDIO_DEVICE_KEY, selectedAudioDeviceId);
    } catch {
      // Device preferences are best-effort browser settings.
    }
  }, [selectedAudioDeviceId]);

  useEffect(() => {
    if (!selectedSpeakerDeviceId) return;
    try {
      localStorage.setItem(SPEAKER_DEVICE_KEY, selectedSpeakerDeviceId);
    } catch {
      // Device preferences are best-effort browser settings.
    }
  }, [selectedSpeakerDeviceId]);

  useEffect(() => {
    setPreferredDevices({
      videoDeviceId: selectedVideoDeviceId || null,
      audioDeviceId: selectedAudioDeviceId || null,
    });
  }, [selectedVideoDeviceId, selectedAudioDeviceId, setPreferredDevices]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { 
      isMountedRef.current = false; 
      // 🔥 FIX: Clean up processed track on unmount
      processedVideoTrackRef.current?.stop?.();
      processedCanvasStreamRef.current?.getTracks()?.forEach((track) => track.stop());
      processedCanvasStreamRef.current = null;
      processedVideoTrackRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('loft-theme') as 'light' | 'dark' | 'auto';
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'auto')) {
        setThemeMode(savedTheme);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('loft.bg.mode') as 'none' | 'blur' | 'image';
      if (savedMode && (savedMode === 'none' || savedMode === 'blur' || savedMode === 'image')) {
        setBackgroundMode(savedMode);
        // 🔥 FIX: Sync with useLoftMedia
        const bgId = savedMode === 'image' ? 'office' : savedMode;
        setSelectedBgId(bgId);
      }
    } catch {
      // ignore
    }
  }, [setSelectedBgId]);

  // 🔥 FIX: Device enumeration - re-run when dailyJoined changes (after permissions are granted)
  useEffect(() => {
    const enumerateDevices = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
          console.warn('[PersonalRoomPage] enumerateDevices not supported');
          return;
        }

        // 🔥 FIX: Request permissions first to ensure device labels are available
        // This is critical - without permissions, device labels are empty strings
        let permissionAudioDeviceId = '';
        let permissionVideoDeviceId = '';
        try {
          const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          permissionAudioDeviceId = readStreamDeviceId(s, 'audio');
          permissionVideoDeviceId = readStreamDeviceId(s, 'video');
          s.getTracks().forEach((t) => t.stop());
          console.log('[PersonalRoomPage] Device permissions granted');
        } catch (error) {
          console.warn('[PersonalRoomPage] Could not get device permissions:', error);
          // Continue anyway - some devices might still have labels from a previous session
        }

        // Now enumerate devices with labels
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log('[PersonalRoomPage] Enumerated devices:', devices.length, 'total');
        
        // Separate audio input and output devices
        const audioInputDevices = devices.filter(d => d.kind === 'audioinput');
        const audioOutputDevices = devices.filter(d => d.kind === 'audiooutput');
        const videoDevices = devices.filter(d => d.kind === 'videoinput');

        // 🔥 FIX: Combine audio input and output into single array for settings
        const allAudioDevices = [...audioInputDevices, ...audioOutputDevices];
        
        // Remove default/communications entries and deduplicate
        const nonDefaultAudio = allAudioDevices.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications');
        const filteredAudio = nonDefaultAudio.length > 0 ? nonDefaultAudio : allAudioDevices;
        const seen = new Set<string>();
        const dedupedAudio: MediaDeviceInfo[] = [];
        for (const d of filteredAudio) {
          const labelKey = (d.label || '').trim().toLowerCase();
          const key = labelKey ? `${d.groupId || ''}::${labelKey}` : `deviceId::${d.deviceId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          dedupedAudio.push(d);
        }

        const nonDefaultVideo = videoDevices.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications');
        const filteredVideo = nonDefaultVideo.length > 0 ? nonDefaultVideo : videoDevices;
        const seenVideo = new Set<string>();
        const dedupedVideo: MediaDeviceInfo[] = [];
        for (const d of filteredVideo) {
          const labelKey = (d.label || '').trim().toLowerCase();
          const key = labelKey ? `${d.groupId || ''}::${labelKey}` : `deviceId::${d.deviceId}`;
          if (seenVideo.has(key)) continue;
          seenVideo.add(key);
          dedupedVideo.push(d);
        }

        setAudioDevices(dedupedAudio);
        setVideoDevices(dedupedVideo);

        // 🔥 FIX: Set defaults only if not already selected
        if (dedupedAudio.length > 0 && !selectedAudioDeviceId) {
          const defaultAudioDeviceId = findAvailableDeviceId(dedupedAudio, permissionAudioDeviceId);
          if (defaultAudioDeviceId) setSelectedAudioDeviceId(defaultAudioDeviceId);
        }
        if (dedupedVideo.length > 0 && !selectedVideoDeviceId) {
          const defaultVideoDeviceId = findAvailableDeviceId(dedupedVideo, permissionVideoDeviceId);
          if (defaultVideoDeviceId) setSelectedVideoDeviceId(defaultVideoDeviceId);
        }
        if (dedupedAudio.length > 0 && !selectedSpeakerDeviceId) {
          const speakerDevices = dedupedAudio.filter(d => d.kind === 'audiooutput');
          if (speakerDevices.length > 0) {
            setSelectedSpeakerDeviceId(speakerDevices[0].deviceId);
          }
        }

      } catch (error) {
        console.error('[PersonalRoomPage] Failed to enumerate devices:', error);
      }
    };

    enumerateDevices();

    // Listen for device changes
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);
      window.addEventListener('loft:refresh-devices', enumerateDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
        window.removeEventListener('loft:refresh-devices', enumerateDevices);
      };
    }
    // 🔥 FIX: Re-run when dailyJoined changes so we get devices after permissions are granted
  }, [selectedAudioDeviceId, selectedVideoDeviceId, selectedSpeakerDeviceId, joinRequested, isSetupOpen, dailyJoined]);

  // 🔥 TRIGGER DEVICE ENUMERATION WHEN SETTINGS OPEN
  useEffect(() => {
    if (isSetupOpen && audioDevices.length === 0) {
      // Force device enumeration when settings open and no devices found
      const enumerateDevices = async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            return;
          }

          let permissionAudioDeviceId = '';
          let permissionVideoDeviceId = '';

          // Request permissions first to get real device names and honor the browser-selected devices
          try {
            const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            permissionAudioDeviceId = readStreamDeviceId(s, 'audio');
            permissionVideoDeviceId = readStreamDeviceId(s, 'video');
            s.getTracks().forEach((t) => t.stop());
          } catch (error) {
            console.warn('[PersonalRoomPage] Could not refresh device permissions from settings:', error);
          }

          // Now enumerate devices with permissions
          const devices = await navigator.mediaDevices.enumerateDevices();
          
          // Process devices with the same logic as main enumeration
          const rawAudio = devices.filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput');
          const nonDefaultAudio = rawAudio.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications');
          const filteredAudio = nonDefaultAudio.length > 0 ? nonDefaultAudio : rawAudio;
          const seen = new Set<string>();
          const dedupedAudio: MediaDeviceInfo[] = [];
          for (const d of filteredAudio) {
            const labelKey = (d.label || '').trim().toLowerCase();
            const key = labelKey ? `${d.groupId || ''}::${labelKey}` : `deviceId::${d.deviceId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            dedupedAudio.push(d);
          }

          const rawVideo = devices.filter(d => d.kind === 'videoinput');
          const nonDefaultVideo = rawVideo.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications');
          const filteredVideo = nonDefaultVideo.length > 0 ? nonDefaultVideo : rawVideo;
          const seenVideo = new Set<string>();
          const dedupedVideo: MediaDeviceInfo[] = [];
          for (const d of filteredVideo) {
            const labelKey = (d.label || '').trim().toLowerCase();
            const key = labelKey ? `${d.groupId || ''}::${labelKey}` : `deviceId::${d.deviceId}`;
            if (seenVideo.has(key)) continue;
            seenVideo.add(key);
            dedupedVideo.push(d);
          }

          setAudioDevices(dedupedAudio);
          setVideoDevices(dedupedVideo);

          // Set defaults from the actual permission stream first, so the device chosen in the browser picker is honored.
          if (dedupedAudio.length > 0 && !selectedAudioDeviceId) {
            const defaultAudioDeviceId = findAvailableDeviceId(dedupedAudio, permissionAudioDeviceId);
            if (defaultAudioDeviceId) setSelectedAudioDeviceId(defaultAudioDeviceId);
          }
          if (dedupedVideo.length > 0 && !selectedVideoDeviceId) {
            const defaultVideoDeviceId = findAvailableDeviceId(dedupedVideo, permissionVideoDeviceId);
            if (defaultVideoDeviceId) setSelectedVideoDeviceId(defaultVideoDeviceId);
          }
          if (dedupedAudio.length > 0 && !selectedSpeakerDeviceId) {
            const speakerDevices = dedupedAudio.filter(d => d.kind === 'audiooutput');
            if (speakerDevices.length > 0) {
              setSelectedSpeakerDeviceId(speakerDevices[0].deviceId);
            }
          }

        } catch (error) {
          // Failed to enumerate devices
        }
      };

      enumerateDevices();
    }
  }, [isSetupOpen, audioDevices.length, selectedAudioDeviceId, selectedVideoDeviceId, selectedSpeakerDeviceId]);

  // Mic level monitoring for settings modal
  useEffect(() => {
    if (!isSetupOpen) {
      setSetupMicLevel(0);
      return;
    }
    
    // Create a temporary stream for mic level monitoring when settings are open
    const createMicLevelStream = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) return;
        
        const audioConstraints: MediaTrackConstraints = selectedAudioDeviceId
          ? ({ deviceId: { exact: selectedAudioDeviceId } } as any)
          : ({} as any);

        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
        
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;

        const src = ctx.createMediaStreamSource(tempStream);
        src.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        let raf = 0;
        let ema = 0;

        const tick = () => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length;
          
          const normalized = Math.max(0, (avg / 255) * 2.0);
          ema = ema * 0.7 + normalized * 0.3;
          
          setSetupMicLevel(ema);
          
          raf = requestAnimationFrame(tick);
        };
        tick();

        return () => {
          if (raf) cancelAnimationFrame(raf);
          try { src.disconnect(); } catch { }
          try { analyser.disconnect(); } catch { }
          try { ctx.close(); } catch { }
          try { tempStream.getTracks().forEach(track => track.stop()); } catch { }
        };
      } catch (error) {
        setSetupMicLevel(0);
      }
    };

    let cleanup: (() => void) | null = null;
    createMicLevelStream().then(cleanupFn => {
      cleanup = cleanupFn;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [isSetupOpen, selectedAudioDeviceId]);

  // 🔥 FIX: Apply audio device to Daily.js call when selection changes
  useEffect(() => {
    const callObj = callObjectRef.current;
    if (!callObj || !selectedAudioDeviceId || !dailyJoined) return;

    const applyAudioDevice = async () => {
      try {
        console.log('[PersonalRoomPage] Applying audio device:', selectedAudioDeviceId);
        await callObj.setInputDevicesAsync({
          audioDeviceId: selectedAudioDeviceId,
        });
      } catch (error) {
        console.error('[PersonalRoomPage] Failed to apply audio device:', error);
      }
    };

    applyAudioDevice();
  }, [selectedAudioDeviceId, dailyJoined]);

  const { leaveMeeting } = useDailyControls(callObject);

  const createCallObject = useCallback(() => {
    const existing = (typeof window !== 'undefined' ? (window as any)[DAILY_SINGLETON_KEY] : null);
    if (existing) {
      try {
        const state = typeof existing.meetingState === 'function' ? existing.meetingState() : null;
        if (state === 'joined-meeting' || state === 'joining-meeting') {
          try { existing.leave(); } catch { }
        }
      } catch {
        try { existing.destroy(); } catch { }
        if (typeof window !== 'undefined') {
          delete (window as any)[DAILY_SINGLETON_KEY];
        }
      }
      return existing;
    }
    
    try {
      const callObj = DailyIframe.createCallObject({
        useLegacyVideoProcessor: true,
        // 🔥 FIX: Add performance optimizations
        dailyConfig: {
          camSimulcastEncodings: [
            { maxBitrate: 150000, scaleResolutionDownBy: 4 }, // Low
            { maxBitrate: 500000, scaleResolutionDownBy: 2 }, // Medium
            { maxBitrate: 1200000, scaleResolutionDownBy: 1 }, // High
          ],
        } as any,
      } as any);
      
      // 🔥 FIX: Optimize bandwidth and quality for 5+ participants
      callObj.on('participant-counts-updated', (event: any) => {
        const participantCount = event.participantCounts.present;
        
        if (participantCount >= 5) {
          // Aggressive bandwidth limit for 5+ participants to prevent audio/video degradation
          callObj.setBandwidth({
            kbs: 600, // Reduced to prioritize audio quality
          } as any);
        } else if (participantCount >= 3) {
          // Moderate optimization for 3-4 participants
          callObj.setBandwidth({
            kbs: 1000,
          } as any);
        } else {
          // Full quality for 1-2 participants
          callObj.setBandwidth({
            kbs: 2500,
          } as any);
        }
      });
      
      if (typeof window !== 'undefined') (window as any)[DAILY_SINGLETON_KEY] = callObj;
      
      // Also store reference for participant cards
      if (typeof window !== 'undefined') {
        (window as any).__personalRoomDailyCallObject = callObj;
      }
      
      return callObj;
    } catch (e: any) {
      const maybeExisting = (typeof window !== 'undefined' ? (window as any)[DAILY_SINGLETON_KEY] : null);
      if (maybeExisting) return maybeExisting;
      throw e;
    }
  }, []);

  const syncDailyParticipants = useCallback(async () => {
    const callObj = callObjectRef.current;
    if (!callObj) return;

    let dailyParts: Record<string, any> = {};
    try {
      dailyParts = callObj.participants?.() || {};
    } catch {
      dailyParts = {};
    }

    const partsValues = Object.values(dailyParts || {}).filter((p: any) => p && (p.session_id || p.local));
    const localParticipantData = partsValues.find((p: any) => p?.local);
    if (localParticipantData?.session_id) {
      setLocalSessionId(localParticipantData.session_id);
    }

    // 🔥 FIX: Build waitlist background modes map before mapping participants
    let waitlistBackgroundModes: Record<string, string> = {};
    if (roomId && isCurrentUserHost) {
      try {
        const waitlistResponse = await callEdgeFunction<{ waitlist: any[] }>('get_personal_room_waitlist', {
          personalRoomId: roomId
        });
        
        if (waitlistResponse?.waitlist) {
          waitlistResponse.waitlist.forEach((entry: any) => {
            if (entry.guestName) {
              waitlistBackgroundModes[entry.guestName] = entry.backgroundMode || 'none';
            }
          });
        }
      } catch (error) {
        // Silently fail - background modes are optional
      }
    }

    const hostDisplayNames = new Set(
      [
        hostDetails?.displayName,
        isCurrentUserHost ? hostUserData?.name : null,
        isCurrentUserHost ? hostProfileData?.name : null,
      ]
        .map(normalizeParticipantNameValue)
        .filter(Boolean)
    );

    const mappedRaw: Participant[] = partsValues.map((p: any) => {
      const isLocalParticipant = p.local;
      const videoTrack = p?.tracks?.video?.track || p?.tracks?.video?.persistentTrack;
      const videoState = p?.tracks?.video?.state;
      const audioState = p?.tracks?.audio?.state;
      const audioMuted = p?.tracks?.audio?.muted;
      const videoMuted = p?.tracks?.video?.muted;

      const actualAudio = (audioState === 'sendable' || audioState === 'playable') && !audioMuted;
      const actualVideoFromDaily = (videoState === 'sendable' || videoState === 'playable') && !videoMuted;
      const actualVideo = isLocalParticipant && localVideoOverrideRef.current !== null
        ? localVideoOverrideRef.current
        : actualVideoFromDaily;

      const userData = parseDailyUserData(p);

      const profileId = userData?.profileId || userData?.profile_id;
      const userId = userData?.userId || userData?.user_id || p.user_id;
      const isHost = !!(
        userData?.isHost === true ||
        (hostDetails?.userId && userId === hostDetails.userId) ||
        (hostDetails?.profileId && profileId === hostDetails.profileId)
      );

      const displayName = isHost 
        ? (hostDetails?.displayName || userData?.displayName || p.user_name || 'Host')
        : (userData?.displayName || p.user_name || 'Guest');
      
      let sessionAvatarUrl: string | undefined;
      if (isLocalParticipant) {
        try {
          const sessionAvatar = localStorage.getItem('loft.sessionAvatar');
          if (sessionAvatar) {
            sessionAvatarUrl = sessionAvatar.trim() || undefined;
          }
        } catch (error) {
          // Failed to read session avatar
        }
      }

      let avatarUrl = sessionAvatarUrl || userData?.avatarUrl || (isHost ? hostDetails?.avatarUrl : null);

      // 🔥 FIX: Get background mode from waitlist table (persistent source of truth)
      const backgroundMode = waitlistBackgroundModes[displayName] || userData?.backgroundMode || 'none';

      return {
        id: isLocalParticipant ? 'local' : (p.session_id || String(p.user_id || Math.random())),
        name: displayName,
        isLocal: isLocalParticipant,
        audio: actualAudio, // 🔥 FIX: Use actual state
        video: actualVideo, // 🔥 FIX: Use actual state  
        avatarUrl: avatarUrl,
        videoTrack: actualVideo ? videoTrack : undefined,
        isVideoOn: actualVideo, // 🔥 FIX: Use actual state
        role: isHost ? 'Host' : ' ',
        isOnStage: true,
        isHost: isHost,
        backgroundMode: backgroundMode,
      };
    });

    const mapped: Participant[] = [];
    const seenHostNames = new Set<string>();
    mappedRaw.forEach((participant) => {
      const normalizedName = normalizeParticipantNameValue(participant.name);
      const isKnownHostName = normalizedName && hostDisplayNames.has(normalizedName);
      const isHostParticipant = participant.isHost || isKnownHostName;

      if (!isHostParticipant) {
        mapped.push(participant);
        return;
      }

      const hostKey = normalizedName || 'host';
      const existingIndex = mapped.findIndex((existing) => {
        const existingName = normalizeParticipantNameValue(existing.name);
        return existing.isHost || (existingName && hostDisplayNames.has(existingName));
      });

      if (existingIndex === -1) {
        mapped.push({ ...participant, isHost: true, role: 'Host' });
        seenHostNames.add(hostKey);
        return;
      }

      const existing = mapped[existingIndex];
      const shouldPreferCurrent =
        (participant.isLocal && !existing.isLocal) ||
        (participant.isHost && !existing.isHost) ||
        ((participant.video || participant.audio) && !existing.video && !existing.audio);

      if (shouldPreferCurrent && !seenHostNames.has(`${hostKey}:locked`)) {
        mapped[existingIndex] = { ...participant, isHost: true, role: 'Host' };
      }
      seenHostNames.add(hostKey);
    });

    let finalParticipants = [...mapped];

    const previewTargetCount = isSuperUser ? getMockScenarioTargetCount(mockScenario) : 0;

    if (previewTargetCount > 0) {
      finalParticipants = finalParticipants.slice(0, previewTargetCount);
      const targetCount = previewTargetCount;
      const mockCount = Math.max(0, targetCount - finalParticipants.length);
      if (mockCount > 0) {
        const mockParticipants: Participant[] = MOCK_PARTICIPANT_NAMES.slice(0, mockCount).map((name, index) => ({
          id: `mock-participant-${index + 1}`,
          name,
          isLocal: false,
          audio: index === 1,
          video: false,
          avatarUrl: undefined,
          videoTrack: undefined,
          isVideoOn: false,
          role: 'Guest',
          isOnStage: true,
          backgroundMode: 'none',
          isHost: false,
        }));
        finalParticipants = [...finalParticipants, ...mockParticipants];
      }
    }

    // **ADD WAITLIST PARTICIPANTS**
    if (roomId && isCurrentUserHost && previewTargetCount === 0) {
      try {
        const waitlistResponse = await callEdgeFunction<{ waitlist: any[] }>('get_personal_room_waitlist', {
          personalRoomId: roomId
        });
        
        if (waitlistResponse?.waitlist) {
          const videoCallNames = new Set(finalParticipants.map(p => normalizeParticipantNameValue(p.name)));
          const departedParticipantKeys = departedParticipantKeysRef.current;
          
          const waitlistParticipants = waitlistResponse.waitlist
            .filter((entry: any) => entry.status === 'approved')
            .filter((entry: any) => {
              const guestName = normalizeParticipantNameValue(entry.guestName);
              return guestName && !departedParticipantKeys.has(guestName) && !videoCallNames.has(guestName) && !hostDisplayNames.has(guestName);
            })
            .map((entry: any) => ({
              id: `waitlist-${entry.id}`,
              name: entry.guestName,
              isLocal: false,
              audio: false,
              video: false,
              avatarUrl: null,
              videoTrack: undefined,
              isVideoOn: false,
              role: 'Guest',
              isOnStage: false,
              backgroundMode: entry.backgroundMode || 'none', // 🔥 FIX: Use background mode from waitlist table
              isHost: false,
            }));
          
          // Add waitlist participants who are NOT already in the video call
          finalParticipants = [...finalParticipants, ...waitlistParticipants];
        }
      } catch (error) {
        // Failed to fetch waitlist
      }
    }

    // 🔥 FIX: Only skip updates when core fields truly match
    // Include backgroundMode and avatarUrl so visual changes propagate without forcing layout switches
    setParticipants(prev => {
      const hasChanged = prev.length !== finalParticipants.length || 
        prev.some((p, i) => {
          const newP = finalParticipants[i];
          return !newP || 
            p.id !== newP.id ||
            p.name !== newP.name ||
            p.role !== newP.role ||
            p.isLocal !== newP.isLocal ||
            p.isHost !== newP.isHost ||
            p.audio !== newP.audio || 
            p.video !== newP.video ||
            p.isVideoOn !== newP.isVideoOn ||
            p.videoTrack !== newP.videoTrack ||
            p.backgroundMode !== newP.backgroundMode ||
            p.avatarUrl !== newP.avatarUrl;
        });
      
      return hasChanged ? finalParticipants : prev;
    });

    // Handle screen share tracks. If two people start at nearly the same time,
    // keep the first visible owner instead of jumping between tracks.
    const screenShares: Array<{ ownerId: string | null; track: MediaStreamTrack }> = [];
    partsValues.forEach((p: any) => {
      const screenVideo = p?.tracks?.screenVideo;
      const track = getDailyScreenTrack(screenVideo);
      if (track && isDailyScreenVideoActive(screenVideo)) {
        screenShares.push({ ownerId: p.session_id || null, track });
      }
    });

    const currentOwnerId = activeScreenOwnerIdRef.current;
    const selectedScreenShare = (currentOwnerId
      ? screenShares.find((share) => share.ownerId === currentOwnerId)
      : null) || screenShares[0] || null;

    setActiveScreenTrack(selectedScreenShare?.track || null);
    setActiveScreenOwnerId(selectedScreenShare?.ownerId || null);
    if (selectedScreenShare) {
      setLayoutMode((current) => {
        if (current !== 'screenShare') {
          previousLayoutRef.current = current;
        }
        return 'screenShare';
      });
    } else {
      setLayoutMode((current) => current === 'screenShare' ? previousLayoutRef.current : current);
    }
  }, [hostDetails, hostUserData, hostProfileData, profile, avatarUpdateTrigger, mockScenario, roomId, isCurrentUserHost, isSuperUser]);

  useEffect(() => {
    const callObj = callObjectRef.current;
    if (!callObj || !selectedVideoDeviceId || !dailyJoined) return;

    const applyVideoDevice = async () => {
      const deviceLabel = getCameraDeviceLabel(selectedVideoDeviceId);
      try {
        console.log('[PersonalRoomPage] Applying video device:', selectedVideoDeviceId);
        const requestedVideoState = localVideoOverrideRef.current ?? isVideoEnabledRef.current;
        await callObj.setInputDevicesAsync({
          videoDeviceId: selectedVideoDeviceId,
        });
        const actualVideoAfterDeviceChange = callObj.localVideo();
        if (requestedVideoState && !actualVideoAfterDeviceChange) {
          await callObj.setLocalVideo(true);
        } else if (!requestedVideoState && actualVideoAfterDeviceChange) {
          await callObj.setLocalVideo(false);
        }
        setVideoDeviceError(null);
        setIsVideoEnabled(localVideoOverrideRef.current ?? callObj.localVideo());
        syncDailyParticipants();
      } catch (error) {
        console.error('[PersonalRoomPage] Failed to apply video device:', error);
        setVideoDeviceError(describeCameraError(error, deviceLabel));
        setIsVideoEnabled(localVideoOverrideRef.current ?? callObj.localVideo());
        syncDailyParticipants();
      }
    };

    applyVideoDevice();
  }, [
    selectedVideoDeviceId,
    dailyJoined,
    syncDailyParticipants,
    getCameraDeviceLabel,
    describeCameraError,
  ]);

  const syncRemoteAudio = useCallback(() => {
    const call = callObjectRef.current;
    const el = remoteAudioRef.current;
    if (!call || !el) return;

    const parts = (call.participants?.() as any) || {};
    const localSessionId = parts?.local?.session_id;

    const playableTracks = Object.values(parts)
      .filter((p: any) => p && p.session_id && p.session_id !== localSessionId)
      .map((p: any) => p?.tracks?.audio)
      .filter((a: any) => a && a.state === 'playable' && a.track)
      .map((a: any) => a.track);

    if (playableTracks.length === 0) {
      if (el.srcObject) el.srcObject = null;
      return;
    }

    const stream = new MediaStream(playableTracks);
    el.srcObject = stream;
    el.play().catch(() => {});
  }, []);

  const sendGuestToThanks = useCallback(async (message = 'The host ended this session.') => {
    setScreenShareNotice(message);
    const callObj = callObjectRef.current;
    if (callObj) {
      try { await callObj.setLocalVideo(false); } catch { }
      try { await callObj.setLocalAudio(false); } catch { }
      try { await Promise.resolve(callObj.leave()); } catch { }
      try { await callObj.destroy(); } catch { }
    }
    callObjectRef.current = null;
    if (typeof window !== 'undefined') {
      delete (window as any)[DAILY_SINGLETON_KEY];
      delete (window as any).__personalRoomDailyCallObject;
    }
    clearPersonalGuestAccessState();
    onLeave('/thanks');
  }, [onLeave]);

  const dailyHandlers = useMemo(() => ({
    onJoinedMeeting: () => {
      setDailyJoined(true);
      syncDailyParticipants();
    },
    onParticipantJoined: (event: any) => {
      const participant = event?.participant;
      if (participant?.session_id) {
        departedParticipantKeysRef.current.delete(participant.session_id);
      }
      const participantName = normalizeParticipantNameValue(participant?.user_name);
      if (participantName) {
        departedParticipantKeysRef.current.delete(participantName);
      }
      syncDailyParticipants();
      syncRemoteAudio();
    },
    onParticipantUpdated: (event: any) => {
      
      // 🔥 FIX: Sync local participant's mic/video state from Daily
      // This ensures UI state stays in sync even after reconnects or OS-level mutes
      const isLocalParticipant = event?.participant?.local;
      if (isLocalParticipant && callObjectRef.current) {
        const actualAudio = callObjectRef.current.localAudio();
        const actualVideo = localVideoOverrideRef.current ?? callObjectRef.current.localVideo();
        
        // Only update if state has drifted
        if (actualAudio !== isMicEnabled) {
          setIsMicEnabled(actualAudio);
        }
        if (actualVideo !== isVideoEnabled) {
          setIsVideoEnabled(actualVideo);
        }
      }
      
      // 🔥 FIX: For remote participants, sync immediately to capture background mode changes
      // For local participants, debounce to avoid excessive re-renders
      if (isLocalParticipant) {
        if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
        syncDebounceRef.current = setTimeout(() => {
          syncDailyParticipants();
        }, 50);
      } else {
        // 🔥 FIX: Sync remote participant updates immediately for real-time background mode changes
        syncDailyParticipants();
      }
      syncRemoteAudio();
    },
    onParticipantLeft: (event: any) => {
      const departedSessionId = event?.participant?.session_id || null;
      const departedName = normalizeParticipantNameValue(event?.participant?.user_name);

      if (departedSessionId) departedParticipantKeysRef.current.add(departedSessionId);
      if (departedName) departedParticipantKeysRef.current.add(departedName);

      setParticipants((current) => current.filter((participant) => {
        const participantNameKey = normalizeParticipantNameValue(participant.name);
        return !(
          (departedSessionId && participant.id === departedSessionId) ||
          (departedName && participantNameKey === departedName)
        );
      }));

      // 🔥 FIX: Remove participant from waitlist when they leave
      const participantName = event?.participant?.user_name;
      if (participantName && roomId) {
        const removeFromWaitlist = async () => {
          try {
            await callEdgeFunction('update_guest_leave_status', {
              loftRoomId: roomId,
              guestName: participantName,
            });
          } catch (error) {
          }
        };
        removeFromWaitlist();
      }
      
      syncDailyParticipants();
      window.setTimeout(() => syncDailyParticipants(), 500);
      window.setTimeout(() => syncDailyParticipants(), 1500);
      syncRemoteAudio();
    },
    onTrackStarted: (ev: any) => {
      const isLocal = !!ev?.participant?.local;
      
      if (isLocal) {
        // 🔥 FIX: Immediate sync for local changes
        setTimeout(() => {
          const callObj = callObjectRef.current;
          if (callObj) {
            setIsMicEnabled(callObj.localAudio());
            setIsVideoEnabled(localVideoOverrideRef.current ?? callObj.localVideo());
          }
          syncDailyParticipants();
        }, 0);
      } else {
        // 🔥 FIX: Debounced sync for remote changes
        if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
        syncDebounceRef.current = setTimeout(() => {
          syncDailyParticipants();
        }, 100);
      }
      
      if (!isLocal && ev?.track?.kind === 'audio') {
        syncRemoteAudio();
      }
    },
    onTrackStopped: (ev: any) => {
      const isLocal = !!ev?.participant?.local;
      
      if (isLocal) {
        setTimeout(() => {
          const callObj = callObjectRef.current;
          if (callObj) {
            setIsMicEnabled(callObj.localAudio());
            setIsVideoEnabled(localVideoOverrideRef.current ?? callObj.localVideo());
          }
          syncDailyParticipants();
        }, 0);
      } else {
        if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
        syncDebounceRef.current = setTimeout(() => {
          syncDailyParticipants();
        }, 100);
      }
      
      syncRemoteAudio();
    },
    onLocalScreenShareStarted: () => {
      const participants = callObjectRef.current?.participants?.();
      const localParticipant = participants?.local;
      const localSession = localParticipant?.session_id || localSessionId;
      const localScreenVideo = localParticipant?.tracks?.screenVideo;
      const localScreenTrack = getDailyScreenTrack(localScreenVideo);
      setActiveScreenOwnerId(localSession || null);
      if (localScreenTrack && isDailyScreenVideoActive(localScreenVideo)) {
        setActiveScreenTrack(localScreenTrack);
        setLayoutMode((current) => {
          if (current !== 'screenShare') {
            previousLayoutRef.current = current;
          }
          return 'screenShare';
        });
      } else if (callObjectRef.current) {
        const callObj = callObjectRef.current;
        void waitForScreenShareTrack(callObj, localSession || null).then((track) => {
          if (!track) return;
          setActiveScreenTrack(track);
          setLayoutMode((current) => {
            if (current !== 'screenShare') {
              previousLayoutRef.current = current;
            }
            return 'screenShare';
          });
          setScreenShareNotice('Screen sharing is live in the table.');
        });
      }
      setIsScreenShareStarting(false);
      setScreenShareNotice('You are sharing. Use the browser controls or Stop sharing when you are done.');
      syncDailyParticipants();
    },
    onLocalScreenShareStopped: () => {
      setActiveScreenTrack(null);
      setActiveScreenOwnerId(null);
      setIsScreenShareStarting(false);
      setScreenShareNotice(null);
      syncDailyParticipants();
    },
    onLocalScreenShareCanceled: () => {
      setIsScreenShareStarting(false);
      setScreenShareNotice('Screen sharing was cancelled.');
      syncDailyParticipants();
    },
    onScreenShareStarted: (ev: any) => {
      const participant = ev?.participant;
      const ownerId = participant?.session_id || null;
      const screenVideo = participant?.tracks?.screenVideo;
      const track = getDailyScreenTrack(screenVideo);
      const currentOwnerId = activeScreenOwnerIdRef.current;

      if (currentOwnerId && ownerId && currentOwnerId !== ownerId) {
        setScreenShareNotice('Another participant tried to share while a screen was already live.');
        syncDailyParticipants();
        return;
      }

      const showScreenShare = (screenTrack: MediaStreamTrack) => {
        setActiveScreenTrack(screenTrack);
        setActiveScreenOwnerId(ownerId);
        setIsScreenShareStarting(false);
        setLayoutMode((current) => {
          if (current !== 'screenShare') {
            previousLayoutRef.current = current;
          }
          return 'screenShare';
        });
        setScreenShareNotice(participant?.local ? 'Screen sharing is live in the table.' : 'A participant is sharing their screen.');
      };

      if (track && isDailyScreenVideoActive(screenVideo)) {
        showScreenShare(track);
      } else if (callObjectRef.current) {
        const callObj = callObjectRef.current;
        void waitForScreenShareTrack(callObj, ownerId).then((screenTrack) => {
          if (screenTrack) showScreenShare(screenTrack);
        });
      }
      syncDailyParticipants();
    },
    onScreenShareStopped: (ev: any) => {
      syncDailyParticipants();
    },
    onRecordingStarted: () => {
      setIsRecording(true);
    },
    onRecordingStopped: () => {
      setIsRecording(false);
    },
    onAppMessage: async (event: any) => {
      if (isCurrentUserHost) return;

      const messageType = event?.data?.type;
      if (messageType !== 'host_mute_all_audio' && messageType !== 'room_ended') return;

      const callObj = callObjectRef.current;
      if (!callObj) return;

      const participants = callObj.participants?.() || {};
      const senderSessionId = event?.fromId || event?.from_id || event?.participant?.session_id;
      const sender = senderSessionId ? participants?.[senderSessionId] : event?.participant;
      const senderUserData = parseDailyUserData(sender);
      const senderIsHost = !!(
        senderUserData?.isHost === true ||
        (hostDetails?.userId && sender?.user_id === hostDetails.userId) ||
        (hostDetails?.profileId && (senderUserData?.profileId || senderUserData?.profile_id) === hostDetails.profileId)
      );
      if (!senderIsHost) return;

      if (messageType === 'room_ended') {
        await sendGuestToThanks('The host ended this session.');
        return;
      }

      try {
        await callObj.setLocalAudio(false);
        setIsMicEnabled(false);
        setParticipants((current) => current.map((participant) => (
          participant.isLocal ? { ...participant, audio: false } : participant
        )));
        setScreenShareNotice('The host muted all microphones.');
        syncDailyParticipants();
      } catch {
        setScreenShareNotice('The host asked everyone to mute, but your microphone could not be muted automatically.');
      }
    },
    // 🔥 FIX: Add error handlers
    onNonfatalError: (ev: any) => {
      // Nonfatal error occurred
    },
    onCameraError: (ev: any) => {
      // Camera error occurred
    },
    onMicrophoneError: (ev: any) => {
      // Microphone error occurred
    },
  }), [
    hostDetails?.userId,
    hostDetails?.profileId,
    isCurrentUserHost,
    localSessionId,
    sendGuestToThanks,
    syncDailyParticipants,
    syncRemoteAudio,
  ]);

  useDailyEventBindings(callObject, dailyHandlers);

  useEffect(() => {
    if (!dailyJoined || isCurrentUserHost) return;
    const slug = typeof window !== 'undefined' ? localStorage.getItem('personalRoomSlug') : null;
    if (!slug) return;

    let stopped = false;
    const checkHostSession = async () => {
      try {
        const response = await callEdgeFunction<{ isOpen?: boolean }>('get_personal_room_by_slug', { slug });
        if (!stopped && response?.isOpen === false) {
          await sendGuestToThanks('The host ended this session.');
        }
      } catch (error) {
        console.error('[PersonalRoomPage] Could not verify personal table status:', error);
      }
    };

    const interval = window.setInterval(checkHostSession, 5000);
    checkHostSession();
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [dailyJoined, isCurrentUserHost, sendGuestToThanks]);

  // 🔥 FIX: Auto-switch to dedicated screenShare layout when sharing starts
  useEffect(() => {
    if (activeScreenTrack) {
      setLayoutMode((current) => {
        if (current !== 'screenShare') {
          if (current === 'grid' || current === 'spotlight' || current === 'sidebar') {
            previousLayoutRef.current = current;
          }
          return 'screenShare';
        }
        return current;
      });
    } else {
      setLayoutMode((current) => {
        if (current === 'screenShare') {
          return previousLayoutRef.current || 'grid';
        }
        return current;
      });
    }
  }, [activeScreenTrack]);

  useEffect(() => {
    const hostTokenString = sessionStorage.getItem('personalRoomToken');
    const isHost = sessionStorage.getItem('personalRoomIsHost') === 'true' && !!hostTokenString;
    const guestTokenString = localStorage.getItem('personalRoomToken');
    const guestName = localStorage.getItem('guestName');
    const isGuest = !isHost && !!(guestTokenString && guestName);
    
    if (!isGuest) {
      // ONLY clear these if we're certain we aren't mid-guest-join. 
      // It's safer not to indiscriminately wipe sessionStorage here on mount.
      // sessionStorage.removeItem('personalRoomToken');
      // sessionStorage.removeItem('guestName');
    }
    
    setIsAuthenticated(!isGuest);
  }, []);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const hostTokenString = sessionStorage.getItem('personalRoomToken');
        const storedTokenString = localStorage.getItem('personalRoomToken');
        const storedGuestName = localStorage.getItem('guestName');
        const storedGuestFlag = localStorage.getItem('isPersonalRoomGuest') === 'true';
        const hasGuestToken = !!(storedTokenString && storedGuestName && storedGuestFlag);
        const isHost = sessionStorage.getItem('personalRoomIsHost') === 'true' && !!hostTokenString;
        
        if (hostTokenString && isHost) {
          try {
            // Do not trust an existing host token as the source of truth. A token
            // can survive in sessionStorage after the external Daily room has
            // been deleted/recreated by an account or domain/API-key change.
            // Continue to loft-join-token below; the Edge Function reconciles
            // Daily room existence before issuing a fresh token.
            JSON.parse(hostTokenString);
          } catch (err) {
              }
        }
        
        // Guest token logic (existing)
        if (hasGuestToken) {
          try {
            const guestTokenData = JSON.parse(storedTokenString);
            setTokenData(guestTokenData);
            
            setHostUserData({ 
              name: storedGuestName,
              avatarUrl: undefined
            });
            
            if (guestTokenData.hostDetails) {
              setHostDetails(guestTokenData.hostDetails);
            }
            
            return;
          } catch (err) {
              }
        }

        const data = await callEdgeFunction<JoinTokenResponse>('loft-join-token', { 
          loftRoomId: roomId,
        });
        
        setTokenData(data);
        
        if (data.currentUserProfile) {
          setHostName('Personal Table');
          setHostUserData({ 
            name: data.currentUserProfile.displayName,
            avatarUrl: data.currentUserProfile.avatarUrl
          });
          
          if (data.hostDetails) {
            setHostDetails(data.hostDetails);
          }
          
          try {
            localStorage.setItem('loft.userName', data.currentUserProfile.displayName);
            if (data.currentUserProfile.avatarUrl) {
              localStorage.setItem('loft.userAvatar', data.currentUserProfile.avatarUrl);
            }
          } catch (error) {
              }
        } else {
          // Use current authenticated user's profile instead of localStorage
          const userName = profile?.name || localStorage.getItem('loft.userName') || 'Host';
          const avatarUrl = profile?.avatarUrl || localStorage.getItem('loft.userAvatar') || undefined;
          
          setHostName('Personal Table');
          setHostUserData({ 
            name: userName,
            avatarUrl: avatarUrl
          });
        }
        
      } catch (err: any) {
        const errorMessage = err?.message || err?.name || 'Failed to get room token';
        console.error('[PersonalRoomPage] Failed to get room token:', errorMessage, err);
        setJoinError(`Failed to get room token: ${errorMessage}`);
      }
    };
    
    fetchToken();
  }, [roomId]);

  useEffect(() => {
    if (!joinRequested || !tokenData?.token) return;
    if (hasAttemptedJoinRef.current) return;
    hasAttemptedJoinRef.current = true;

    const dailyRoomUrl = (() => {
      const roomName = (tokenData?.dailyRoomName || '').trim();
      if (!roomName) return null;
      if (roomName.startsWith('http')) return roomName;
      return `https://${DAILY_DOMAIN}/${roomName.replace(/^\/+/, '')}`;
    })();

    if (!dailyRoomUrl) {
      setJoinError('Invalid room configuration');
      return;
    }

    const joinRoom = async () => {
      log('join_attempt', { roomId, isHost: isCurrentUserHost, isAuthenticated });
      try {
        let callObj = callObjectRef.current;
        if (!callObj) {
          callObj = createCallObject();
          callObjectRef.current = callObj;
          setCallObject(callObj);
        }

        const guestDisplayName =
          localStorage.getItem('guestName') ||
          tokenData.currentUserProfile?.displayName ||
          'Guest';
        const displayName = isCurrentUserHost
          ? (hostUserData?.name || tokenData.currentUserProfile?.displayName || 'Host')
          : guestDisplayName;

        log('join_daily', { dailyRoomUrl: dailyRoomUrl.replace(/\/\/[^/]+/, '//***'), displayName });
        await callObj.join({
          url: dailyRoomUrl,
          token: tokenData.token,
          userName: displayName,
        });
        log('join_success', { roomId });
        setDailyJoined(true);

        if (tokenData.currentUserProfile) {
          let sessionAvatarUrl: string | undefined;
          let sessionAvatarSeed: string | undefined;
          try {
            sessionAvatarUrl = localStorage.getItem('loft.sessionAvatar')?.trim() || undefined;
            sessionAvatarSeed = localStorage.getItem('loft.sessionAvatarSeed')?.trim() || undefined;
          } catch {
            sessionAvatarUrl = undefined;
            sessionAvatarSeed = undefined;
          }

          const userData = {
            profileId: isCurrentUserHost ? tokenData.currentUserProfile.profileId : undefined,
            userId: isCurrentUserHost ? tokenData.currentUserProfile.userId : undefined,
            displayName,
            avatarUrl: sessionAvatarUrl || (!isCurrentUserHost ? undefined : tokenData.currentUserProfile.avatarUrl),
            avatarSeed: sessionAvatarSeed,
            avatarUpdatedAt: sessionAvatarUrl ? Date.now() : undefined,
            isHost: isCurrentUserHost && tokenData.currentUserProfile.isHost === true,
            participantType: isCurrentUserHost ? 'host' : 'guest',
            backgroundMode: backgroundMode, // 🔥 FIX: Include current background mode
          };
          currentUserDataRef.current = userData; // 🔥 FIX: Track user data for merging
          await callObj.setUserData(userData);
        }

        // 🔥 FIX: Enable audio and video by default on room join for better UX
        // Users should have their devices on by default instead of having to manually enable them
        let shouldEnableVideo = true;
        if (selectedVideoDeviceId || selectedAudioDeviceId) {
          const deviceLabel = getCameraDeviceLabel(selectedVideoDeviceId);
          try {
            console.log('[PersonalRoomPage] Join: Applying selected devices:', {
              hasAudioDevice: !!selectedAudioDeviceId,
              hasVideoDevice: !!selectedVideoDeviceId,
            });
            await callObj.setInputDevicesAsync({
              audioDeviceId: selectedAudioDeviceId || undefined,
              videoDeviceId: selectedVideoDeviceId || undefined,
            });
            setVideoDeviceError(null);
          } catch (error) {
            console.error('[PersonalRoomPage] Join: Failed to apply selected devices:', error);
            setVideoDeviceError(describeCameraError(error, deviceLabel));
            shouldEnableVideo = false;
          }
        }

        await callObj.setLocalAudio(true);
        await callObj.setLocalVideo(shouldEnableVideo);
        setIsMicEnabled(true);
        setIsVideoEnabled(shouldEnableVideo);
        
        // 🔥 FIX: Apply selected audio device to Daily.js call
        // This ensures the correct microphone is used for audio transmission
        if (selectedAudioDeviceId) {
          try {
            console.log('[PersonalRoomPage] Join: Applying selected audio device:', selectedAudioDeviceId);
            await callObj.setInputDevicesAsync({
              audioDeviceId: selectedAudioDeviceId,
            });
          } catch (error) {
            console.error('[PersonalRoomPage] Join: Failed to apply audio device:', error);
          }
        } else {
          console.log('[PersonalRoomPage] Join: No audio device selected yet');
        }
        
        // Request microphone access immediately to ensure it's available
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          console.log('[PersonalRoomPage] Join: Microphone access granted');
        } catch (error) {
          console.warn('[PersonalRoomPage] Join: Microphone access denied:', error);
        }
        
        setTimeout(async () => {
          const actualAudioState = callObj.localAudio();
          const actualVideoState = callObj.localVideo();
          setIsMicEnabled(actualAudioState);
          setIsVideoEnabled(actualVideoState);
          syncDailyParticipants();
          syncRemoteAudio();
        }, 500);

        window.setTimeout(() => {
          syncDailyParticipants();
          syncRemoteAudio();
        }, 0);
        window.setTimeout(() => {
          syncDailyParticipants();
          syncRemoteAudio();
        }, 1200);
      } catch (err: any) {
        const errorMessage = err?.message || err?.name || 'Unknown error';
        log('join_failed', { roomId, error: errorMessage, errorType: err?.name });
        console.error('[PersonalRoomPage] Join failed:', errorMessage, err);
        setJoinError(`Failed to join session: ${errorMessage}`);
      }
    };

    joinRoom();
  }, [
    joinRequested,
    tokenData,
    createCallObject,
    isAuthenticated,
    hostUserData,
    backgroundMode,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    getCameraDeviceLabel,
    describeCameraError,
    syncDailyParticipants,
    syncRemoteAudio,
  ]);

  useEffect(() => {
    const guestTokenString = localStorage.getItem('personalRoomToken');
    const guestName = localStorage.getItem('guestName');
    const hasGuestToken = !!(guestTokenString && guestName);
    
    if (hasGuestToken && tokenData && !joinRequested) {
      setJoinRequested(true);
    }
  }, [tokenData, joinRequested]);

  // 🔥 FIX: Guest cleanup on browser close (prevents zombie entries)
  useEffect(() => {
    if (!dailyJoined || isCurrentUserHost) return;

    const guestName = localStorage.getItem('guestName');
    if (!guestName || !roomId) return;

    // Handle browser close/refresh
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery during page unload
      if (navigator.sendBeacon) {
        const blob = new Blob(
          [JSON.stringify({ loftRoomId: roomId, guestName })],
          { type: 'application/json' }
        );
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          console.error('[PersonalRoomPage] Missing VITE_SUPABASE_URL for guest leave status beacon.');
          return;
        }
        const beaconUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/loft-update-guest-leave-status`;
        navigator.sendBeacon(beaconUrl, blob);
      }
    };

    // Handle page visibility change (tab switch, minimize)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Could mark as "away" here if needed
        console.log('[PersonalRoomPage] Tab hidden, guest may have left');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dailyJoined, isCurrentUserHost, roomId]);

  // 🔥 FIX: Background polling for pending waitlist count (visible even when sidebar closed)
  useEffect(() => {
    if (!roomId || !isCurrentUserHost || !dailyJoined) return;

    const fetchPendingCount = async () => {
      try {
        const response = await callEdgeFunction<{ waitlist: any[] }>(
          'get_personal_room_waitlist',
          { personalRoomId: roomId }
        );
        const pendingCount = (response.waitlist || []).filter(
          (e: any) => e.status === 'pending'
        ).length;
        setPendingRequestCount(pendingCount);
      } catch (error) {
        // Silent fail - don't break UI if edge function fails
        console.error('[PersonalRoomPage] Failed to fetch pending count:', error);
      }
    };

    // Fetch immediately
    fetchPendingCount();

    // Poll every 5 seconds for pending count updates
    const interval = setInterval(fetchPendingCount, 5000);
    return () => clearInterval(interval);
  }, [roomId, isCurrentUserHost, dailyJoined]);

  // 🔥 FIX: Supabase real-time subscription for waitlist changes
  useEffect(() => {
    if (!roomId || !dailyJoined) return;

    console.log('[PersonalRoomPage] Setting up Supabase subscription for room:', roomId);

    const channel = supabase
      .channel(`personal_room_waitlist:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loft_room_waitlist',
          filter: `loft_room_id=eq.${roomId}`
        },
        (payload) => {
          console.log('[PersonalRoomPage] Waitlist change detected:', payload.eventType, payload);
          syncDailyParticipants();
        }
      )
      .subscribe((status) => {
        console.log('[PersonalRoomPage] Supabase subscription status:', status);
      });

    return () => {
      console.log('[PersonalRoomPage] Cleaning up Supabase subscription');
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [roomId, dailyJoined, syncDailyParticipants]);

  const handleLeave = useCallback(async () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;

    try {
      const callObj = callObjectRef.current;
      if (callObj) {
        if (isCurrentUserHost) {
          try {
            await callObj.sendAppMessage({
              type: 'room_ended',
              roomId,
              endedAt: new Date().toISOString(),
            }, '*');
            await sleep(250);
          } catch {
            // Daily may already be disconnecting; the Edge Function close remains authoritative.
          }
        }
        try { await withTimeout(callObj.setLocalVideo(false), 1000); } catch { }
        try { await withTimeout(callObj.setLocalAudio(false), 1000); } catch { }
        try { await withTimeout(leaveMeeting(), 1500); } catch { }
        try { await withTimeout(callObj.destroy(), 1500); } catch { }
      }
    } finally {
      callObjectRef.current = null;
      if (typeof window !== 'undefined') {
        delete (window as any)[DAILY_SINGLETON_KEY];
      }

      // NEW: Different behavior for host vs guest
      if (isCurrentUserHost) {
        // Host: close the reusable personal session and dismiss waiting-room entries.
        if (roomId) {
          const closeErrors: string[] = [];
          try {
            await callEdgeFunction('end_loft_room', {
              loftRoomId: roomId
            });
          } catch (error) {
            closeErrors.push('close');
            console.error('[PersonalRoomPage] Failed to close personal session:', error);
          }
          try {
            await callEdgeFunction('clear_room_waitlist', {
              loftRoomId: roomId
            });
            setPendingRequestCount(0);
          } catch (error) {
            closeErrors.push('waitlist');
            console.error('[PersonalRoomPage] Failed to clear personal table guest requests:', error);
          }
        }
        onLeave('/personal-room');
      } else {
        // Guest: Remove from waitlist and go to thanks page
        const guestName = localStorage.getItem('guestName');
        if (guestName && roomId) {
          try {
            // 🔥 FIX: Remove guest from waitlist when they leave
            await callEdgeFunction('update_guest_leave_status', {
              loftRoomId: roomId,
              guestName: guestName
            });
          } catch (error) {
            console.error('[PersonalRoomPage] Failed to dismiss guest from waiting room:', error);
          }
        }
        
        // Clear guest approval flags so they must be approved again next time
        clearPersonalGuestAccessState();
        
        onLeave('/thanks');
      }
    }
  }, [leaveMeeting, isCurrentUserHost, onLeave, tokenData, roomId]);

  const handleToggleRecording = useCallback(async () => {
    if (!isCurrentUserHost) return;
    
    try {
      const newRecordingState = !isRecording;
      setScreenShareNotice(newRecordingState ? 'Starting recording...' : 'Stopping recording...');
      const recordingResult = await callEdgeFunction('loft-toggle-recording', {
        roomId,
        isRecording: newRecordingState,
        userId: profile?.id
      });
      const confirmedRecordingState = typeof (recordingResult as any)?.isRecording === 'boolean'
        ? (recordingResult as any).isRecording
        : newRecordingState;
      setIsRecording(confirmedRecordingState);
      setScreenShareNotice(confirmedRecordingState
        ? 'Recording started. Participants can see that recording is active.'
        : 'Recording stopped.');
    } catch (error: any) {
      const body = error?.body || {};
      const reason = typeof body?.dailyReason === 'string' && body.dailyReason.trim()
        ? ` Daily said: ${body.dailyReason.trim()}`
        : '';
      const message = body?.error === 'daily_recording_start_failed'
        ? `Recording could not start. Make sure at least one participant has audio or video connected, then try again.${reason}`
        : body?.error === 'daily_not_configured'
          ? 'Recording is not configured for this JOBZCAFE® environment yet.'
          : body?.message || error?.message || 'Recording could not be changed. Check recording permissions and try again.';
      setScreenShareNotice(message);
    }
  }, [isCurrentUserHost, isRecording, roomId, profile?.id]);

  const updateLocalParticipantMedia = useCallback((next: { audio?: boolean; video?: boolean }) => {
    setParticipants((current) => current.map((participant) => {
      if (!participant.isLocal) return participant;
      const nextVideo = next.video ?? participant.video;
      return {
        ...participant,
        audio: next.audio ?? participant.audio,
        video: nextVideo,
        isVideoOn: nextVideo,
        videoTrack: nextVideo ? participant.videoTrack : undefined,
      };
    }));
  }, []);

  const handleToggleMic = useCallback(async () => {
    const callObj = callObjectRef.current;
    if (!callObj) return;
    
    // 🔥 FIX: Optimistic update for instant UI response (no delay)
    const newState = !isMicEnabled;
    setIsMicEnabled(newState);
    updateLocalParticipantMedia({ audio: newState });
    
    try {
      // 🔥 FIX: Call setLocalAudio immediately without requesting permissions first
      // Daily.js will handle permission requests internally
      await callObj.setLocalAudio(newState);
      
      // 🔥 FIX: Verify state after a short delay and sync participants
      setTimeout(() => {
        const actualState = callObj.localAudio();
        
        // Only update if state drifted
        if (actualState !== newState) {
          setIsMicEnabled(actualState);
          updateLocalParticipantMedia({ audio: actualState });
        }
        
        // Sync participants to update UI
        syncDailyParticipants();
      }, 50);
    } catch (e) {
      setIsMicEnabled(!newState); // Revert on error
      updateLocalParticipantMedia({ audio: !newState });
    }
  }, [isMicEnabled, syncDailyParticipants, updateLocalParticipantMedia]);

  const handleToggleVideo = useCallback(async () => {
    const callObj = callObjectRef.current;
    if (!callObj) return;
    
    // 🔥 FIX: Optimistic update for instant UI response (no delay)
    const newState = !isVideoEnabled;
    localVideoOverrideRef.current = newState;
    setIsVideoEnabled(newState);
    updateLocalParticipantMedia({ video: newState });
    
    try {
      await callObj.setLocalVideo(newState);
      
      // 🔥 FIX: Verify state after a short delay and sync participants
      setTimeout(() => {
        const actualState = callObj.localVideo();
        
        // Only update if state drifted
        if (actualState !== newState) {
          localVideoOverrideRef.current = actualState;
          setIsVideoEnabled(actualState);
          updateLocalParticipantMedia({ video: actualState });
        }
        
        // Sync participants to update UI
        syncDailyParticipants();
      }, 50);
      setTimeout(() => {
        localVideoOverrideRef.current = null;
        syncDailyParticipants();
      }, 1200);
    } catch (e) {
      localVideoOverrideRef.current = !newState;
      setIsVideoEnabled(!newState); // Revert on error
      updateLocalParticipantMedia({ video: !newState });
      setTimeout(() => {
        localVideoOverrideRef.current = null;
        syncDailyParticipants();
      }, 500);
    }
  }, [isVideoEnabled, syncDailyParticipants, updateLocalParticipantMedia]);

  const handleVideoDeviceChange = useCallback((deviceId: string) => {
    setVideoDeviceError(null);
    setSelectedVideoDeviceId(deviceId);
  }, []);

  const prepareVideoForEffects = useCallback(async () => {
    const callObj = callObjectRef.current;
    if (!callObj || !dailyJoined) return;

    const deviceLabel = getCameraDeviceLabel(selectedVideoDeviceId);
    try {
      await callObj.setInputDevicesAsync({
        audioDeviceId: selectedAudioDeviceId || undefined,
        videoDeviceId: selectedVideoDeviceId || undefined,
      });
      if (!callObj.localVideo()) {
        await callObj.setLocalVideo(true);
      }
      setVideoDeviceError(null);
      setIsVideoEnabled(callObj.localVideo());
      syncDailyParticipants();
    } catch (error) {
      setVideoDeviceError(describeCameraError(error, deviceLabel));
      throw error;
    }
  }, [
    dailyJoined,
    describeCameraError,
    getCameraDeviceLabel,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    syncDailyParticipants,
  ]);

    const handleToggleScreenShare = useCallback(async () => {
    const callObj = callObjectRef.current;
    if (!callObj) {
      setScreenShareNotice('Join the session before sharing your screen.');
      return;
    }

    const currentParticipants = (callObj.participants?.() || {}) as Record<string, any>;
    const activeDailyShare = getActiveDailyScreenShare(currentParticipants);
    const localParticipant = currentParticipants?.local;
    const localSession = localParticipant?.session_id;
    const localScreenVideo = localParticipant?.tracks?.screenVideo;
    const localScreenTrack = getDailyScreenTrack(localScreenVideo);
    const screenOwnerId = activeScreenOwnerIdRef.current || activeDailyShare?.ownerId || null;
    const currentActiveScreenTrack = activeScreenTrackRef.current || activeDailyShare?.track || null;
    const isLocalTrackOwner = !!localScreenTrack && !!currentActiveScreenTrack && localScreenTrack.id === currentActiveScreenTrack.id;
    const isLocalOwner = isDailyScreenVideoActive(localScreenVideo) ||
      isLocalTrackOwner ||
      activeDailyShare?.isLocal ||
      (!!localSession && !!screenOwnerId && screenOwnerId === localSession);
    const someoneElseSharing = !!screenOwnerId && screenOwnerId !== localSession;
    const isCurrentlySharing = isDailyScreenVideoActive(localScreenVideo) || isLocalTrackOwner;

    if (!screenShareSupport.supported && !isCurrentlySharing && !isLocalOwner) {
      setScreenShareNotice(screenShareSupport.message);
      return;
    }

    if (!isCurrentUserHost && someoneElseSharing && !isLocalOwner) {
      setScreenShareNotice('Another participant is already sharing. Wait for them to stop before sharing.');
      return;
    }

    try {
      if (isCurrentlySharing || isLocalOwner) {
        setScreenShareNotice('Stopping screen share...');
        await callObj.stopScreenShare();
        setActiveScreenTrack(null);
        setActiveScreenOwnerId(null);
        setIsScreenShareStarting(false);
        setScreenShareNotice(null);
      } else if (currentActiveScreenTrack || someoneElseSharing) {
        setScreenShareNotice('Another participant is sharing. Ask them to stop before you share.');
      } else {
        setIsScreenShareStarting(true);
        setScreenShareNotice('Choose a window or tab in the browser picker. Entire screen can expose more than intended.');
        try {
          await callObj.startScreenShare();
          setActiveScreenOwnerId(localSession || null);
          setScreenShareNotice('Opening shared screen in this table...');
          const localTrack = await waitForLocalScreenTrack(callObj);
          if (localTrack) {
            setActiveScreenTrack(localTrack);
            setLayoutMode((current) => {
              if (current !== 'screenShare') {
                previousLayoutRef.current = current;
              }
              return 'screenShare';
            });
            setScreenShareNotice('Screen sharing is live in the table.');
          } else {
            try { await callObj.stopScreenShare(); } catch { }
            setActiveScreenTrack(null);
            setActiveScreenOwnerId(null);
            setIsScreenShareStarting(false);
            setLayoutMode((current) => current === 'screenShare' ? previousLayoutRef.current || 'grid' : current);
            setScreenShareNotice('Screen share did not start. If the browser picker disappeared, bring it forward or try again.');
          }
        } catch (screenShareError: any) {
          setIsScreenShareStarting(false);
          setScreenShareNotice(describeScreenShareError(screenShareError));
          return;
        }
      }

      setTimeout(() => {
        syncDailyParticipants();
      }, 500);
    } catch (err: any) {
      setIsScreenShareStarting(false);
      setScreenShareNotice(describeScreenShareError(err));
    }

  }, [isCurrentUserHost, screenShareSupport, syncDailyParticipants]);

  // 🔥 FIX: Add mute all participants feature for host
  const handleMuteAll = useCallback(async () => {
    const callObj = callObjectRef.current;
    if (!callObj || !isCurrentUserHost) {
      setScreenShareNotice('Only the host can mute participants.');
      return;
    }

    try {
      const participants = callObj.participants?.();
      if (!participants) {
        setScreenShareNotice('No participants are connected yet.');
        return;
      }

      const remoteParticipants = Object.entries(participants)
        .filter(([sessionId, participant]: [string, any]) => {
          const isLocal = sessionId === 'local' || participant?.local === true;
          return !isLocal && participant?.session_id;
        });

      if (remoteParticipants.length === 0) {
        setScreenShareNotice('No other participants are connected yet.');
        return;
      }

      const directMuteUpdates = remoteParticipants.reduce((updates, [, participant]: [string, any]) => {
        updates[participant.session_id] = { setAudio: false };
        return updates;
      }, {} as Record<string, { setAudio: boolean }>);

      try {
        if (typeof callObj.updateParticipants === 'function') {
          await Promise.resolve(callObj.updateParticipants(directMuteUpdates));
        }
      } catch {
        // Some browsers/session states do not allow direct remote audio updates.
      }

      await callObj.sendAppMessage({
        type: 'host_mute_all_audio',
        roomId,
        requestedAt: new Date().toISOString(),
      }, '*');

      setScreenShareNotice(`Muted ${remoteParticipants.length} participant${remoteParticipants.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setScreenShareNotice('Mute all could not be sent. Check the session connection and try again.');
    }
  }, [isCurrentUserHost, roomId]);

  const remoteParticipantCount = participants.filter((participant) => !participant.isLocal).length;
  const hasUnmutedParticipants = participants.some((participant) => !participant.isLocal && participant.audio);

  // 🔥 FIX: Clear all waitlist entries (for cleaning up zombie entries)
  const handleClearAllWaitlist = useCallback(async () => {
    if (!isCurrentUserHost || !roomId) return;

    const confirmed = window.confirm(
      'Clear guest requests?\n\nThis will remove waiting and welcomed guests from this table request list. Current participants in the session will not be affected.'
    );
    if (!confirmed) return;

    try {
      log('clear_waitlist_attempt', { roomId });
      await callEdgeFunction('clear_room_waitlist', {
        loftRoomId: roomId
      });
      log('clear_waitlist_success', { roomId });
      
      // Refresh the pending count
      setPendingRequestCount(0);
      
      // Show success feedback
      alert('Guest requests cleared.');
    } catch (error) {
      console.error('[PersonalRoomPage] Failed to clear guest requests:', error);
      alert('Guest requests could not be cleared. Please try again.');
    }
  }, [isCurrentUserHost, roomId]);

  const setBackgroundModeAndPersist = useCallback((mode: 'none' | 'blur' | 'image') => {
    setBackgroundMode(mode);
    // 🔥 FIX: Also sync with useLoftMedia's selectedBgId
    const bgId = mode === 'image' ? 'office' : mode; // Use 'office' as default image background
    setSelectedBgId(bgId);
    try {
      localStorage.setItem('loft.bg.mode', mode);
      // Also sync with useLoftMedia key for consistency
      localStorage.setItem('loft_bg_id', bgId);
    } catch {
      // ignore
    }
  }, [setSelectedBgId]);

  const handleLayoutChange = useCallback((layout: 'grid' | 'spotlight' | 'sidebar' | 'screenShare') => {
    setLayoutMode(layout);
    previousLayoutRef.current = layout;
  }, []);

  // 🔥 FIX: Auto-switch to screen share layout when someone is sharing
  useEffect(() => {
    if (activeScreenTrack) {
      // Only switch to screenShare if not already in that mode
      if (layoutMode !== 'screenShare') {
        previousLayoutRef.current = layoutMode;
        setLayoutMode('screenShare');
      }
    } else {
      // Switch back to previous layout when screen share ends
      if (layoutMode === 'screenShare' && previousLayoutRef.current) {
        setLayoutMode(previousLayoutRef.current);
      }
    }
  }, [activeScreenTrack, layoutMode]);

  useEffect(() => {
    if (screenShareRecoveryTimeoutRef.current) {
      clearTimeout(screenShareRecoveryTimeoutRef.current);
      screenShareRecoveryTimeoutRef.current = null;
    }

    if (layoutMode !== 'screenShare' || activeScreenTrack || isScreenShareStarting) return;

    screenShareRecoveryTimeoutRef.current = setTimeout(() => {
      const callObj = callObjectRef.current;
      const activeDailyShare = getActiveDailyScreenShare(callObj?.participants?.());
      if (activeDailyShare?.track) {
        setActiveScreenTrack(activeDailyShare.track);
        setActiveScreenOwnerId(activeDailyShare.ownerId);
        setScreenShareNotice(activeDailyShare.isLocal ? 'Screen sharing is live in the table.' : 'A participant is sharing their screen.');
        return;
      }

      setActiveScreenTrack(null);
      setActiveScreenOwnerId(null);
      setLayoutMode(previousLayoutRef.current || 'grid');
      setScreenShareNotice('Shared content did not appear. Ask the presenter to share again.');
    }, 8000);

    return () => {
      if (screenShareRecoveryTimeoutRef.current) {
        clearTimeout(screenShareRecoveryTimeoutRef.current);
        screenShareRecoveryTimeoutRef.current = null;
      }
    };
  }, [activeScreenTrack, isScreenShareStarting, layoutMode]);

  const handleScenarioChange = useCallback((scenario: string) => {
    try {
      if (scenario === 'none') {
        localStorage.removeItem(MOCK_SCENARIO_KEY);
      } else {
        localStorage.setItem(MOCK_SCENARIO_KEY, scenario);
      }
      setMockScenario(scenario);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    syncDailyParticipants();
  }, [mockScenario, syncDailyParticipants]);

  const handleThemeChange = useCallback((theme: 'light' | 'dark' | 'auto') => {
    setThemeMode(theme);
    try {
      localStorage.setItem('loft-theme', theme);
    } catch {
      // ignore
    }
  }, []);

  const handleMuteParticipant = useCallback(async (participantId: string) => {
    if (!isCurrentUserHost) return;

    try {
      const callObj = callObjectRef.current;
      if (!callObj) return;

      // Find the participant by session_id or user_id
      const participants = callObj.participants() || {};
      const participantToMute = Object.values(participants).find((p: any) => {
        const sessionId = p.session_id;
        const userId = p.user_id;
        return sessionId === participantId || userId === participantId || String(userId) === participantId;
      });

      if (participantToMute && !(participantToMute as any).local) {
        // Mute the participant's audio
        await callObj.updateParticipant((participantToMute as any).session_id, {
          setAudio: false
        });
      }
    } catch (error) {
    }
  }, [isCurrentUserHost]);

  const handleRemoveParticipant = useCallback(async (participantId: string) => {
    if (!isCurrentUserHost) return;

    try {
      const callObj = callObjectRef.current;
      if (!callObj) return;

      // Find the participant by session_id or user_id
      const participants = callObj.participants() || {};
      const participantToRemove = Object.values(participants).find((p: any) => {
        const sessionId = p.session_id;
        const userId = p.user_id;
        return sessionId === participantId || userId === participantId || String(userId) === participantId;
      });

      if (participantToRemove && !(participantToRemove as any).local) {
        // Remove the participant from the Daily call
        await callObj.updateParticipant((participantToRemove as any).session_id, {
          eject: true
        });
      }
    } catch (error) {
    }
  }, [isCurrentUserHost]);

  const applyThemeClass = useCallback((shouldUseDark: boolean) => {
    try {
      document.documentElement.classList.toggle('dark', shouldUseDark);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let media: MediaQueryList | null = null;
    
    const persistThemePreference = () => {
      try {
        localStorage.setItem('loft-theme', themeMode);
      } catch {
        // ignore
      }
    };

    const resolveShouldUseDark = () => {
      if (themeMode === 'dark') return true;
      if (themeMode === 'light') return false;
      try {
        media = media || window.matchMedia('(prefers-color-scheme: dark)');
        return media.matches;
      } catch {
        return true;
      }
    };

    const apply = () => {
      applyThemeClass(resolveShouldUseDark());
    };

    persistThemePreference();
    apply();

    if (themeMode !== 'auto') return undefined;

    media = media || (() => {
      try {
        return window.matchMedia('(prefers-color-scheme: dark)');
      } catch {
        return null;
      }
    })();

    if (!media) return undefined;

    const handleChange = (event: MediaQueryListEvent) => {
      if (themeMode === 'auto') {
        applyThemeClass(event.matches);
      }
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange);
      return () => media?.removeEventListener('change', handleChange);
    }

    if (typeof (media as any).addListener === 'function') {
      (media as any).addListener(handleChange);
      return () => (media as any)?.removeListener?.(handleChange);
    }

    return undefined;
  }, [themeMode, applyThemeClass]);

  const handleAvatarChange = useCallback(() => {
    const syncAvatar = async () => {
      const avatarUrl = readSessionAvatarUrl();
      const avatarSeed = readSessionAvatarSeed();
      const fallbackAvatarUrl = isCurrentUserHost
        ? (profile?.avatarUrl || hostDetails?.avatarUrl || tokenData?.currentUserProfile?.avatarUrl || null)
        : null;
      const nextAvatarUrl = avatarUrl || fallbackAvatarUrl || undefined;

      setParticipants(prev => prev.map((participant) => (
        participant.isLocal
          ? { ...participant, avatarUrl: nextAvatarUrl }
          : participant
      )));
      setAvatarUpdateTrigger(prev => prev + 1);

      const callObj = callObjectRef.current;
      if (callObj && typeof callObj.setUserData === 'function') {
        try {
          const nextUserData = {
            ...currentUserDataRef.current,
            avatarUrl: nextAvatarUrl || null,
            avatarSeed: avatarSeed || null,
            avatarUpdatedAt: Date.now(),
          };
          currentUserDataRef.current = nextUserData;
          await callObj.setUserData(nextUserData);
        } catch {
          setScreenShareNotice('Avatar could not be synced to the table. Try again.');
        }
      }
      syncDailyParticipants();
    };
    syncAvatar();
  }, [
    hostDetails?.avatarUrl,
    isCurrentUserHost,
    profile?.avatarUrl,
    syncDailyParticipants,
    setAvatarUpdateTrigger,
    tokenData?.currentUserProfile?.avatarUrl,
  ]);

  const hiddenMediaPipeline = joinRequested ? (
    <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
      {/** 🔥 FIX: Set explicit dimensions on video and canvas to ensure MediaPipe can process them */}
      <video ref={videoRef} autoPlay playsInline muted width={1280} height={720} style={{ width: '1280px', height: '720px' }} />
      <canvas ref={canvasRef} width={1280} height={720} style={{ width: '1280px', height: '720px' }} />
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  ) : null;

  // iOS/Safari detection - same as LoftRoomPage but also includes Safari on Mac
  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const iOS = /iPad|iPhone|iPod/.test(ua);
    
    // Detect iPadOS 13+ (reports as MacIntel but is actually iPad)
    // iPads have maxTouchPoints > 1 AND typically have smaller screens than Macs
    // Also check for touch events support which is more reliable on iPads
    const isProbablyIPad = 
      navigator.platform === 'MacIntel' && 
      (navigator as any).maxTouchPoints > 1 &&
      typeof window !== 'undefined' &&
      window.screen.width <= 1366; // iPad Pro max width
    
    // Detect Safari on Mac (which also needs portal treatment for header/footer)
    const isSafariOnMac = 
      navigator.platform === 'MacIntel' && 
      (navigator as any).maxTouchPoints <= 1 && // Not iPad (no touch or limited touch)
      ua.includes('Safari') && 
      !ua.includes('Chrome') && // Exclude Chrome
      !ua.includes('Chromium'); // Exclude other Chromium browsers
    
    return iOS || isProbablyIPad || isSafariOnMac;
  }, []);


  // Pre-join screen
  if (!joinRequested) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center text-center bg-[var(--loft-bg)]/45 backdrop-blur-xl">
        <AnimatedBackgroundBlobs />
        <div className="relative z-10 loft-card loft-card--flat px-7 sm:px-10 py-8 sm:py-10 shadow-2xl w-[min(92vw,30rem)] mx-6 text-center bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-3xl space-y-6 text-main">
          <LoftEntryMark />
          <div className="space-y-2">
            <div className="text-xl font-black uppercase tracking-tight text-main">
              Personal Table
            </div>
            <div className="mx-auto h-1 w-16 rounded-full bg-cafe/70" />
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
            {hostUserData?.name ? `Hosted by ${hostUserData.name}` : 'Ready when you are'}
          </div>
          <button
            type="button"
            onClick={() => setJoinRequested(true)}
            className="w-full rounded-2xl bg-cafe px-6 py-4 text-[11px] font-black uppercase tracking-[0.3em] text-white shadow-lg shadow-cafe/20 hover:brightness-110 active:scale-95 transition-all"
          >
            Enter Session
          </button>
        </div>
      </div>
    );
  }

  // 🔥 FIX: Error screen for join failures
  if (joinError) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center text-center bg-[var(--loft-bg)]/45 backdrop-blur-xl">
        <AnimatedBackgroundBlobs />
        <div className="relative z-10 loft-card loft-card--flat px-7 sm:px-10 py-8 sm:py-10 shadow-2xl w-[min(92vw,30rem)] mx-6 text-center bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-3xl space-y-6 text-main">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/12 text-red-500 border border-red-500/20">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="text-xl font-black uppercase tracking-tight text-main">Connection Failed</div>
          <div className="text-sm text-muted">{joinError}</div>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => {
                setJoinError(null);
                hasAttemptedJoinRef.current = false;
                setJoinRequested(false);
              }}
              className="flex-1 rounded-2xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-5 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-main hover:border-cafe/40 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                setJoinError(null);
                hasAttemptedJoinRef.current = false;
                setJoinRequested(true);
              }}
              className="flex-1 rounded-2xl bg-cafe px-5 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-white hover:brightness-110 transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!dailyJoined) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center text-center bg-[var(--loft-bg)]/45 backdrop-blur-xl">
        <AnimatedBackgroundBlobs />
        {hiddenMediaPipeline}
        <div className="relative z-10 loft-card loft-card--flat px-7 sm:px-10 py-8 sm:py-10 shadow-2xl w-[min(92vw,30rem)] mx-6 text-center bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-3xl space-y-6 text-main">
          <LoftEntryMark />
          <div className="space-y-2">
            <div className="text-xl font-black uppercase tracking-tight text-main">Joining Session</div>
            <div className="mx-auto h-1 w-16 overflow-hidden rounded-full bg-cafe/15">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-cafe" />
            </div>
          </div>
          <div className="text-[11px] font-bold text-muted">Connecting audio, video, and host controls.</div>
        </div>
      </div>
    );
  }

  const localParticipant = callObjectRef.current?.participants?.()?.local;
  const localScreenVideo = localParticipant?.tracks?.screenVideo;
  const localScreenTrack = getDailyScreenTrack(localScreenVideo);
  const isLocalDailyScreenSharing = isDailyScreenVideoActive(localScreenVideo);
  const isLocalScreenShareOwner = isLocalDailyScreenSharing ||
    (!!localScreenTrack && !!activeScreenTrack && localScreenTrack.id === activeScreenTrack.id) ||
    (!!activeScreenOwnerId && !!localSessionId && activeScreenOwnerId === localSessionId);
  const canStopScreenShare = isLocalScreenShareOwner;

  const joinedRoomUI = (
    <>
      {hiddenMediaPipeline}
      
      {/* HEADER - OUTSIDE PORTAL (iOS safe) */}
      <div id="personal-room-header-shell" className="fixed top-0 left-0 right-0 z-[100] pointer-events-auto">
        <PersonalRoomHeader
          roomTitle={hostName}
          participantCount={participants.length}
          isRecorded={isRecording}
          isHost={isCurrentUserHost}
          onOpenSetup={() => setIsSetupOpen(true)}
          onOpenSidebar={() => setIsAdmissionSidebarOpen(true)}
          onToggleRecording={handleToggleRecording}
          onScenarioChange={isCurrentUserHost && isSuperUser ? handleScenarioChange : undefined}
          currentScenario={mockScenario}
          onLayoutChange={handleLayoutChange}
          currentLayout={layoutMode}
          pendingRequestCount={pendingRequestCount}
          isScreenSharing={!!activeScreenTrack}
        />
      </div>

      {/* CONTENT AREA - DESKTOP (no portal) */}
      {!isIOS && (
        <div className="fixed inset-0 z-10 flex flex-col">
          {hiddenMediaPipeline}

          <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }} className="personal-room-content-frame h-full">
            <div className="flex-1 flex overflow-hidden relative h-full">
              <div className={`personal-room-grid-frame flex-1 p-4 md:p-6 sidebar-force-transparent`} style={{ 
                height: '100%', 
                overflow: 'hidden'
              }}>
                <PersonalRoomGrid
                  activeScreenTrack={activeScreenTrack}
                  participants={participants}
                  layoutMode={layoutMode}
                  localBackgroundMode={backgroundMode}
                  isCurrentUserHost={isCurrentUserHost}
                  onMuteParticipant={handleMuteParticipant}
                  onRemoveParticipant={handleRemoveParticipant}
                  showScreenShareOverlay={!!activeScreenTrack}
                  onStopScreenShare={canStopScreenShare ? handleToggleScreenShare : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT AREA - MOBILE/IOS (in portal) */}
      {isIOS && createPortal(
        <div id="personal-room-joined-root" className="fixed inset-0 bg-transparent fixed-safe-area overflow-visible md:overflow-hidden" style={{ height: '100vh' }}>
          <div id="personal-room-blobs" className="fixed inset-0 z-0 pointer-events-none">
            <AnimatedBackgroundBlobs />
          </div>
          <div id="personal-room-daily-wrap" className="relative z-10 flex flex-col h-full">
            {hiddenMediaPipeline}

            <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)', height: 'calc(100vh - 0px)' }} className="personal-room-content-frame h-full">
              <div className="flex-1 flex overflow-hidden relative h-full">
                <div className={`personal-room-grid-frame flex-1 p-4 md:p-6 sidebar-force-transparent`} style={{ 
                  height: '100%', 
                  overflow: 'hidden'
                }}>
                  <PersonalRoomGrid
                    activeScreenTrack={activeScreenTrack}
                    participants={participants}
                    layoutMode={layoutMode}
                    localBackgroundMode={backgroundMode}
                    isCurrentUserHost={isCurrentUserHost}
                    onMuteParticipant={handleMuteParticipant}
                    onRemoveParticipant={handleRemoveParticipant}
                    showScreenShareOverlay={!!activeScreenTrack}
                    onStopScreenShare={canStopScreenShare ? handleToggleScreenShare : undefined}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* TRANSPORT BAR - OUTSIDE PORTAL (iOS safe) */}
      <div id="personal-room-transport-bar" className="fixed inset-x-0 bottom-0 z-[1000] pointer-events-auto">
        {screenShareNotice && (
          <div className="pointer-events-none mx-auto mb-2 flex max-w-fit justify-center px-4">
            <div className="rounded-full border border-[var(--loft-border)] bg-[var(--loft-surface)]/90 px-3 py-1.5 text-center text-[11px] font-bold text-[var(--loft-text)] shadow-xl backdrop-blur-xl">
              {screenShareNotice}
            </div>
          </div>
        )}
        <PersonalRoomTransportBar
          isMicEnabled={isMicEnabled}
          isVideoEnabled={isVideoEnabled}
          isScreenSharing={!!activeScreenTrack}
          isScreenShareStarting={isScreenShareStarting}
          screenShareSupported={screenShareSupport.supported}
          onToggleMic={handleToggleMic}
          onToggleVideo={handleToggleVideo}
          onToggleScreenShare={handleToggleScreenShare}
          onMuteAll={handleMuteAll}
          hasUnmutedParticipants={hasUnmutedParticipants}
          remoteParticipantCount={remoteParticipantCount}
          onOpenSettings={() => setIsSetupOpen(true)}
          onOpenChat={() => setIsSidebarOpen(true)}
          onLeave={handleLeave}
          isHost={isCurrentUserHost}
          activeScreenOwnerId={activeScreenOwnerId}
          isCurrentUserOwnerOrHost={canStopScreenShare}
        />
      </div>

      <ScreenShareToolbar
        isScreenSharing={!!activeScreenTrack}
        isRecording={isRecording}
        isHost={isCurrentUserHost}
        isScreenShareOwner={canStopScreenShare}
        onStopScreenShare={handleToggleScreenShare}
        onToggleRecording={handleToggleRecording}
        onLeave={handleLeave}
      />

      {/* MODALS - OUTSIDE PORTAL (iOS safe) */}
      <LoftSettingsModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        
        // Theme
        themeMode={themeMode}
        onThemeChange={handleThemeChange}
        
        // Devices
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        selectedAudioDeviceId={selectedAudioDeviceId}
        selectedVideoDeviceId={selectedVideoDeviceId}
        selectedSpeakerDeviceId={selectedSpeakerDeviceId}
        videoDeviceError={videoDeviceError}
        onAudioDeviceChange={setSelectedAudioDeviceId}
        onVideoDeviceChange={handleVideoDeviceChange}
        onSpeakerDeviceChange={setSelectedSpeakerDeviceId}
        
        // Mic level
        setupMicLevel={setupMicLevel}
        
        // Background
        backgroundMode={backgroundMode}
        blurDisabled={blurDisabled}
        setBackgroundModeAndPersist={setBackgroundModeAndPersist}
        callObject={callObject}
        onPrepareVideoForEffects={prepareVideoForEffects}
        onBackgroundChange={syncDailyParticipants}
        
        // Avatar support for guests
        onAvatarChange={handleAvatarChange}
        guestName={hostUserData?.name}
      />

      <PersonalRoomSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        callObject={callObject}
      />
    </>
  );

  const joinedRender = 
    isIOS && typeof document !== 'undefined'
      ? createPortal(joinedRoomUI, document.body)
      : joinedRoomUI;

  return (
    <>
      {joinedRender}
      {/* Admission Sidebar - Outside portal to be on top of everything */}
      {(isAdmissionSidebarOpen || keepAdmissionSidebarOpen) && (
        <PersonalRoomAdmissionSidebar
          isOpen={isAdmissionSidebarOpen || keepAdmissionSidebarOpen}
          onClose={() => {
            setKeepAdmissionSidebarOpen(false);
            setIsAdmissionSidebarOpen(false);
          }}
          roomId={roomId}
          isHost={isCurrentUserHost}
          keepOpen={keepAdmissionSidebarOpen}
          onKeepOpenChange={setKeepAdmissionSidebarOpen}
          onPendingCountChange={setPendingRequestCount}
          onClearAll={handleClearAllWaitlist}
        />
      )}
    </>
  );
};

export default PersonalRoomPage;

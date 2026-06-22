import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';

import { supportsDailyBackdrops } from '@/lib/dailyBackdrops';
import { useSupabaseUser, callEdgeFunction } from '@/services/supabaseApi';
import { JoinTokenResponse, LoftRole, LoftQuestion, LoftPoll, LoftRoomStatus } from '@/types';
import {
  LOFT_CLIENT_INSTANCE_KEY,
  DAILY_DOMAIN,
  WAITING_FOR_HOST_MESSAGE,
  WAITING_ERROR_CODES,
  DAILY_SINGLETON_KEY,
  BLUR_PROCESSOR,
  NONE_PROCESSOR,
} from './utils/loftConstants';
import {
  safeJsonParse,
  generateInstanceId,
  sanitizeAvatarUrl,
  formatTimeAgo,
  dedupeParticipantsList,
  getEdgeErrorCode,
  isWaitingEdgeError,
} from './utils/loftUtils';
import LoftRoomErrorBoundary from './LoftRoomErrorBoundary';
import { useDailyEventBindings, type DailyHandlers } from './hooks/useDailyEventBindings';
import { useClientInstanceId } from './hooks/useClientInstanceId';
import { useDailyControls } from './hooks/useDailyControls';
import { useLoftMedia } from '@/hooks/useLoftMedia';
import { useRaisedHands } from '@/hooks/useRaisedHands';
import type { HandRaiseRequest } from '@/hooks/useRaisedHands';
import { getLoftRoomSummary } from '@/services/geminiService';
import { supabase } from '@/services/supabaseClient';
import AnimatedBackgroundBlobs from '../AnimatedBackgroundBlobs';
import {
  DeviceDropdown,
  ParticipantCard,
  RoomHeader,
  JoinGateScreen,
  WrapUpScreen,
  LoftSidebar,
  LoftTransportBar,
  LoftSettingsModal,
} from './components';
import { Participant, ChatMessage, BackgroundMode, SidebarTab, ReactionType } from './types';
import {
  Heart,
  Flame,
  Zap,
  ThumbsUp,
  PartyPopper,
  Sun,
  Moon,
  UserPlus,
  Sparkles,
  X,
  MessageCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CheckCircle2,
  Plus,
  Send,
  Hand,
  Monitor,
  MonitorOff,
  LogOut,
  Maximize2,
  Minimize2,
  RotateCw,
} from 'lucide-react';

interface LoftRoomPageProps {
  roomId: string;
  onLeave: () => void;
}

interface ActiveReaction {
  id: string;
  type: string;
  timestamp: number;
  leftOffset: number;
}

type MemberIdentity = {
  profileId?: string | null;
  userId?: string | null;
};

type ThemeMode = 'dark' | 'light' | 'auto';

const REACTION_TYPES: ReactionType[] = [
  { id: 'heart', icon: <Heart className="w-4 h-4 md:w-5 md:h-5 fill-rose-500 text-rose-500" />, emoji: '❤️' },
  { id: 'fire', icon: <Flame className="w-4 h-4 md:w-5 md:h-5 fill-orange-500 text-orange-500" />, emoji: '🔥' },
  { id: 'torch', icon: <Zap className="w-4 h-4 md:w-5 md:h-5 fill-amber-400 text-amber-400" />, emoji: '⚡' },
  { id: 'thumbs', icon: <ThumbsUp className="w-4 h-4 md:w-5 md:h-5 fill-blue-500 text-blue-500" />, emoji: '👍' },
  { id: 'party', icon: <PartyPopper className="w-4 h-4 md:w-5 md:h-5 fill-purple-500 text-purple-500" />, emoji: '🎉' },
];

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'auto', label: 'Auto' },
];

const AUDIO_DEVICE_KEY = 'loft.audio.device_id';
const VIDEO_DEVICE_KEY = 'loft.video.device_id';
const SPEAKER_DEVICE_KEY = 'loft.speaker.device_id';
const LOFT_SESSION_PREVIEW_KEY = 'LOFT_SESSION_PREVIEW_PARTICIPANTS';
const LOFT_PREVIEW_LISTENER_NAMES = [
  'Amelia Chen',
  'Marcus Lee',
  'Priya Shah',
  'Noah Bennett',
  'Sofia Rivera',
  'Ethan Cole',
  'Isla Morgan',
  'Leo Brooks',
  'Maya Patel',
  'Owen Clarke',
  'Nina Park',
  'Samira Khan',
  'Theo Wright',
  'Grace Lin',
  'Elena Rossi',
  'David Kim',
];

const readStoredDeviceId = (key: string) => {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(key)?.trim() || '';
  } catch {
    return '';
  }
};

const readPreviewParticipantsEnabled = () => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(LOFT_SESSION_PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
};

const readSessionAvatarUrl = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem('loft.sessionAvatar')?.trim() || undefined;
  } catch {
    console.error('[Loft] Failed to read session avatar');
    return undefined;
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

const getDailyScreenTrack = (screenVideo: any): MediaStreamTrack | null => {
  const track = screenVideo?.persistentTrack || screenVideo?.track;
  return track && track.kind === 'video' ? track : null;
};

const isDailyScreenVideoActive = (screenVideo: any) => {
  const track = getDailyScreenTrack(screenVideo);
  if (!track || track.readyState === 'ended') return false;
  return screenVideo?.state === 'playable' ||
    screenVideo?.state === 'sendable' ||
    screenVideo?.state === 'loading';
};

const LoftRoomPage: React.FC<LoftRoomPageProps> = ({ roomId, onLeave }) => {
  const { profile, user } = useSupabaseUser();

  const BACKDROP_SESSION_KEY = 'loft_backdrop_id';
  const canUseVideoProcessing = useMemo(() => supportsDailyBackdrops(), []);
  const blurDisabled = useMemo(() => !canUseVideoProcessing, [canUseVideoProcessing]);

  // iOS debugging
  const isIOSDebug = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  
  const addDebugMessage = useCallback((message: string) => {
    if (isIOSDebug) {
      setDebugMessages(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`]);
    }
  }, [isIOSDebug]);

  const [tokenData, setTokenData] = useState<JoinTokenResponse | null>(null);
  const [joinBlockedMessage, setJoinBlockedMessage] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [roomStatus, setRoomStatus] = useState<LoftRoomStatus | null>(null);
  const [roomEndedMessage, setRoomEndedMessage] = useState<string | null>(null);
  const [roomInitError, setRoomInitError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [lastFatal, setLastFatal] = useState<string | null>(null);
  const lastDiagRef = useRef<string>('init');
  const renderPhaseRef = useRef(false);
  const [roomDiag, setRoomDiag] = useState<string[]>([]);
  const pushRoomDiag = useCallback((m: string) => {
    lastDiagRef.current = m;
    try {
    } catch {
      // ignore
    }
    const append = () =>
      setRoomDiag((prev) => [...prev.slice(-14), `${new Date().toISOString().slice(11, 19)} ${m}`]);
    if (renderPhaseRef.current) {
      Promise.resolve().then(append);
    } else {
      append();
    }
  }, []);
  useEffect(() => {
    pushRoomDiag('mount: LoftRoomPage');
    if (isIOSDebug) {
      addDebugMessage(`[LoftRoom] Component loaded with roomId: ${roomId}`);
      addDebugMessage(`[LoftRoom] navigator.userAgent: ${navigator.userAgent}`);
      addDebugMessage(`[LoftRoom] window.location.href: ${window.location.href}`);
    }
  }, [pushRoomDiag, isIOSDebug, roomId]);

  const [dailyJoined, setDailyJoined] = useState(false);
  const [needsTapToJoin, setNeedsTapToJoin] = useState(false);
  const [joinNonce, setJoinNonce] = useState(0);

  type ProfileDirectoryEntry = { displayName: string; avatarUrl?: string; userId?: string };
  const [profileDirectory, setProfileDirectory] = useState<Record<string, ProfileDirectoryEntry>>({});

  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [localHandRaised, setLocalHandRaised] = useState(false);

  // IMPORTANT FIX:
  // Roles are returned as profile_id in loft_room_member, so we key by profileId (not userId).
  const [rolesByProfileId, setRolesByProfileId] = useState<Record<string, LoftRole>>({});

  const [isJoined, setIsJoined] = useState(false);
  const [joinRequested, setJoinRequested] = useState(false);
  const [waitingForHost, setWaitingForHost] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [previewParticipantsEnabled, setPreviewParticipantsEnabled] = useState(() => readPreviewParticipantsEnabled());

  const [reactions, setReactions] = useState<ActiveReaction[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<LoftQuestion[]>([]);
  const [polls, setPolls] = useState<LoftPoll[]>([]);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>(() => readStoredDeviceId(VIDEO_DEVICE_KEY));
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>(() => readStoredDeviceId(AUDIO_DEVICE_KEY));
  const [selectedSpeakerDeviceId, setSelectedSpeakerDeviceId] = useState<string>(() => readStoredDeviceId(SPEAKER_DEVICE_KEY));
  const [micLevel, setMicLevel] = useState(0);
  const [setupMicLevel, setSetupMicLevel] = useState(0);
  const [avatarUpdateTrigger, setAvatarUpdateTrigger] = useState(0); // Force avatar updates

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage?.getItem('loft-theme') : null;
      if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
    } catch {
      // ignore
    }
    return 'dark';
  });

  const [chatInput, setChatInput] = useState('');
  const [qaInput, setQaInput] = useState('');

  const openChat = useCallback(() => {
    setSidebarTab('chat');
    setIsSidebarOpen(true);
  }, []);

  const openQueue = useCallback(() => {
    setSidebarTab('queue');
    setIsSidebarOpen(true);
  }, []);

  const scrollListenerTrack = useCallback((direction: 'left' | 'right') => {
    const track = listenerTrackRef.current;
    if (!track) return;

    track.scrollBy({
      left: direction === 'left' ? -360 : 360,
      behavior: 'smooth',
    });
  }, []);

  const [isWrappingUp, setIsWrappingUp] = useState(false);
  const [finalSummary, setFinalSummary] = useState<string | null>(null);
  const [callObject, setCallObject] = useState<any | null>(null);

  const { toggleMic, toggleCamera, leaveMeeting, setInputDevices, setSpeakerDevice } = useDailyControls(callObject);

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
    
    return iOS || isProbablyIPad;
  }, []);

  const isStandalonePWA = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const navAny = navigator as any;
    const standalone = !!navAny?.standalone;
    let displayMode = false;
    try {
      displayMode = !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    } catch {
      displayMode = false;
    }
    return standalone || displayMode;
  }, []);

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

  const triggerJoinAttempt = useCallback(
    (fromTap: boolean) => {
      tapGateSatisfiedRef.current = true;
      pushRoomDiag(fromTap ? 'daily: tap join requested' : 'daily: retry requested');
      setNeedsTapToJoin(false);
      setRoomInitError(null);
      setJoinBlockedMessage(null);
      setJoinError(null);
      hasAttemptedJoinRef.current = false;
      setJoinNonce((n) => n + 1);
    },
    [pushRoomDiag]
  );

  const handleTapToJoin = useCallback(() => {
    tapGateSatisfiedRef.current = true;
    pendingAudioUnlockRef.current = true;

    // iOS audio unlock: play hidden audio element immediately within gesture
    const audioEl = remoteAudioRef.current;
    if (audioEl) {
      audioEl.muted = false;
      audioEl.play()
        .then(() => {
          audioUnlockedRef.current = true;
        })
        .catch(() => {
          // Audio unlock blocked
        });
    }

    setJoinRequested(true);
    triggerJoinAttempt(true);
  }, [triggerJoinAttempt]);

  const showRoomDiag = false;

  useEffect(() => {
    if ((isIOS || isStandalonePWA) && !tapGateSatisfiedRef.current) {
      setNeedsTapToJoin(true);
      pushRoomDiag('daily: pre-arm tap gate (platform detection)');
    }
  }, [isIOS, isStandalonePWA, pushRoomDiag, joinRequested]);

  useEffect(() => {
    setHasJoinedRoom(false);
  }, [roomId]);

  useEffect(() => {
    didResetHandsRef.current = false;
  }, [roomId]);

  useEffect(() => {
    if (!joinRequested) {
      setHasJoinedRoom(false);
    }
  }, [joinRequested]);

  useEffect(() => {
    const handleFatal = (raw: unknown, prefix: string) => {
      const msg = typeof raw === 'string' ? raw : raw && (raw as any).message ? (raw as any).message : String(raw ?? 'Unknown error');
      pushRoomDiag(`${prefix}: ${msg}`);
      setRoomInitError((prev) => prev || msg);
      setLastFatal(msg);
      setJoinError(msg);
      setJoinBlockedMessage(msg);
    };
    const onErr = (e: ErrorEvent) => {
      handleFatal(e?.message || e?.error || 'Unknown error', 'ERROR');
    };
    const onRej = (e: PromiseRejectionEvent) => {
      handleFatal((e as any)?.reason || 'unhandled rejection', 'REJECTION');
    };
    pushRoomDiag('Room mounted');
    try {
      pushRoomDiag(`href=${window.location.href}`);
    } catch {
      // ignore
    }
    pushRoomDiag(`isIOS=${isIOS} standalone=${isStandalonePWA}`);
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, [pushRoomDiag, isIOS, isStandalonePWA]);

  useEffect(() => {
    if (!isIOS) return;
    if (!hasJoinedRoom) return;
    const el = foregroundRef.current;
    if (!el) {
      pushRoomDiag('ui: foregroundRef missing');
      return;
    }
    const r = el.getBoundingClientRect();
    pushRoomDiag(`ui: foreground rect w=${Math.round(r.width)} h=${Math.round(r.height)} top=${Math.round(r.top)} left=${Math.round(r.left)}`);
  }, [isIOS, hasJoinedRoom, pushRoomDiag]);

  useEffect(() => {
    const env = (import.meta as any)?.env;
    if (env?.DEV) {
      // eslint-disable-next-line no-console
    }
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const screenShareFrameRef = useRef<HTMLDivElement>(null);
  const listenerTrackRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const foregroundRef = useRef<HTMLDivElement>(null);
  const callObjectRef = useRef<DailyCall | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioStreamRef = useRef<MediaStream | null>(null);
  const audioUnlockedRef = useRef(false);
  const pendingAudioUnlockRef = useRef(false);

  const didResetHandsRef = useRef(false);
  const autoStartPreviewKeyRef = useRef<string | null>(null);
  const bgInitProfileIdRef = useRef<string | null>(null);
  const didUserSelectBackdropRef = useRef<boolean>(false);

  const [backdropNotice, setBackdropNotice] = useState<string | null>(null);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('none');

  const dailySingletonKey = '__loftDailyCallObject';
  const dailyJoinInFlightRef = useRef(false);
  const lastDailyJoinKeyRef = useRef<string | null>(null);
  const isLeavingRef = useRef(false);
  const selectedVideoDeviceIdRef = useRef<string>('');
  const selectedAudioDeviceIdRef = useRef<string>('');
  const backgroundModeRef = useRef<BackgroundMode>('none');
  const lastAppliedProcessorRef = useRef<'none' | 'blur' | null>(null);
  const canUseVideoProcessingRef = useRef<boolean>(false);
  const userNameRef = useRef<string>('Guest');
  const userIdToProfileIdRef = useRef<Record<string, string>>({});
  const hasAutoInspectedRef = useRef(false);
  const rolesPollInFlightRef = useRef(false);
  const rolesPollFailCountRef = useRef(0);
  const rolesPollPausedUntilRef = useRef(0);
  const isMicEnabledRef = useRef(false);
  const isVideoEnabledRef = useRef(false);
  const isHostRef = useRef(false);
  const isEndingRef = useRef(false);
  const hasAttemptedJoinRef = useRef(false);
  const processedCanvasStreamRef = useRef<MediaStream | null>(null);
  const processedVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const lastDailyLocalSnapshotRef = useRef<string | null>(null);
  const forcedEndHandledRef = useRef(false);
  const [activeScreenTrack, setActiveScreenTrack] = useState<MediaStreamTrack | null>(null);
  const [activeScreenOwnerId, setActiveScreenOwnerId] = useState<string | null>(null);
  const [isScreenShareStarting, setIsScreenShareStarting] = useState(false);
  const [screenShareNotice, setScreenShareNotice] = useState<string | null>(null);
  const [screenShareAspectRatio, setScreenShareAspectRatio] = useState('16 / 9');
  const [isScreenShareFullscreen, setIsScreenShareFullscreen] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const clientInstanceIdRef = useRef<string | null>(null);
  const dailyEnvLogRef = useRef(false);
  const tapGateSatisfiedRef = useRef(false);
  const audioStartRequestedRef = useRef(false);
  const isJoiningRef = useRef(false);
  const waitingRetryIntervalRef = useRef<number | null>(null);
  const waitingRetryInFlightRef = useRef(false);

  const isMountedRef = useRef(true);
  const dailyHandlersRef = useRef<DailyHandlers>({});
  const speakerDebounceRef = useRef<Record<string, NodeJS.Timeout>>({});
  const speakingStateRef = useRef<Record<string, boolean>>({});

  useClientInstanceId(clientInstanceIdRef);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const createCallObject = useCallback(() => {
    const existing = (typeof window !== 'undefined' ? (window as any)[dailySingletonKey] : null);
    if (existing) {
      // Enhanced cleanup to prevent echo
      try {
        // Force cleanup of all audio tracks from existing call
        const participants = existing.participants?.();
        if (participants) {
          Object.values(participants).forEach((p: any) => {
            if (p?.tracks?.audio?.track) {
              try { p.tracks.audio.track.stop(); } catch { /* ignore */ }
            }
            if (p?.tracks?.video?.track) {
              try { p.tracks.video.track.stop(); } catch { /* ignore */ }
            }
          });
        }
        
        // Ensure muted state before leaving to prevent audio feedback
        try { existing.setLocalAudio(false); } catch { /* ignore */ }
        try { existing.setLocalVideo(false); } catch { /* ignore */ }
        
        const state = typeof existing.meetingState === 'function' ? existing.meetingState() : null;
        if (state === 'joined-meeting' || state === 'joining-meeting') {
          // Already in a meeting, leave first to prevent echo
          try { existing.leave(); } catch { /* ignore */ }
        }
      } catch {
        // If we can't check state, clean it up to be safe
        try { existing.destroy(); } catch { /* ignore */ }
        if (typeof window !== 'undefined') {
          delete (window as any)[dailySingletonKey];
        }
      }
      return existing;
    }
    
    try {
      const callObject = DailyIframe.createCallObject({
        useLegacyVideoProcessor: true,
      } as any);
      try {
        if (typeof window !== 'undefined') (window as any)[dailySingletonKey] = callObject;
      } catch {
        // ignore
      }
      return callObject;
    } catch (e: any) {
      const maybeExisting = (typeof window !== 'undefined' ? (window as any)[dailySingletonKey] : null);
      if (maybeExisting) {
        return maybeExisting;
      } else {
        throw e;
      }
    }
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isIOS && isJoiningRef.current) {
        pushRoomDiag('skip cleanup: joining');
        return;
      }
      try {
        const callObject = callObjectRef.current;
        if (!callObject) return;
        try { callObject.leave?.(); } catch { /* ignore */ }
        try { (callObject as any).destroy?.(); } catch { /* ignore */ }
      } catch {
        // ignore
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isIOS, pushRoomDiag]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      try {
        const hidden = typeof document !== 'undefined' ? document.hidden : false;
        pushRoomDiag(`vis:${hidden ? 'hidden' : 'visible'}${isIOS && isJoiningRef.current ? ' (joining)' : ''}`);
      } catch {
        // ignore
      }
    };
    const handlePageHide = () => {
      pushRoomDiag(`pagehide${isIOS && isJoiningRef.current ? ' (joining)' : ''}`);
    };
    const handleBlur = () => {
      pushRoomDiag(`blur${isIOS && isJoiningRef.current ? ' (joining)' : ''}`);
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('blur', handleBlur);

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isIOS, pushRoomDiag]);

  const safeCall = useCallback(
    async (fn: (callObject: DailyCall) => Promise<void> | void) => {
      if (isLeavingRef.current) return;
      const callObject = callObjectRef.current;
      if (!callObject) return;
      await fn(callObject);
    },
    []
  );

  const beginLeave = useCallback(async () => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    const callObject = callObjectRef.current;
    try {
      if (callObject) {
        try { await Promise.resolve(callObject.setLocalVideo(false)); } catch { /* ignore */ }
        try { await Promise.resolve(callObject.setLocalAudio(false)); } catch { /* ignore */ }
        try { await leaveMeeting(); } catch { /* ignore */ }
        try {
          await Promise.resolve((callObject as any).destroy?.());
        } catch {
          // ignore
        }
        try {
          if (typeof window !== 'undefined' && (window as any)[dailySingletonKey] === callObject) {
            delete (window as any)[dailySingletonKey];
          }
        } catch {
          // ignore
        }
      }
    } finally {
      callObjectRef.current = null;
      try { localStorage.removeItem('loft.mic.enabled'); } catch { /* ignore */ }
      try { localStorage.removeItem('loft.video.enabled'); } catch { /* ignore */ }
    }
  }, [dailySingletonKey, leaveMeeting]);

  const leaveDailyMeeting = useCallback(async () => {
    await beginLeave();
  }, [beginLeave]);

  const handleForcedRoomEnd = useCallback(async (reason?: string) => {
    if (isHostRef.current) return;
    if (forcedEndHandledRef.current) return;
    forcedEndHandledRef.current = true;
    const resolvedReason = reason || 'Host ended this table.';
    setRoomStatus(LoftRoomStatus.ENDED);
    setRoomEndedMessage(resolvedReason);
    setJoinBlockedMessage(resolvedReason);
    await leaveDailyMeeting();
    onLeave();
  }, [leaveDailyMeeting, onLeave]);

  const endRoomForAll = useCallback(async (reason?: string) => {
    if (!isHostRef.current) return;
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    const resolvedReason = reason || 'Host ended this table.';
    try {
      await callEdgeFunction('end_loft_room', { loftRoomId: roomId });
    } catch (err) {
      try {
        const shouldDebug = typeof window !== 'undefined' && window.localStorage?.getItem('loft_debug_daily') === '1';
        if (shouldDebug) {
          // eslint-disable-next-line no-console
          console.error('[Loft] end_loft_room failed');
        }
      } catch {
        // ignore
      }
    }
    try {
      const callObject = callObjectRef.current;
      if (callObject?.sendAppMessage) {
        callObject.sendAppMessage({ type: 'room_ended', reason: resolvedReason }, '*');
      }
    } catch {
      // ignore
    }
    setRoomStatus(LoftRoomStatus.ENDED);
    setRoomEndedMessage(resolvedReason);
    setJoinBlockedMessage(resolvedReason);
    isEndingRef.current = false;
  }, [roomId]);

  const dailySupportInfo = useMemo(() => {
    try {
      return (DailyIframe as any)?.supportedBrowser?.();
    } catch {
      return null;
    }
  }, []);

  const videoProcessingSupportedRef = useRef<boolean>(false);

  const videoProcessingSupportDetails = useMemo(() => {
    try {
      const sb: any = dailySupportInfo;
      if (typeof sb === 'boolean') return `supportedBrowser(): ${sb}`;
      if (!sb) return 'supportedBrowser(): unavailable';
      const supported = typeof sb.supported === 'boolean' ? sb.supported : undefined;
      const vp = typeof sb.supportsVideoProcessing === 'boolean' ? sb.supportsVideoProcessing : undefined;
      return `supported=${supported ?? 'n/a'}, videoProcessing=${vp ?? 'n/a'}`;
    } catch {
      return 'supportedBrowser(): unavailable';
    }
  }, [dailySupportInfo]);

  useEffect(() => {
    try {
      const isDev = !!(import.meta as any)?.env?.DEV;
      if (!isDev) return;
      if (!isSetupOpen) return;
      // eslint-disable-next-line no-console
    } catch {
      // ignore
    }
  }, [isSetupOpen]);

  useEffect(() => {
    canUseVideoProcessingRef.current = !!canUseVideoProcessing;
    videoProcessingSupportedRef.current = !!canUseVideoProcessing;
  }, [canUseVideoProcessing]);

  useEffect(() => {
    selectedVideoDeviceIdRef.current = selectedVideoDeviceId;
  }, [selectedVideoDeviceId]);

  useEffect(() => {
    selectedAudioDeviceIdRef.current = selectedAudioDeviceId;
  }, [selectedAudioDeviceId]);

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

  const isDevEnv = useMemo(() => {
    try {
      return !!(import.meta as any)?.env?.DEV;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const fallbackName = profile?.name || 'Guest';
    const nextName = tokenData?.currentUserProfile?.displayName || fallbackName;
    userNameRef.current = nextName;
  }, [tokenData?.currentUserProfile?.displayName, profile?.name]);

  const resolveProfileIdentity = useCallback((
    input: { profileId?: string | null; userId?: string | null; fallbackName?: string; fallbackAvatar?: string }
  ) => {
    const { profileId, userId, fallbackName, fallbackAvatar } = input;
    const mappedProfileId = (() => {
      if (profileId && profileDirectory[profileId]) return profileId;
      if (userId && userIdToProfileIdRef.current[userId]) return userIdToProfileIdRef.current[userId];
      return profileId || undefined;
    })();

    const matchedByName = (() => {
      if (mappedProfileId || !fallbackName) return undefined;
      const target = fallbackName.trim().toLowerCase();
      if (!target) return undefined;
      const entry = Object.entries(profileDirectory).find(
        ([, value]) => (value?.displayName || '').trim().toLowerCase() === target
      );
      return entry?.[0];
    })();

    const finalProfileId = mappedProfileId || matchedByName;

    const directoryEntry = finalProfileId ? profileDirectory[finalProfileId] : undefined;
    const displayName = directoryEntry?.displayName || fallbackName || 'Guest';
    const avatarUrl = directoryEntry?.avatarUrl || fallbackAvatar;

    return {
      profileId: finalProfileId,
      displayName,
      avatarUrl,
    };
  }, [profileDirectory, isDevEnv, roomId]);

  useEffect(() => {
    const newEntries: Record<string, ProfileDirectoryEntry> = {};
    const newUserMap: Record<string, string> = {};
    (tokenData?.members || []).forEach((member) => {
      if (!member.profileId) return;
      const sanitizedAvatar = sanitizeAvatarUrl(member.avatarUrl);
      newEntries[member.profileId] = {
        displayName: member.displayName,
        avatarUrl: sanitizedAvatar,
        userId: member.userId,
      };
      if (member.userId) newUserMap[member.userId] = member.profileId;
    });
    if (tokenData?.currentUserProfile?.profileId) {
      // Prioritize fresh database profile over token data
      const sanitizedCurrentAvatar = sanitizeAvatarUrl(profile?.avatarUrl) || 
                                     sanitizeAvatarUrl(tokenData.currentUserProfile.avatarUrl);
      newEntries[tokenData.currentUserProfile.profileId] = {
        displayName: tokenData.currentUserProfile.displayName,
        avatarUrl: sanitizedCurrentAvatar,
        userId: user?.id || undefined,
      };
      if (user?.id) newUserMap[user.id] = tokenData.currentUserProfile.profileId;
    }
    if (Object.keys(newEntries).length > 0) {
      setProfileDirectory((prev) => ({ ...prev, ...newEntries }));
    }
    if (Object.keys(newUserMap).length > 0) {
      userIdToProfileIdRef.current = { ...userIdToProfileIdRef.current, ...newUserMap };
    }
  }, [
    tokenData?.members,
    tokenData?.currentUserProfile?.profileId,
    tokenData?.currentUserProfile?.displayName,
    tokenData?.currentUserProfile?.avatarUrl,
    user?.id
  ]);

  useEffect(() => {
    if (!Object.keys(profileDirectory).length) return;
    setParticipants((prev) =>
      prev.map((participant) => {
        const resolved = resolveProfileIdentity({
          profileId: participant.profileId,
          userId: participant.userId,
          fallbackName: participant.name,
          fallbackAvatar: participant.avatarUrl,
        });
        const nextAvatar = participant.isLocal ? participant.avatarUrl : (resolved.avatarUrl || participant.avatarUrl);
        if (
          resolved.displayName === participant.name &&
          nextAvatar === participant.avatarUrl &&
          resolved.profileId === participant.profileId
        ) {
          return participant;
        }
        return {
          ...participant,
          name: resolved.displayName,
          avatarUrl: nextAvatar,
          profileId: resolved.profileId || participant.profileId,
        };
      })
    );
  }, [profileDirectory, resolveProfileIdentity]);

  useEffect(() => {
    isMicEnabledRef.current = !!isMicEnabled;
  }, [isMicEnabled]);

  useEffect(() => {
    isVideoEnabledRef.current = !!isVideoEnabled;
  }, [isVideoEnabled]);

  // Γ£à FIX: withTimeout should accept PromiseLike (Supabase builders are thenables),
  // and allow 3 args (promise, ms, timeoutMessage) like your callsites.
  const withTimeout = useCallback(<T,>(
    promiseLike: PromiseLike<T>,
    ms = 8000,
    timeoutMessage = 'timeout'
  ): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const id = window.setTimeout(() => reject(new Error(timeoutMessage)), ms);
      Promise.resolve(promiseLike)
        .then((v) => {
          window.clearTimeout(id);
          resolve(v);
        })
        .catch((e) => {
          window.clearTimeout(id);
          reject(e);
        });
    });
  }, []);

  const waitForLocalVideoPlayable = async (callObject: DailyCall, timeoutMs = 2500) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const local = callObject.participants?.()?.local;
        const state = local?.tracks?.video?.state;
        if (state === 'playable') return true;
      } catch {
        // ignore
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return false;
  };

  const applyBackdropToDaily = useCallback(async (mode: BackgroundMode) => {
    const callObject = callObjectRef.current;
    if (!callObject) return;
    if (!canUseVideoProcessingRef.current) return;
    if (lastAppliedProcessorRef.current === mode) return;

    try {
      const local = callObject.participants?.()?.local;
      const localVideoState = local?.tracks?.video?.state;
      if (localVideoState && localVideoState !== 'playable' && localVideoState !== 'loading') {
        if (localVideoState === 'off' || localVideoState === 'blocked') return;
      }
    } catch {
      // ignore
    }

    const ok = await waitForLocalVideoPlayable(callObject, 2500);
    if (!ok) return;

    try {
      const processor =
        (mode === 'blur'
          ? { type: 'background-blur', config: { strength: 1 } }
          : { type: 'none' }) as any;

      await callObject.updateInputSettings({
        video: { processor },
      });

      lastAppliedProcessorRef.current = mode;
    } catch {
      console.error('applyBackdropToDaily failed');
      setBackdropNotice('Background blur is unavailable on this device.');
      setTimeout(() => setBackdropNotice(null), 4000);
      lastAppliedProcessorRef.current = null;
    }
  }, []);

  const requestApplyBackdrop = useCallback((mode: BackgroundMode) => {
    requestAnimationFrame(() => {
      applyBackdropToDaily(mode);
    });
  }, [applyBackdropToDaily]);

  const {
    stream,
    isPreviewOn,
    previewError,
    selectedBgId,
    setSelectedBgId,
    toggleMedia,
    stopMedia,
    restartMedia,
    setPreferredDevices,
    screenStream,
    startScreenShare,
    stopScreenShare,
    isModelLoading,
  } = useLoftMedia(videoRef, canvasRef, { enabled: false });

  useEffect(() => {
    backgroundModeRef.current = backgroundMode;
  }, [backgroundMode]);

  useEffect(() => {
    setSelectedBgId(backgroundMode === 'blur' ? 'blur' : 'none');
  }, [backgroundMode, setSelectedBgId]);

  const ensureBackdropVideoSource = useCallback(async () => {
    const callObject = callObjectRef.current;
    if (!callObject) return;
    if (canUseVideoProcessingRef.current) return;
    if (backgroundMode !== 'blur') return;

    // Only restart media if absolutely necessary
    let mediaRestarted = false;
    if (!isPreviewOn) {
      try { 
        await Promise.resolve(toggleMedia()); 
        mediaRestarted = true;
      } catch { /* ignore */ }
    } else {
      try { 
        await restartMedia(); 
        mediaRestarted = true;
      } catch { /* ignore */ }
    }

    // Wait for media to stabilize after restart
    if (mediaRestarted) {
      await new Promise(r => setTimeout(r, 300));
    }

    const canvasEl = canvasRef.current;
    if (
      (!processedCanvasStreamRef.current || processedCanvasStreamRef.current.getVideoTracks().length === 0) &&
      canvasEl?.captureStream
    ) {
      try {
        // Reduce frame rate to prevent performance issues
        processedCanvasStreamRef.current = canvasEl.captureStream(15);
      } catch {
        processedCanvasStreamRef.current = null;
      }
    }

    const t = processedCanvasStreamRef.current?.getVideoTracks?.()?.[0] || null;
    if (!t) return;
    processedVideoTrackRef.current = t;

    try {
      // Only set video source, don't touch audio
      await Promise.resolve(callObject.setInputDevicesAsync({
        videoSource: t,
      }) as any);
    } catch {
      // ignore
    }
  }, [isPreviewOn, restartMedia, backgroundMode, toggleMedia]);

  const clearBackdropVideoSource = useCallback(async () => {
    const callObject = callObjectRef.current;
    if (!callObject) return;
    if (canUseVideoProcessingRef.current) return;

    processedVideoTrackRef.current = null;
    try { processedCanvasStreamRef.current?.getTracks?.().forEach((tr) => tr.stop()); } catch { /* ignore */ }
    processedCanvasStreamRef.current = null;

    try {
      await Promise.resolve(callObject.setInputDevicesAsync({
        audioDeviceId: selectedAudioDeviceIdRef.current || undefined,
        videoDeviceId: selectedVideoDeviceIdRef.current || undefined,
      }) as any);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isJoined) return;
    if (canUseVideoProcessing) {
      try { clearBackdropVideoSource(); } catch { /* ignore */ }
      return;
    }

    if (backgroundMode !== 'blur') {
      try { clearBackdropVideoSource(); } catch { /* ignore */ }
    } else {
      try { ensureBackdropVideoSource(); } catch { /* ignore */ }
    }
  }, [isJoined, backgroundMode, canUseVideoProcessing, ensureBackdropVideoSource, clearBackdropVideoSource]);

  const toggleLocalVideoSafe = useCallback(
    async (next: boolean) => {
      const callObject = callObjectRef.current;
      if (!callObject) return;

      try {
        await Promise.resolve(callObject.setLocalVideo(next));
      } catch {
        // ignore
      }

      await new Promise((resolve) => setTimeout(resolve, 80));
    },
    []
  );

  const localProfileAvatarUrl = useMemo(() => {
    return readSessionAvatarUrl() ||
      sanitizeAvatarUrl(tokenData?.currentUserProfile?.avatarUrl) ||
      sanitizeAvatarUrl(profile?.avatarUrl);
  }, [tokenData?.currentUserProfile?.avatarUrl, profile?.avatarUrl, avatarUpdateTrigger]);

  const syncRemoteAudio = useCallback(() => {
    const call = callObjectRef.current;
    const el = remoteAudioRef.current;
    if (!call || !el) return;

    // DON'T stop tracks - just replace stream
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
    const prev = el.srcObject as MediaStream | null;
    const prevIds = prev ? prev.getAudioTracks().map(t => t.id).join(',') : '';
    const nextIds = stream.getAudioTracks().map(t => t.id).join(',');

    if (prevIds !== nextIds) {
      el.srcObject = stream;
      remoteAudioStreamRef.current = stream;
    }

    // KEEP muted until user explicitly unmutes via tap/gesture
    if (!audioUnlockedRef.current) {
      el.muted = true;
      return;
    }

    el.play().catch(() => {
      console.warn('[Audio] Remote audio blocked');
    });
  }, []);

  const syncDailyParticipants = useCallback(() => {
    const callObject = callObjectRef.current;
    if (!callObject) return;

    let dailyParts: Record<string, any> = {};
    try {
      dailyParts = callObject.participants?.() || {};
    } catch {
      dailyParts = {};
    }

    const partsValues: any[] = (() => {
      try {
        return Object.values(dailyParts || {});
      } catch {
        return [];
      }
    })();

    const mapped: Participant[] = partsValues
      .filter((p: any) => p && (p.session_id || p.local))
      .map((p: any) => {
        const isLocal = p.local;
        const userId = p.user_id ? String(p.user_id) : undefined;
        const dailyUserData: Record<string, any> = (p?.userData || p?.user_data || {}) as any;
        const profileIdFromUserData = dailyUserData?.profileId || dailyUserData?.profile_id;
        const instanceIdFromUserData = dailyUserData?.instanceId || dailyUserData?.instance_id;
        const avatarFromUserData = sanitizeAvatarUrl(dailyUserData?.avatarUrl || dailyUserData?.avatar_url);

        const fallbackName = isLocal
          ? (tokenData?.currentUserProfile?.displayName || profile?.name || 'Guest')
          : (p.user_name || 'Guest');

        const resolvedIdentity = resolveProfileIdentity({
          profileId: profileIdFromUserData,
          userId,
          fallbackName,
          fallbackAvatar: avatarFromUserData,

        });

        const pid = resolvedIdentity.profileId;
        const isHostParticipant = !!hostProfileId && !!pid && pid === hostProfileId;

        let role: LoftRole;

if (isLocal) {
      // Local role must come from token/host, never from rolesByProfileId
      role = isHostParticipant
      ? LoftRole.HOST
      : ((tokenData?.role || LoftRole.LISTENER) as LoftRole);
} else {
  // Remote role can come from rolesByProfileId
  role = (pid && rolesByProfileId[pid]) ? rolesByProfileId[pid] : LoftRole.LISTENER;
}

// Final safety: host always wins
if (isHostParticipant) role = LoftRole.HOST;
        

        const videoTrack: MediaStreamTrack | undefined =
          p?.tracks?.video?.persistentTrack || p?.tracks?.video?.track || undefined;
        const videoState = p?.tracks?.video?.state;
        const isVideoOn = videoState === 'playable';

        // Replace unreliable is_speaking with debounced audio level detection
        const audioLevel = p?.tracks?.audio?.audioLevel || 0;
        const sessionId = p.session_id || 'local';
        const audioPlayable = p?.tracks?.audio?.state === 'playable';
        
        // Clear existing debounce for this participant
        if (speakerDebounceRef.current[sessionId]) {
          clearTimeout(speakerDebounceRef.current[sessionId]);
        }
        
        // Debounce speaker detection (300ms delay) based on audio level
        if (audioLevel > 0.1) {
          speakerDebounceRef.current[sessionId] = setTimeout(() => {
            speakingStateRef.current[sessionId] = true;
          }, 300);
        } else {
          speakingStateRef.current[sessionId] = false;
        }
        
        const isSpeaking = speakingStateRef.current[sessionId] || false;
        const effectiveAudio = isLocal ? !!isMicEnabledRef.current : (isSpeaking || audioPlayable);
        const effectiveVideoEnabled = isLocal ? !!isVideoEnabledRef.current : !!videoTrack;

        return {
          id: isLocal ? 'local' : (p.session_id || String(p.user_id || p.user_name || Math.random())),
          userId,
          profileId: resolvedIdentity.profileId,
          instanceId: instanceIdFromUserData || (isLocal ? clientInstanceIdRef.current || undefined : undefined),
          name: resolvedIdentity.displayName,
          role,
          audio: effectiveAudio,
          video: effectiveVideoEnabled,
          isVideoOn,
          isLocal,
          isOnStage: role !== LoftRole.LISTENER,
          avatarUrl: isLocal ? localProfileAvatarUrl : resolvedIdentity.avatarUrl || undefined,
          videoTrack: effectiveVideoEnabled ? videoTrack : undefined,
          joinedAt: typeof p?.joined_at === 'number' ? p.joined_at : Date.now(),
        };
      });

    mapped.sort((a, b) => (b.isLocal ? 1 : 0) - (a.isLocal ? 1 : 0));

    setParticipants(dedupeParticipantsList(mapped, clientInstanceIdRef.current));

    // Find screen share tracks from any participant
    const screenTracks: Array<{ track: MediaStreamTrack; ownerId: string | null }> = [];
    partsValues.forEach((p: any) => {
      const screenVideo = p?.tracks?.screenVideo;

      const track = getDailyScreenTrack(screenVideo);
      if (track && isDailyScreenVideoActive(screenVideo)) {
        screenTracks.push({
          track,
          ownerId: p?.session_id || (p?.local ? 'local' : null),
        });
      }
    });

    const activeScreenShare = screenTracks[0] || null;

    setActiveScreenTrack(activeScreenShare?.track || null);
    setActiveScreenOwnerId(activeScreenShare?.ownerId || null);
  }, [
    tokenData?.currentUserProfile?.displayName,
    tokenData?.role,
    profile?.name,
    localProfileAvatarUrl,
    resolveProfileIdentity,
    rolesByProfileId,
    participants,
    tokenData,
    profile,
    avatarUpdateTrigger,
  ]);

  const handleAvatarChange = useCallback(() => {
    // Force re-render of participants to show new avatar for authenticated users
    syncDailyParticipants();
    
    // Force avatar update by incrementing trigger
    setAvatarUpdateTrigger(prev => prev + 1);
    
    // Also force a re-render by updating a dummy state
    // This ensures the participant cards re-read the avatar changes
    setParticipants(prev => [...prev]);
  }, [syncDailyParticipants]);

  const handleAppMessage = useCallback((ev: any) => {
    if (!ev || typeof ev !== 'object') return;
    const data = (ev as any)?.data;
    if (!data || typeof data !== 'object') return;
    if ((data as any).type === 'room_ended') {
      handleForcedRoomEnd((data as any).reason);
    }

    if ((data as any).type === 'host_mute_all_audio' && (data as any).roomId === roomId) {
      const senderSessionId = (ev as any)?.fromId || (ev as any)?.from_id;
      const dailyParticipants = callObjectRef.current?.participants?.();
      const senderParticipant = senderSessionId ? (dailyParticipants as any)?.[senderSessionId] : null;
      const rawSenderUserData = senderParticipant?.userData || senderParticipant?.user_data || {};
      const senderUserData = typeof rawSenderUserData === 'string'
        ? (safeJsonParse(rawSenderUserData) || {})
        : rawSenderUserData;
      const senderProfileId = senderUserData?.profileId || senderUserData?.profile_id;
      const expectedHostProfileId = tokenData?.hostProfileId;
      const senderIsHost = !!expectedHostProfileId && !!senderProfileId && senderProfileId === expectedHostProfileId;

      if (!isHostRef.current && senderIsHost) {
        callObjectRef.current?.setLocalAudio?.(false);
        setIsMicEnabled(false);
        setScreenShareNotice('The host muted all microphones.');
      }
    }
    
    // Handle chat messages
      if ((data as any).type === 'chat') {
        const { userName, text, timestamp } = data;
        setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          userName: userName || 'Guest',
          text,
          timestamp: timestamp || 'Just now',
          isMe: false,
        },
        ]);
      }

      if ((data as any).type === 'room_refresh_requested' && (data as any).roomId === roomId) {
        syncDailyParticipants();
      }
      
      // Handle role changes broadcasted to all participants
    if ((data as any).type === 'role_changed') {
      const profileId = (data as any).profileId;
      const newRole = (data as any).newRole;
      if (profileId && newRole) {
        setRolesByProfileId((prev) => ({
          ...prev,
          [profileId]: newRole,
        }));
        // Force participant list refresh to show new roles
        setTimeout(() => {
          syncDailyParticipants();
        }, 100);
      }
    }
    }, [handleForcedRoomEnd, roomId, syncDailyParticipants, tokenData?.hostProfileId]);

  const dailyHandlers = useMemo(() => ({
    onJoinedMeeting: () => {
      setDailyJoined(true);
      setHasJoinedRoom(true);
      pushRoomDiag('daily: joined-meeting event');
      pushRoomDiag('ui: hasJoinedRoom=true');
    },
    onNonfatalError: (ev: any) => {
      try {
        const shouldDebugDaily =
          typeof window !== 'undefined' &&
          window.localStorage?.getItem('loft_debug_daily') === '1';
        if (shouldDebugDaily) {
          // intentionally no logging of event payload (may include sensitive data)
        }
      } catch {
        // ignore
      }
    },
    onParticipantJoined: () => {
      syncDailyParticipants();
      syncRemoteAudio();
    },
    onParticipantUpdated: () => {
      syncDailyParticipants();
      syncRemoteAudio();
    },
    onParticipantLeft: () => {
      syncDailyParticipants();
      syncRemoteAudio();
    },
    onTrackStarted: (ev: any) => {
      try {
        const isLocal = !!ev?.participant?.local;
        const kind = ev?.track?.kind;
        if (!isLocal && kind === 'audio') {
          syncRemoteAudio();
          return;
        }
        // Legacy backdrop apply disabled - now handled by LoftSettingsModal.applyBackground()
        // if (!isLocal || kind !== 'video') return;
        // const canVp = !!canUseVideoProcessingRef.current;
        // if (canVp) {
        //   requestApplyBackdrop(backgroundModeRef.current);
        // }
      } catch {
        // ignore
      }
    },
    onTrackStopped: () => {
      syncDailyParticipants();
      syncRemoteAudio();
    },
    onLocalScreenShareStarted: (ev: any) => {
      const localSession = callObjectRef.current?.participants?.()?.local?.session_id;
      setActiveScreenOwnerId(localSession || 'local');
      setIsScreenShareStarting(false);
      setScreenShareNotice('You are sharing. Use the browser controls or Stop sharing when you are done.');
      syncDailyParticipants();
    },
    onLocalScreenShareStopped: (ev: any) => {
      setActiveScreenTrack(null);
      setActiveScreenOwnerId(null);
      setIsScreenShareStarting(false);
      setScreenShareNotice('Screen sharing stopped.');
      syncDailyParticipants();
    },
    onLocalScreenShareCanceled: () => {
      setIsScreenShareStarting(false);
      setScreenShareNotice('Screen sharing was cancelled.');
      syncDailyParticipants();
    },
    onScreenShareStarted: (ev: any) => {
      setIsScreenShareStarting(false);
      syncDailyParticipants();
    },
    onScreenShareStopped: (ev: any) => {
      setActiveScreenTrack(null);
      setActiveScreenOwnerId(null);
      setIsScreenShareStarting(false);
      syncDailyParticipants();
    },
    onAppMessage: handleAppMessage,
  }), [handleAppMessage, setDailyJoined, setHasJoinedRoom, pushRoomDiag, syncDailyParticipants, syncRemoteAudio, canUseVideoProcessingRef, requestApplyBackdrop, backgroundModeRef]);

  useDailyEventBindings(callObject, dailyHandlers);

  useEffect(() => {
    if (dailyEnvLogRef.current) return;
    const env = (import.meta as any)?.env;
    if (!env?.DEV) return;
    dailyEnvLogRef.current = true;
  }, []);

  const dailyRoomUrl = useMemo(() => {
    const roomName = (tokenData?.dailyRoomName || '').trim();
    if (!roomName) return null;

    if (roomName.startsWith('http://') || roomName.startsWith('https://')) {
      return roomName;
    }

    const sanitizedRoom = roomName.replace(/^\/+/, '');
    return `https://${DAILY_DOMAIN}/${sanitizedRoom}`;
  }, [tokenData?.dailyRoomName]);

  useEffect(() => {
    if (!dailyRoomUrl) return;
    if (!dailyRoomUrl.includes(DAILY_DOMAIN)) {
      setJoinBlockedMessage('Daily domain misconfigured');
      throw new Error('Invalid Daily domain');
    }
  }, [dailyRoomUrl]);

  const hiddenMediaPipeline = isJoined ? (
    <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
      <video ref={videoRef} autoPlay playsInline muted />
      <canvas ref={canvasRef} />
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </div>
  ) : null;

 
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const initialDevices = await navigator.mediaDevices.enumerateDevices();
        const hasLabels = initialDevices.some((d) => !!(d.label || '').trim());
        if (!hasLabels && joinRequested) {
          try {
            const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            s.getTracks().forEach((t) => t.stop());
          } catch {
            // ignore
          }
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
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
        
        setAudioDevices(dedupedAudio);
        setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      } catch {
        // ignore
      }
    };
    loadDevices();
    window.addEventListener('loft:refresh-devices', loadDevices);
    return () => {
      window.removeEventListener('loft:refresh-devices', loadDevices);
    };
  }, [joinRequested, isIOS]);

  useEffect(() => {
    if (!selectedVideoDeviceId && videoDevices.length > 0) {
      setSelectedVideoDeviceId(videoDevices[0].deviceId);
    }
    if (!selectedAudioDeviceId && audioDevices.length > 0) {
      setSelectedAudioDeviceId(audioDevices[0].deviceId);
    }
    if (!selectedSpeakerDeviceId && audioDevices.length > 0) {
      const speakerDevices = audioDevices.filter(d => d.kind === 'audiooutput');
      if (speakerDevices.length > 0) {
        setSelectedSpeakerDeviceId(speakerDevices[0].deviceId);
      }
    }
  }, [videoDevices, audioDevices, selectedVideoDeviceId, selectedAudioDeviceId, selectedSpeakerDeviceId]);

  useEffect(() => {
    if (!selectedVideoDeviceId && !selectedAudioDeviceId) return;
    setPreferredDevices({
      videoDeviceId: selectedVideoDeviceId || null,
      audioDeviceId: selectedAudioDeviceId || null,
    });
  }, [selectedVideoDeviceId, selectedAudioDeviceId, setPreferredDevices]);

  // Unified audio analyzer to prevent conflicts and reduce static
  const createUnifiedAudioAnalyzer = useCallback((stream: MediaStream, isSetup: boolean = false) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512; // Reduced for better performance
    analyser.smoothingTimeConstant = 0.8;

    const src = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
    src.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let ema = 0;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      
      // Reduced gain from 6.0 to 2.0 to prevent clipping and static
      const normalized = Math.max(0, (avg / 255) * 2.0);
      ema = ema * 0.7 + normalized * 0.3;
      
      if (isSetup) {
        setSetupMicLevel(ema);
      } else {
        setMicLevel(ema);
      }
      
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      try { src.disconnect(); } catch { /* ignore */ }
      try { analyser.disconnect(); } catch { /* ignore */ }
      try { ctx.close(); } catch { /* ignore */ }
    };
  }, []);

  useEffect(() => {
    // Only run ONE analyzer at a time
    if (!stream) {
      setMicLevel(0);
      return;
    }
    
    // If setup is open, skip main room analyzer
    if (isSetupOpen) {
      setMicLevel(0);
      return;
    }
    
    const cleanup = createUnifiedAudioAnalyzer(stream, false);
    return cleanup;
  }, [stream, createUnifiedAudioAnalyzer, isSetupOpen]);

  useEffect(() => {
    if (!isSetupOpen) {
      setSetupMicLevel(0);
      return;
    }

    let streamLocal: MediaStream | null = null;
    let cleanup: (() => void) | null = null;

    const startSetupAnalyzer = async () => {
      try {
        const audioConstraints: MediaTrackConstraints = selectedAudioDeviceId
          ? ({ deviceId: { exact: selectedAudioDeviceId } } as any)
          : ({} as any);

        streamLocal = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
        cleanup = createUnifiedAudioAnalyzer(streamLocal, true);
      } catch {
        // ignore
      }
    };

    startSetupAnalyzer();

    return () => {
      try { streamLocal?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      if (cleanup) cleanup();
      setSetupMicLevel(0);
    };
  }, [isSetupOpen, selectedAudioDeviceId, createUnifiedAudioAnalyzer]);

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

  // Check Daily capabilities
  useEffect(() => {
    if (!callObject) return;
    
    // Check Daily capabilities
    const checkCapabilities = async () => {
      try {
        const supportedBrowser = DailyIframe.supportedBrowser();
        
        if (supportedBrowser && typeof supportedBrowser === 'object') {
        }
      } catch (e) {
        console.error('[Daily] Failed to check capabilities');
      }
    };
    
    checkCapabilities();
  }, [callObject]);

  const persistBackdropToProfile = useCallback(async (bgId: string) => {
    if (!profile?.id) return;
    try {
      const { error } = await supabase
        .from('profile')
        .update({ default_bg_id: bgId })
        .eq('id', profile.id);
      if (error) throw error;
    } catch {
      // ignore
    }
  }, [profile?.id]);

  const setBackgroundModeAndPersist = useCallback((next: BackgroundMode) => {
    const desired = blurDisabled && next === 'blur' ? 'none' : next;
    if (desired === 'blur') {
      didUserSelectBackdropRef.current = true;
    }
    if (blurDisabled && next === 'blur') {
      setBackdropNotice("Background blur isn't supported in this browser.");
      window.setTimeout(() => setBackdropNotice(null), 4000);
    }
    setBackgroundMode(desired);
    try {
      persistBackdropToProfile(desired);
    } catch {
      // ignore
    }
  }, [blurDisabled, persistBackdropToProfile]);

  useEffect(() => {
    const currentProfileId = profile?.id || 'anon';
    if (bgInitProfileIdRef.current === currentProfileId) return;
    bgInitProfileIdRef.current = currentProfileId;

    const fromProfile = (profile as any)?.defaultBgId;
    if (fromProfile) {
      if (fromProfile === 'blur' && blurDisabled) {
        setBackgroundMode('none');
        persistBackdropToProfile('none');
        return;
      }
      if (fromProfile === 'blur' || fromProfile === 'none') {
        setBackgroundMode(fromProfile as BackgroundMode);
        return;
      }
    }
    setBackgroundMode('none');
  }, [profile?.id, blurDisabled, persistBackdropToProfile]);

  useEffect(() => {
    if (!canUseVideoProcessing && backgroundMode === 'blur') {
      setBackgroundMode('none');
    }
  }, [backgroundMode, canUseVideoProcessing]);

  // Γ£à FIX: determine local role via currentProfileId (not userId)
  const currentProfileId = useMemo(
    () => tokenData?.currentUserProfile?.profileId || profile?.id || null,
    [tokenData?.currentUserProfile?.profileId, profile?.id]
  );

  const effectiveLocalRole = useMemo<LoftRole>(() => {
    const pid = currentProfileId || undefined;
    if (pid && rolesByProfileId[pid]) return rolesByProfileId[pid];
    return (tokenData?.role || LoftRole.LISTENER) as LoftRole;
  }, [rolesByProfileId, tokenData?.role, currentProfileId]);

  useEffect(() => {
    if (localHandRaised && effectiveLocalRole !== LoftRole.LISTENER) {
      setLocalHandRaised(false);
    }
  }, [localHandRaised, effectiveLocalRole]);

  const hostProfileId = useMemo(() => tokenData?.hostProfileId || null, [tokenData?.hostProfileId]);
  const isHost = useMemo(() => !!currentProfileId && !!hostProfileId && currentProfileId === hostProfileId, [currentProfileId, hostProfileId]);
  const isOnStage = useMemo(() => effectiveLocalRole !== LoftRole.LISTENER, [effectiveLocalRole]);
  const isHostish = useMemo(() => isHost || effectiveLocalRole === LoftRole.COHOST, [isHost, effectiveLocalRole]);

  const { handRaiseRequests, isHandsLoading, refreshHandRaises } = useRaisedHands(
    roomId,
    isHostish,
    { profileId: currentProfileId }
  );

  useEffect(() => {
    if (!roomId || !isHost) return;
    if (didResetHandsRef.current) return;
    didResetHandsRef.current = true;

    (async () => {
      await refreshHandRaises?.({ silent: true });
    })();
  }, [roomId, isHost, refreshHandRaises]);

  useEffect(() => {
    isHostRef.current = !!isHost;
  }, [isHost]);

  // Connect screen share track to video element
  useEffect(() => {
    const videoEl = screenRef.current;
    if (!videoEl) {
      return;
    }
    
    if (activeScreenTrack && activeScreenTrack.readyState !== 'ended') {
      const updateAspectRatio = () => {
        const settings = activeScreenTrack.getSettings?.() || {};
        const width = Number(settings.width);
        const height = Number(settings.height);
        if (width > 0 && height > 0) {
          setScreenShareAspectRatio(`${width} / ${height}`);
        }
      };

      const stream = new MediaStream([activeScreenTrack]);
      videoEl.srcObject = stream;
      videoEl.muted = true;
      videoEl.playsInline = true;
      updateAspectRatio();
      videoEl.onloadedmetadata = updateAspectRatio;
    } else {
      videoEl.srcObject = null;
      videoEl.onloadedmetadata = null;
      setScreenShareAspectRatio('16 / 9');
    }
  }, [activeScreenTrack]);

  useEffect(() => {
    const updateViewportState = () => {
      if (typeof window === 'undefined') return;
      const isSmall = window.innerWidth < 768;
      setIsPortraitMobile(isSmall && window.innerHeight > window.innerWidth);
    };

    updateViewportState();
    window.addEventListener('resize', updateViewportState);
    window.addEventListener('orientationchange', updateViewportState);
    return () => {
      window.removeEventListener('resize', updateViewportState);
      window.removeEventListener('orientationchange', updateViewportState);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const fullscreenElement = document.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;
      if (!fullscreenElement) {
        setIsScreenShareFullscreen(false);
        return;
      }
      setIsScreenShareFullscreen(fullscreenElement === screenShareFrameRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
    };
  }, []);

  const handleScreenShareFullscreen = useCallback(async () => {
    const frame = screenShareFrameRef.current;
    if (!frame) return;

    const doc = document as any;
    const fullscreenElement = document.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;

    try {
      if (isScreenShareFullscreen || fullscreenElement) {
        setIsScreenShareFullscreen(false);
        if (fullscreenElement) {
          await Promise.resolve((document.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen)?.call(document));
        }
      } else {
        setIsScreenShareFullscreen(true);
        const requestFullscreen =
          frame.requestFullscreen ||
          (frame as any).webkitRequestFullscreen ||
          (frame as any).msRequestFullscreen;
        if (requestFullscreen) {
          await Promise.resolve(requestFullscreen.call(frame));
        }
      }
    } catch {
      setIsScreenShareFullscreen((current) => !current);
    }
  }, [isScreenShareFullscreen]);

  useEffect(() => {
    setRoomStatus(null);
    setRoomEndedMessage(null);
    setJoinBlockedMessage(null);
    forcedEndHandledRef.current = false;
    setRoomInitError(null);
    setRoomDiag([]);
    setDailyJoined(false);
    setNeedsTapToJoin(false);
    tapGateSatisfiedRef.current = false;
  }, [roomId]);

  // Proper cleanup when roomId changes or component unmounts
  useEffect(() => {
    return () => {
      // Clear all speaker debounce timers
      Object.values(speakerDebounceRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      speakerDebounceRef.current = {};
      speakingStateRef.current = {};
      
      const callObject = callObjectRef.current;
      if (callObject) {
        try {
          // Stop all local tracks first
          callObject.setLocalVideo(false);
          callObject.setLocalAudio(false);
          
          // Leave the meeting
          callObject.leave();
          
          // Destroy the call object
          callObject.destroy();
          
          // Clean up singleton reference
          if (typeof window !== 'undefined' && (window as any)[dailySingletonKey] === callObject) {
            delete (window as any)[dailySingletonKey];
          }
        } catch (e) {
          console.error('Cleanup error');
        }
        callObjectRef.current = null;
        setCallObject(null);
      }
    };
  }, [roomId, dailySingletonKey]);

  const fetchRoomStatus = useCallback(async () => {
    if (!tokenData?.roomStatus) return;
    const nextStatus = tokenData.roomStatus as LoftRoomStatus;
    setRoomStatus(nextStatus);
    if (nextStatus === LoftRoomStatus.ENDED) {
      const reason = 'This table has ended.';
      setRoomEndedMessage(reason);
      setJoinBlockedMessage(reason);
      if (!isHostRef.current) {
        handleForcedRoomEnd(reason);
      }
    }
  }, [tokenData?.roomStatus, handleForcedRoomEnd]);

  useEffect(() => {
    fetchRoomStatus();
  }, [fetchRoomStatus]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`loft_room_status_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'loft_room',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const nextStatusRaw = (payload as any)?.new?.status;
          if (!nextStatusRaw) return;
          const nextStatus = nextStatusRaw as LoftRoomStatus;
          setRoomStatus(nextStatus);
          if (nextStatus === LoftRoomStatus.ENDED) {
            const reason = (payload as any)?.new?.ended_reason || 'Host ended this table.';
            setRoomEndedMessage(reason);
            setJoinBlockedMessage(reason);
            if (!isHostRef.current) {
              handleForcedRoomEnd(reason);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, handleForcedRoomEnd]);

  const triggerRoomRefresh = useCallback(async () => {
    const callObject = callObjectRef.current;
    if (!callObject?.sendAppMessage) return;
    callObject.sendAppMessage({
      type: 'room_refresh_requested',
      roomId,
      timestamp: Date.now(),
    }, '*');
  }, [roomId]);

  // Realtime: keep local UI in sync when a member's role / hand state changes
useEffect(() => {
  if (!roomId) return;

  const channel = supabase
    .channel(`loft_room_member_${roomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'loft_room_member',
        filter: `loft_room_id=eq.${roomId}`,
      },
      (payload) => {
        const nextRow = (payload as any)?.new || null;
        const prevRow = (payload as any)?.old || null;

        const profileId: string | null =
          nextRow?.profile_id || prevRow?.profile_id || null;

        if (!profileId) return;

        // 1) Update local role map so stage/listening sections re-render correctly
        const nextRole = nextRow?.role || null;
        if (nextRole) {
          setRolesByProfileId((prev) => ({
            ...prev,
            [profileId]: nextRole,
          }));
        }

        // 2) If THIS user was updated, keep local hand state in sync
        if (profile?.id && profileId === profile.id) {
          const nextHandRaised = !!nextRow?.is_hand_raised;
          setLocalHandRaised(nextHandRaised);
        }

        // 3) Force UI refresh of participants + queue display
        syncDailyParticipants();
        refreshHandRaises?.({ silent: true });
        triggerRoomRefresh();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [roomId, profile?.id, refreshHandRaises, syncDailyParticipants, triggerRoomRefresh]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`loft_room_refresh_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'loft_room',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const next = (payload as any)?.new?.last_refresh_at;
          const prev = (payload as any)?.old?.last_refresh_at;

          if (next && next !== prev) {
            syncDailyParticipants();
            refreshHandRaises?.({ silent: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, syncDailyParticipants, refreshHandRaises]);

  const localBackgroundMode = backgroundMode;

  useEffect(() => {
    // Host defaults ON, everyone else defaults OFF.
  if (!tokenData) return;

  if (isHost) {
    setIsMicEnabled(true);
    setIsVideoEnabled(true);
  } else {
    setIsMicEnabled(false);
    setIsVideoEnabled(false);
  }
}, [tokenData, isHost]);


  // Enforce: if demoted to listener while joined, force mic/cam off.
  useEffect(() => {
    if (!isJoined) return;
    if (effectiveLocalRole !== LoftRole.LISTENER) return;

    const callObject = callObjectRef.current;
    setIsMicEnabled(false);
    setIsVideoEnabled(false);
    try { callObject?.setLocalAudio(false); } catch { /* ignore */ }
    try { toggleLocalVideoSafe(false); } catch { /* ignore */ }
  }, [effectiveLocalRole, isJoined, toggleLocalVideoSafe]);

  const setMemberRole = useCallback(async (identity: MemberIdentity | null | undefined, role: LoftRole) => {
    if (!identity) return null;
    let profileId = identity.profileId || null;
    const userId = identity.userId || null;
    if (!profileId && userId) {
      profileId = userIdToProfileIdRef.current[userId] || null;
    }
    if (!profileId && !userId) return null;
    const payload: Record<string, any> = {
      loftRoomId: roomId,
      role,
    };
    if (profileId) payload.profileId = profileId;
    if (userId) payload.userId = userId;
    await callEdgeFunction('loft_set_member_role', payload);
    return profileId;
  }, [roomId]);

  const triggerReaction = useCallback((type: string) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const leftOffset = Math.max(5, Math.min(95, Math.round(Math.random() * 100)));
    const item: ActiveReaction = { id, type, timestamp: Date.now(), leftOffset };
    setReactions((prev) => [...prev, item]);
    window.setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3100);
  }, []);

  const promoteToStage = useCallback(async (identity?: MemberIdentity | null) => {
    if (!identity) return;
    try {
      const resolvedProfileId = await setMemberRole(identity, LoftRole.SPEAKER);
      if (resolvedProfileId && roomId) {
        setRolesByProfileId((prev) => ({
          ...prev,
          [resolvedProfileId]: LoftRole.SPEAKER,
        }));
      }
      await refreshHandRaises?.({ silent: true });
      syncDailyParticipants();
      await triggerRoomRefresh(); // Notify all participants of role change
      
      // Broadcast role change to all participants via Daily
      const callObject = callObjectRef.current;
      if (callObject?.sendAppMessage && resolvedProfileId) {
        callObject.sendAppMessage({ 
          type: 'role_changed', 
          profileId: resolvedProfileId,
          newRole: LoftRole.SPEAKER 
        }, '*');
      }
      
      triggerReaction('sparkles');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Promote failed');
    }
  }, [setMemberRole, triggerReaction, roomId, refreshHandRaises, syncDailyParticipants, triggerRoomRefresh]);

const demoteToAudience = useCallback(async (identity?: MemberIdentity | null) => {
  if (!identity) return;

  try {
    const resolvedProfileId = await setMemberRole(identity, LoftRole.LISTENER);

    if (resolvedProfileId) {
      setRolesByProfileId((prev) => ({
        ...prev,
        [resolvedProfileId]: LoftRole.LISTENER,
      }));
    }

    await refreshHandRaises?.({ silent: true });
    syncDailyParticipants();
    await triggerRoomRefresh(); // 🔑 THIS IS THE IMPORTANT LINE
    
    // Broadcast role change to all participants via Daily
    const callObject = callObjectRef.current;
    if (callObject?.sendAppMessage && resolvedProfileId) {
      callObject.sendAppMessage({ 
        type: 'role_changed', 
        profileId: resolvedProfileId,
        newRole: LoftRole.LISTENER 
      }, '*');
    }
  } catch (e) {
    console.error('Demote failed');
  }
}, [
  setMemberRole,
  refreshHandRaises,
  syncDailyParticipants,
  triggerRoomRefresh,
]);

  const handlePromoteHand = useCallback(async (hand?: HandRaiseRequest | null) => {
    if (!hand) return;
    await promoteToStage({ profileId: hand.profileId, userId: hand.userId });
  }, [promoteToStage]);

  const handleDemoteStageMember = useCallback(async (participant?: Participant | null) => {
    if (!participant) return;
    await demoteToAudience({ profileId: participant.profileId, userId: participant.userId });
  }, [demoteToAudience]);

  const setHandRaised = useCallback(async (next: boolean) => {
    if (isHost) {
      return;
    }
    setLocalHandRaised(next);
    try {
      await callEdgeFunction('loft_raise_hand', {
        loftRoomId: roomId,
        isHandRaised: next,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Raise hand failed');
    }
  }, [isHost, isDevEnv, roomId, hostProfileId, currentProfileId]);

  // Γ£à FIX: roles poll uses Promise.resolve(...) so withTimeout accepts it,
  // and we key results by profile_id (matches table + local role logic).
  useEffect(() => {
    if (!roomId || !tokenData?.role || !isJoined) return;
    if (!isHost) return;

    const interval = window.setInterval(async () => {
      const now = Date.now();
      if (rolesPollPausedUntilRef.current > now) return;
      if (rolesPollInFlightRef.current) return;
      rolesPollInFlightRef.current = true;

      try {
        const response = await withTimeout(
          callEdgeFunction<{ roles: Array<{ profileId: string; role: LoftRole | string }> }>(
            'loft_get_room_roles',
            { loftRoomId: roomId }
          ),
          8000,
          'roles poll timeout'
        );

        const rows = response?.roles || [];

        const next: Record<string, LoftRole> = {};
        rows.forEach((row) => {
          if (!row?.profileId) return;
          const rawRole = String(row.role || '').toUpperCase();
          const mapped =
            rawRole === 'HOST'
              ? LoftRole.HOST
              : rawRole === 'COHOST'
                ? LoftRole.COHOST
                : rawRole === 'SPEAKER'
                  ? LoftRole.SPEAKER
                  : LoftRole.LISTENER;
          next[String(row.profileId)] = mapped;
        });

        setRolesByProfileId(next);
        rolesPollFailCountRef.current = 0;
      } catch (e) {
        try {
          const shouldLogDaily =
            typeof window !== 'undefined' &&
            window.localStorage?.getItem('loft_debug_daily') === '1';
          if (shouldLogDaily) console.warn('[Loft] roles poll failed');
        } catch { /* ignore */ }
        rolesPollFailCountRef.current += 1;
        if (rolesPollFailCountRef.current >= 3) {
          rolesPollPausedUntilRef.current = Date.now() + 60000;
        }
      } finally {
        rolesPollInFlightRef.current = false;
      }
    }, 2000);

    return () => {
      window.clearInterval(interval);
    };
  }, [roomId, tokenData?.role, isJoined, isHost, withTimeout, joinNonce]);

  useEffect(() => {
    setParticipants((prev) => prev.map((p) => (
      p.isLocal ? { ...p, audio: isMicEnabled, video: isVideoEnabled } : p
    )));
  }, [isMicEnabled, isVideoEnabled]);

  const clearWaitingRetryInterval = useCallback(() => {
    if (waitingRetryIntervalRef.current) {
      window.clearInterval(waitingRetryIntervalRef.current);
      waitingRetryIntervalRef.current = null;
    }
    waitingRetryInFlightRef.current = false;
  }, []);

  const fetchJoinToken = useCallback(async () => {
    try {
      if (!waitingForHost) {
        setJoinBlockedMessage(null);
      }
      
      // Add retry logic for timing issues
      let retries = 3;
      let data: JoinTokenResponse | null = null;
      
      while (retries > 0) {
        try {
          data = await callEdgeFunction<JoinTokenResponse>('get_loft_join_token', { loftRoomId: roomId });
          break;
        } catch (e: any) {
          if (isWaitingEdgeError(e) && retries > 1) {
            retries--;
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          throw e;
        }
      }
      
      if (!data) throw new Error('Failed to get join token after retries');

      if (isDevEnv) {
      }
      setWaitingForHost(false);
      clearWaitingRetryInterval();
      setJoinBlockedMessage(null);
      setTokenData(data);
      if (data.roomStatus) {
        setRoomStatus(data.roomStatus as LoftRoomStatus);
      }
      if (data.members?.length) {
        const nextRoles: Record<string, LoftRole> = {};
        data.members.forEach((member) => {
          if (!member.profileId) return;
          nextRoles[member.profileId] = member.role || LoftRole.LISTENER;
        });
        if (data.currentUserProfile?.profileId) {
          nextRoles[data.currentUserProfile.profileId] = data.role || LoftRole.LISTENER;
        }
        setRolesByProfileId(nextRoles);
      }
      setQuestions(data.questions || []);
      return true;
    } catch (e: any) {
      if (isWaitingEdgeError(e)) {
        setWaitingForHost(true);
        setNeedsTapToJoin(false);
        setJoinBlockedMessage(WAITING_FOR_HOST_MESSAGE);

        return false;
      }
      const msg = String(e?.message || e);
      setJoinBlockedMessage(msg);
      setJoinError(msg);
      return false;
    }
  }, [roomId, isDevEnv, waitingForHost, clearWaitingRetryInterval]);

  useEffect(() => {
    fetchJoinToken();
  }, [fetchJoinToken, joinNonce]);

  useEffect(() => {
    if (!waitingForHost) {
      clearWaitingRetryInterval();
      return;
    }

    setNeedsTapToJoin(false);

    const attemptFetch = async () => {
      if (waitingRetryInFlightRef.current) return;
      waitingRetryInFlightRef.current = true;
      try {
        const success = await fetchJoinToken();
        if (success) {
          clearWaitingRetryInterval();
        }
      } finally {
        waitingRetryInFlightRef.current = false;
      }
    };

    attemptFetch();
    waitingRetryIntervalRef.current = window.setInterval(attemptFetch, 10000);

    return () => {
      clearWaitingRetryInterval();
    };
  }, [waitingForHost, fetchJoinToken, clearWaitingRetryInterval]);

  useEffect(() => {
    try { localStorage.removeItem('loft.mic.enabled'); } catch { /* ignore */ }
    try { localStorage.removeItem('loft.video.enabled'); } catch { /* ignore */ }
    setRoomInitError(null);
    setRoomDiag([]);
    setDailyJoined(false);
    setNeedsTapToJoin(false);
    tapGateSatisfiedRef.current = false;
  }, [roomId]);

  useEffect(() => {
    if (!isJoined) return;
    if (!canUseVideoProcessing && selectedBgId !== 'none') return;
    if (isPreviewOn) {
      try { stopMedia(true); } catch { /* ignore */ }
    }
  }, [isJoined, selectedBgId, canUseVideoProcessing, isPreviewOn, stopMedia]);

  useEffect(() => {
    if (!isJoined) return;
    if (!tokenData) return;
    setParticipants(prev => {
      const localProfileId = tokenData?.currentUserProfile?.profileId || profile?.id || undefined;
      const localDisplayName = tokenData?.currentUserProfile?.displayName || profile?.name || 'Guest';

      if (user?.id && localProfileId) {
        userIdToProfileIdRef.current = { ...userIdToProfileIdRef.current, [user.id]: localProfileId };
      }

      const existingIndex = prev.findIndex((p) => p.isLocal);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          id: 'local',
          name: localDisplayName,
          role: tokenData.role,
          audio: isMicEnabled,
          video: isVideoEnabled,
          isLocal: true,
          avatarUrl: localProfileAvatarUrl,
          userId: user?.id,
          profileId: localProfileId,
          instanceId: clientInstanceIdRef.current || undefined,
          joinedAt: Date.now(),
        };
        return dedupeParticipantsList(next, clientInstanceIdRef.current);
      }

      return dedupeParticipantsList([
        {
          id: 'local',
          name: localDisplayName,
          role: tokenData.role,
          audio: isMicEnabled,
          video: isVideoEnabled,
          isLocal: true,
          avatarUrl: localProfileAvatarUrl,
          userId: user?.id,
          profileId: localProfileId,
          instanceId: clientInstanceIdRef.current || undefined,
          joinedAt: Date.now(),
        },
        ...prev,
      ], clientInstanceIdRef.current);
    });
  }, [
    isJoined,
    tokenData,
    profile?.name,
    profile?.id,
    isMicEnabled,
    isVideoEnabled,
    localProfileAvatarUrl,
    tokenData?.currentUserProfile?.displayName,
    tokenData?.currentUserProfile?.profileId,
    user?.id
  ]);

  useEffect(() => {
    if (!tokenData?.token) return;
    if (roomStatus === LoftRoomStatus.ENDED) {
      const reason = roomEndedMessage || 'This table has ended.';
      setJoinBlockedMessage(reason);
      setRoomEndedMessage(reason);
      return;
    }
    if (isJoined) return;
    setIsJoined(true);
  }, [tokenData?.token, isJoined, roomStatus, roomEndedMessage]);

  useEffect(() => {
    setRoomInitError(null);
    setRoomDiag([]);
    setDailyJoined(false);
    setNeedsTapToJoin(false);
    tapGateSatisfiedRef.current = false;
  }, [roomId]);

  useEffect(() => {
    if (!isJoined) return;
    if (!canUseVideoProcessing && selectedBgId !== 'none') return;
    if (isPreviewOn) {
      try { stopMedia(true); } catch { /* ignore */ }
    }
  }, [isJoined, selectedBgId, canUseVideoProcessing, isPreviewOn, stopMedia]);

  useEffect(() => {
    if (!isJoined) return;
    if (!tokenData) return;
    setParticipants(prev => {
      const localProfileId = tokenData?.currentUserProfile?.profileId || profile?.id || undefined;
      const localDisplayName = tokenData?.currentUserProfile?.displayName || profile?.name || 'Guest';

      if (user?.id && localProfileId) {
        userIdToProfileIdRef.current = { ...userIdToProfileIdRef.current, [user.id]: localProfileId };
      }

      const existingIndex = prev.findIndex((p) => p.isLocal);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          id: 'local',
          name: localDisplayName,
          role: tokenData.role,
          audio: isMicEnabled,
          video: isVideoEnabled,
          isLocal: true,
          avatarUrl: localProfileAvatarUrl,
          userId: user?.id,
          profileId: localProfileId,
          instanceId: clientInstanceIdRef.current || undefined,
          joinedAt: Date.now(),
        };
        return dedupeParticipantsList(next, clientInstanceIdRef.current);
      }

      return dedupeParticipantsList([
        {
          id: 'local',
          name: localDisplayName,
          role: tokenData.role,
          audio: isMicEnabled,
          video: isVideoEnabled,
          isLocal: true,
          avatarUrl: localProfileAvatarUrl,
          userId: user?.id,
          profileId: localProfileId,
          instanceId: clientInstanceIdRef.current || undefined,
          joinedAt: Date.now(),
        },
        ...prev,
      ], clientInstanceIdRef.current);
    });
  }, [
    isJoined,
    tokenData,
    profile?.name,
    profile?.id,
    isMicEnabled,
    isVideoEnabled,
    localProfileAvatarUrl,
    tokenData?.currentUserProfile?.displayName,
    tokenData?.currentUserProfile?.profileId,
    user?.id
  ]);

  useEffect(() => {
    if (!tokenData?.token) return;
    if (roomStatus === LoftRoomStatus.ENDED) {
      const reason = roomEndedMessage || 'This table has ended.';
      setJoinBlockedMessage(reason);
      setRoomEndedMessage(reason);
      return;
    }
    if (isJoined) return;
    setIsJoined(true);
  }, [tokenData?.token, isJoined, roomStatus, roomEndedMessage]);

  useEffect(() => {
    if (!joinRequested) {
      if ((isIOS || isStandalonePWA) && !tapGateSatisfiedRef.current) {
        setNeedsTapToJoin(true);
      }
      return;
    }

    if (!tokenData?.token || !dailyRoomUrl) {
      try {
        const shouldDebugDaily =
          typeof window !== 'undefined' &&
          window.localStorage?.getItem('loft_debug_daily') === '1';
        if (shouldDebugDaily) {
          // intentionally no logging of URLs / token presence in console
        }
      } catch {
        // ignore
      }
      return;
    }

    if ((isIOS || isStandalonePWA) && !tapGateSatisfiedRef.current) {
      setNeedsTapToJoin(true);
      pushRoomDiag('daily: waiting for user tap (iOS/PWA)');
      return;
    }

    if (!isJoined) return;

    if ((isIOS || isStandalonePWA) && !tapGateSatisfiedRef.current) {
      setNeedsTapToJoin(true);
      pushRoomDiag('daily: waiting for user tap (iOS/PWA)');
      return;
    }

    if (hasAttemptedJoinRef.current) return;
    hasAttemptedJoinRef.current = true;

    if (callObjectRef.current) return;

    const existing = (typeof window !== 'undefined' ? (window as any)[dailySingletonKey] : null);
    if (existing) {
      callObjectRef.current = existing;
      setCallObject(existing);
    } else {
      try {
        const callObject = DailyIframe.createCallObject({
          useLegacyVideoProcessor: true,
        } as any);
        callObjectRef.current = callObject;
        setCallObject(callObject);
        try {
          if (typeof window !== 'undefined') (window as any)[dailySingletonKey] = callObject;
        } catch {
          // ignore
        }
      } catch (e: any) {
        const maybeExisting = (typeof window !== 'undefined' ? (window as any)[dailySingletonKey] : null);
        if (maybeExisting) {
          callObjectRef.current = maybeExisting;
          setCallObject(maybeExisting);
        } else {
          throw e;
        }
      }
    }

    const callObject = callObjectRef.current;
    if (!callObject) return;

    try {
      const shouldDebugDaily =
        typeof window !== 'undefined' &&
        window.localStorage?.getItem('loft_debug_daily') === '1';
      if (shouldDebugDaily) {
        (window as any).__loftDaily = callObject;
      }
    } catch {
      // ignore
    }

    const handleNonfatal = async (ev: any) => {
      try {
        const shouldDebugDaily =
          typeof window !== 'undefined' &&
          window.localStorage?.getItem('loft_debug_daily') === '1';
        if (shouldDebugDaily) {
          // eslint-disable-next-line no-console
          // intentionally no logging of event payload (may include sensitive data)
        }
      } catch {
        // ignore
      }
    };

    const attachCallObjectForDebug = () => {
      try {
        if (typeof window !== 'undefined' && callObjectRef.current) {
          (window as any).__loftDaily = callObjectRef.current;
        }
      } catch {
        // ignore
      }
    };

    attachCallObjectForDebug();

    const handleJoined = async () => {
      attachCallObjectForDebug();
      
      try {
        // 1. Set devices FIRST and WAIT
        const vidId = selectedVideoDeviceIdRef.current;
        const audId = selectedAudioDeviceIdRef.current;

        if (vidId || audId) {
          await Promise.resolve(
            setInputDevices({
              camId: vidId || undefined,
              micId: audId || undefined,
            })
          );
          
          // Wait for devices to stabilize
          await new Promise(r => setTimeout(r, 500));
        }

        // 2. Then set audio/video state
        const storedMic = (() => {
          try { return localStorage.getItem('loft.mic.enabled'); } catch { return null; }
        })();
        const storedVid = (() => {
          try { return localStorage.getItem('loft.video.enabled'); } catch { return null; }
        })();

        const isHostRole = isHost;
        const initMicOn = isHostRole ? true : (storedMic === '1');
        const initVideoOn = isHostRole ? true : (storedVid === '1');

        setIsMicEnabled(initMicOn);
        setIsVideoEnabled(initVideoOn);

        // Sequence audio/video setup with delays
        await Promise.resolve(callObject.setLocalAudio(initMicOn));
        await new Promise(r => setTimeout(r, 200));
        
        await toggleLocalVideoSafe(initVideoOn);
        await new Promise(r => setTimeout(r, 200));

        // 3. Audio unlock
        if (pendingAudioUnlockRef.current && !audioUnlockedRef.current) {
          try {
            await Promise.resolve((callObject as any).startAudio?.());
            audioUnlockedRef.current = true;
          } catch {
            // ignore
          }
        }

        // 4. Finally sync remote audio
        syncRemoteAudio();

      } catch (e) {
        console.error('Join setup failed');
      }
      pushRoomDiag('ui: hasJoinedRoom=true');
    };

    const handleUpdate = () => {
      syncDailyParticipants();
      syncRemoteAudio();
    };

    const handleTrackStarted = async (ev: any) => {
  try {
    const isLocal = !!ev?.participant?.local;
    const kind = ev?.track?.kind;

    // If remote audio track started, sync audio
    if (!isLocal && kind === 'audio') {
      syncRemoteAudio();
      return;
    }

    // Legacy backdrop apply disabled - now handled by LoftSettingsModal.applyBackground()
    // if (!isLocal || kind !== 'video') return;
    // const canVp = !!canUseVideoProcessingRef.current;
    // if (canVp) {
    //   requestApplyBackdrop(backgroundModeRef.current);
    // }
  } catch {
    // ignore
  }
};

    (async () => {
      const joinKey = `${dailyRoomUrl}::${tokenData.token}`;
      if (lastDailyJoinKeyRef.current === joinKey) return;
      if (dailyJoinInFlightRef.current) return;
      dailyJoinInFlightRef.current = true;

      try {
        const state = typeof (callObject as any).meetingState === 'function' ? (callObject as any).meetingState() : null;
        if (state && state !== 'left-meeting') {
          try { await Promise.resolve(callObject.leave()); } catch { /* ignore */ }
        }
      } catch {
        // ignore
      }

      let joiningGuardTimeout: number | null = null;
      const clearJoiningGuard = () => {
        if (joiningGuardTimeout !== null) {
          window.clearTimeout(joiningGuardTimeout);
          joiningGuardTimeout = null;
        }
        isJoiningRef.current = false;
      };

      try {
        setRoomInitError(null);
        pushRoomDiag('daily: join start');
        const joinPayload: Record<string, any> = {
          url: dailyRoomUrl,
          token: tokenData.token,
          userName: userNameRef.current || 'Guest',
        };
        const participantProfileId = currentProfileId || tokenData?.currentUserProfile?.profileId || profile?.id || undefined;
        const clientInstanceId = clientInstanceIdRef.current || generateInstanceId();
        joinPayload.userData = {
          profileId: participantProfileId,
          instanceId: clientInstanceId,
        };

        if (isIOS && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          try {
            isJoiningRef.current = true;
            joiningGuardTimeout = window.setTimeout(() => {
              isJoiningRef.current = false;
              joiningGuardTimeout = null;
            }, 5000);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            stream?.getTracks?.().forEach((track) => {
              try {
                track.stop();
              } catch {
                // ignore
              }
            });
            pushRoomDiag('daily: gUM ok');
          } catch (gumError: any) {
            pushRoomDiag('daily: gUM denied');
            clearJoiningGuard();
            const msg = gumError?.message || 'Microphone or camera permission denied.';
            setRoomInitError(msg);
            setJoinBlockedMessage(msg);
            hasAttemptedJoinRef.current = false;
            dailyJoinInFlightRef.current = false;
            return;
          }
        }

        pushRoomDiag('daily: join() called');
        await Promise.resolve(callObject.join(joinPayload) as any);
        pushRoomDiag('daily: join() resolved');
        clearJoiningGuard();
        try {
          if (typeof callObject.setUserData === 'function') {
            await Promise.resolve(callObject.setUserData(joinPayload.userData));
          }
        } catch {
          // ignore
        }
        lastDailyJoinKeyRef.current = joinKey;
      } catch (e: any) {
        const msg = e?.message || String(e);
        pushRoomDiag(`daily: join() ERROR: ${msg}`);
        setRoomInitError(msg);
        setJoinBlockedMessage(msg);
        hasAttemptedJoinRef.current = false;
        clearJoiningGuard();
      } finally {
        clearJoiningGuard();
        dailyJoinInFlightRef.current = false;
      }
    })();

    return () => {
      try {
        const isSingleton = typeof window !== 'undefined' && (window as any)[dailySingletonKey] === callObject;
        if (!isSingleton) {
          try { callObject.destroy(); } catch { /* ignore */ }
        }
      } catch {
        // ignore
      }
      callObjectRef.current = null;
      setCallObject(null);
      hasAttemptedJoinRef.current = false;
      setHasJoinedRoom(false);
    };
  }, [
    isJoined,
    tokenData?.token,
    dailyRoomUrl,
    tokenData?.dailyRoomName,
    tokenData?.role,
    toggleLocalVideoSafe,
    syncDailyParticipants,
    syncRemoteAudio,
    requestApplyBackdrop,
    currentProfileId,
    joinRequested,
    isIOS,
    isStandalonePWA,
  ]);

  // Legacy backdrop apply disabled - now handled by LoftSettingsModal.applyBackground()
  // useEffect(() => {
  //   if (!isJoined) return;
  //   if (!canUseVideoProcessing) return;
  //   try {
  //     requestApplyBackdrop(backgroundMode);
  //   } catch {
  //     // ignore
  //   }
  // }, [isJoined, canUseVideoProcessing, backgroundMode, requestApplyBackdrop]);

  useEffect(() => {
    try {
      const co = callObjectRef.current;
      if (!co) return;
      const shouldDebugDaily =
        typeof window !== 'undefined' &&
        window.localStorage?.getItem('loft_debug_daily') === '1';
      if (!shouldDebugDaily) return;
      (window as any).__loftDaily = co;
    } catch {
      // ignore
    }
  }, [isJoined]);

  const upvoteQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, upvotes: (q.upvotes || 0) + 1 } : q));
  }, []);

  const votePoll = useCallback((pollId: string, optId: string) => {
    setPolls((prev) =>
      prev.map((p) => {
        if (p.id !== pollId) return p;
        if ((p as any).hasVoted) return p;
        const nextOptions = p.options.map((o: any) => {
          if (o.id !== optId) return o;
          return { ...o, votes: (o.votes || 0) + 1 };
        });
        const totalVotes = nextOptions.reduce((sum: number, option: any) => sum + (option.votes || 0), 0);
        return { ...p, options: nextOptions, totalVotes, hasVoted: true } as any;
      })
    );
  }, []);

  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !callObjectRef.current) return;

    const messagePayload = {
      type: 'chat',
      userName: profile?.name || 'You',
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Broadcast to all participants
    try {
      callObjectRef.current.sendAppMessage(messagePayload, '*');
    } catch {
      // ignore send errors
    }

    // Add to local UI immediately
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        userName: messagePayload.userName,
        text: messagePayload.text,
        timestamp: messagePayload.timestamp,
        isMe: true,
      },
    ]);
    setChatInput('');
    setTimeout(() => {
      if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [chatInput, profile?.name]);

  const handleSendQuestion = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim()) return;
    setQuestions((prev) => [
      {
        id: Date.now().toString(),
        userId: profile?.id || 'me',
        userName: profile?.name || 'You',
        text: qaInput,
        createdAt: new Date().toISOString(),
        upvotes: 0,
      } as any,
    ]);
    setQaInput('');
  }, [qaInput, profile?.id, profile?.name]);

  const handleToggleMic = useCallback(async () => {
    const callObject = callObjectRef.current;
    if (!callObject) return;
    
    try {
      // Get CURRENT state from Daily
      const currentState = callObject.localAudio();
      const newState = !currentState;
      
      // Set the NEW state directly
      await callObject.setLocalAudio(newState);
      setIsMicEnabled(newState);
      
      try {
        localStorage.setItem('loft.mic.enabled', newState ? '1' : '0');
      } catch { /* ignore */ }
    } catch (e) {
      console.error('Toggle mic failed');
    }
  }, []);

  const handleToggleVideo = useCallback(async () => {
    const callObject = callObjectRef.current;
    if (!callObject) return;
    
    try {
      // Get CURRENT state from Daily
      const currentState = callObject.localVideo();
      const newState = !currentState;
      
      // Set the NEW state directly
      await callObject.setLocalVideo(newState);
      setIsVideoEnabled(newState);
      
      try {
        localStorage.setItem('loft.video.enabled', newState ? '1' : '0');
      } catch { /* ignore */ }
    } catch (e) {
      console.error('Toggle video failed');
    }
  }, []);

  const handleToggleHand = useCallback(async () => {
    if (isHost) return;
    try {
      await setHandRaised(!localHandRaised);
    } catch {
      // ignore
    }
  }, [isHost, localHandRaised, setHandRaised]);

  const handleToggleScreenShare = useCallback(async () => {
    const callObject = callObjectRef.current;
    if (!callObject) {
      setScreenShareNotice('Join the session before sharing your screen.');
      return;
    }

    const localParticipant = callObject.participants()?.local;
    const localSession = localParticipant?.session_id;
    const localScreenVideo = localParticipant?.tracks?.screenVideo;
    const localScreenTrack = getDailyScreenTrack(localScreenVideo);
    const screenOwnerId = activeScreenOwnerId || null;
    const isLocalTrackOwner = !!localScreenTrack && !!activeScreenTrack && localScreenTrack.id === activeScreenTrack.id;
    const isLocalOwner = isDailyScreenVideoActive(localScreenVideo) ||
      isLocalTrackOwner ||
      (!!localSession && !!screenOwnerId && screenOwnerId === localSession) ||
      screenOwnerId === 'local';
    const someoneElseSharing = !!screenOwnerId && !!localSession && screenOwnerId !== localSession && screenOwnerId !== 'local';
    const isCurrentlySharing = isDailyScreenVideoActive(localScreenVideo) || isLocalTrackOwner || isLocalOwner;

    if (!screenShareSupport.supported && !isCurrentlySharing && !isLocalOwner) {
      setScreenShareNotice(screenShareSupport.message || 'Screen sharing is not available in this browser.');
      return;
    }

    try {
      if (isCurrentlySharing || isLocalOwner) {
        setScreenShareNotice('Stopping screen share...');
        await callObject.stopScreenShare();
        setActiveScreenTrack(null);
        setActiveScreenOwnerId(null);
        setIsScreenShareStarting(false);
        setScreenShareNotice('Screen sharing stopped.');
      } else if (activeScreenTrack || someoneElseSharing) {
        setScreenShareNotice('Another participant is sharing. Ask them to stop before you share.');
      } else {
        setIsScreenShareStarting(true);
        setScreenShareNotice('Choose a window or tab in the browser picker. Entire screen can expose more than intended.');
        try {
          await callObject.startScreenShare();
          setActiveScreenOwnerId(localSession || 'local');
          setScreenShareNotice('Waiting for the browser to start sharing...');

          window.setTimeout(() => {
            const latestLocal = callObjectRef.current?.participants?.()?.local;
            const latestScreenVideo = latestLocal?.tracks?.screenVideo;
            if (!isDailyScreenVideoActive(latestScreenVideo)) {
              setIsScreenShareStarting(false);
              setScreenShareNotice('Screen sharing did not start. Try again and choose a tab or window in the browser picker.');
            }
            syncDailyParticipants();
          }, 2500);
        } catch (screenShareError: any) {
          setIsScreenShareStarting(false);
          setScreenShareNotice(describeScreenShareError(screenShareError));
          return;
        }
      }

      window.setTimeout(() => {
        syncDailyParticipants();
      }, 500);
    } catch (err: any) {
      setIsScreenShareStarting(false);
      setScreenShareNotice(describeScreenShareError(err));
    }
  }, [activeScreenOwnerId, activeScreenTrack, screenShareSupport, syncDailyParticipants]);

  const handleMuteAll = useCallback(async () => {
    const callObject = callObjectRef.current;
    if (!callObject || !isHost) {
      setScreenShareNotice('Only the host can mute participants.');
      return;
    }

    try {
      const dailyParticipants = callObject.participants?.();
      if (!dailyParticipants) {
        setScreenShareNotice('No participants are connected yet.');
        return;
      }

      const remoteParticipants = Object.entries(dailyParticipants)
        .filter(([sessionId, participant]: [string, any]) => {
          const isLocalParticipant = sessionId === 'local' || participant?.local === true;
          return !isLocalParticipant && participant?.session_id;
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
        if (typeof callObject.updateParticipants === 'function') {
          await Promise.resolve(callObject.updateParticipants(directMuteUpdates));
        }
      } catch {
        // Daily app message below is the reliable cross-client path.
      }

      await callObject.sendAppMessage({
        type: 'host_mute_all_audio',
        roomId,
        requestedAt: new Date().toISOString(),
      }, '*');

      setScreenShareNotice(`Muted ${remoteParticipants.length} participant${remoteParticipants.length === 1 ? '' : 's'}.`);
    } catch {
      setScreenShareNotice('Mute all could not be sent. Check the session connection and try again.');
    }
  }, [isHost, roomId]);

  const handleLeave = useCallback(async ({ triggerSummary }: { triggerSummary?: boolean } = {}) => {
    await leaveDailyMeeting();
    setHasJoinedRoom(false);

    if (triggerSummary && isHost) {
      setIsWrappingUp(true);
      const transcript = messages.map(m => `${m.userName}: ${m.text}`).join('\n').trim();
      if (!transcript) {
        setFinalSummary('No transcript to summarize yet.');
        return;
      }
      const summary = await getLoftRoomSummary(transcript);
      setFinalSummary(summary);
      return;
    }

    onLeave();
  }, [leaveDailyMeeting, isHost, messages, getLoftRoomSummary, onLeave]);

  const handleHostEndRoom = useCallback(async () => {
    try {
      await endRoomForAll();
    } finally {
      await handleLeave({ triggerSummary: true });
    }
  }, [endRoomForAll, handleLeave]);

  const isSuperUser = !!((profile as any)?.is_loft_admin || (profile as any)?.user_type_id === 5);

  const displayParticipants = useMemo(() => {
    if (!isSuperUser || !previewParticipantsEnabled) return participants;

    const existingNames = new Set(participants.map((participant) => participant.name.trim().toLowerCase()));
    const mockParticipants: Participant[] = LOFT_PREVIEW_LISTENER_NAMES
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .map((name, index) => ({
        id: `loft-preview-listener-${index + 1}`,
        name,
        role: LoftRole.LISTENER,
        audio: index === 1 || index === 8,
        video: false,
        isLocal: false,
        isOnStage: false,
        joinedAt: Date.now() + index,
      }));

    return dedupeParticipantsList([...participants, ...mockParticipants], clientInstanceIdRef.current);
  }, [isSuperUser, participants, previewParticipantsEnabled]);

  const handleTogglePreviewParticipants = useCallback(() => {
    setPreviewParticipantsEnabled((current) => {
      const next = !current;
      try {
        if (next) {
          localStorage.setItem(LOFT_SESSION_PREVIEW_KEY, '1');
        } else {
          localStorage.removeItem(LOFT_SESSION_PREVIEW_KEY);
        }
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const stageParticipants = useMemo(
    () =>
      displayParticipants
        .filter((p) => p.role !== LoftRole.LISTENER || (hostProfileId && p.profileId === hostProfileId))
        .sort((a, b) => (b.isLocal ? 1 : 0) - (a.isLocal ? 1 : 0)),
    [displayParticipants, hostProfileId]
  );

  const listenerParticipants = useMemo(
    () =>
      displayParticipants
        .filter(
          (p) =>
            p.role === LoftRole.LISTENER &&
            (!hostProfileId || p.profileId !== hostProfileId)
        )
        .sort((a, b) => (b.isLocal ? 1 : 0) - (a.isLocal ? 1 : 0)),
    [displayParticipants, hostProfileId]
  );

  const stageCount = stageParticipants.length;
  const stageGridClass =
    stageCount <= 1
      ? 'flex justify-center'
      : stageCount === 2
        ? 'grid grid-cols-1 xs:grid-cols-2'
        : 'grid grid-cols-2 lg:grid-cols-3';
  const stageCardClass =
    stageCount <= 1
      ? 'w-full max-w-[11rem] xs:max-w-[12rem] md:max-w-[14rem] xl:max-w-[16rem]'
      : stageCount === 2
        ? 'w-full max-w-[12rem] md:max-w-[14rem] xl:max-w-[16rem]'
        : 'w-full max-w-[10.5rem] xs:max-w-[12rem] md:max-w-[14rem]';

  const localParticipant = callObjectRef.current?.participants?.()?.local;
  const localScreenVideo = localParticipant?.tracks?.screenVideo;
  const localScreenTrack = getDailyScreenTrack(localScreenVideo);
  const isLocalDailyScreenSharing = isDailyScreenVideoActive(localScreenVideo);
  const canStopScreenShare = isLocalDailyScreenSharing ||
    (!!localScreenTrack && !!activeScreenTrack && localScreenTrack.id === activeScreenTrack.id) ||
    activeScreenOwnerId === 'local';
  const remoteParticipantCount = participants.filter((participant) => !participant.isLocal).length;
  const hasUnmutedParticipants = participants.some((participant) => !participant.isLocal && participant.audio);

  const scheduledStartAtMs = useMemo(() => {
    const v = tokenData?.scheduledStartAt;
    if (!v) return null;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : null;
  }, [tokenData?.scheduledStartAt]);

  const canTakeSeat = useMemo(() => {
    if (!scheduledStartAtMs) return true;
    return Date.now() >= scheduledStartAtMs;
  }, [scheduledStartAtMs]);

  
  // Diagnostics UI removed (kept internal roomDiag logging).

  if (isWrappingUp) {
    return (
      <>
        
        <div className="fixed inset-0 z-[500] bg-[var(--loft-bg)] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
        <AnimatedBackgroundBlobs />
        {hiddenMediaPipeline}
        <div className="max-w-xl w-full space-y-12 relative z-10">
          <div className="flex justify-center">
            <Sparkles className="w-16 h-16 text-cafe animate-pulse drop-shadow-[0_0_25px_rgba(37,99,235,0.45)]" />
          </div>
          <h2 className="text-3xl font-black text-main uppercase tracking-tighter">
            {tokenData?.roomTitle ? `Summary: ${tokenData.roomTitle}` : 'Session Summary'}
          </h2>
          {finalSummary && (
            <div className="loft-card loft-card--flat bg-[var(--loft-surface)] rounded-[2.5rem] p-12 text-left shadow-2xl text-main">
              <p className="text-main/80 leading-relaxed whitespace-pre-wrap">{finalSummary}</p>
              <button onClick={onLeave} className="w-full mt-8 bg-cafe text-white font-bold py-6 rounded-2xl text-[14px] uppercase tracking-[0.3em] shadow-lg shadow-cafe/30">Finish</button>
            </div>
          )}
          {!finalSummary && (
            <div className="loft-card loft-card--flat bg-[var(--loft-surface)] rounded-[2.5rem] p-12 text-center shadow-2xl text-main">
              <p className="text-main/70 text-sm md:text-base">No transcript to summarize yet.</p>
              <button onClick={onLeave} className="w-full mt-8 bg-cafe text-white font-bold py-6 rounded-2xl text-[14px] uppercase tracking-[0.3em] shadow-lg shadow-cafe/30">Finish</button>
            </div>
          )}
        </div>
        </div>
      </>
    );
  }

  const waitingGateProps = waitingForHost
    ? {
        title: 'Waiting for host',
        tapLabel: 'Waiting for host...',
        tapDisabled: true,
      }
    : {};

  if (!joinRequested) {
    if (typeof document === 'undefined') return null;
    return createPortal(
      <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 2147483647 }}>
          <JoinGateScreen
            title={needsTapToJoin ? 'Tap to join' : undefined}
            joinBlockedMessage={joinBlockedMessage}
            roomInitError={roomInitError}
            onTap={waitingForHost ? undefined : handleTapToJoin}
            showDiagnostics={showRoomDiag}
            diagnostics={roomDiag}
            {...waitingGateProps}
          />
        </div>
      </>,
      document.body
    );
  }

  if (!tokenData || !isJoined) {
    return (
      <>
        <JoinGateScreen
          title={needsTapToJoin ? 'Tap to join' : waitingForHost ? 'Waiting for host' : undefined}
          joinBlockedMessage={joinBlockedMessage}
          roomInitError={roomInitError}
          onTap={waitingForHost ? undefined : handleTapToJoin}
          showDiagnostics={showRoomDiag}
          diagnostics={roomDiag}
          tapLabel={waitingForHost ? 'Waiting for host...' : undefined}
          tapDisabled={waitingForHost}
        />
        {isIOSDebug && debugMessages.length > 0 && (
          <div className="fixed bottom-4 left-4 right-4 z-[2147483648] p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl max-w-md">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">LoftRoom iOS Debug:</p>
            {debugMessages.map((msg, idx) => (
              <p key={idx} className="text-xs text-blue-600 dark:text-blue-400 font-mono">{msg}</p>
            ))}
          </div>
        )}
      </>
    );
  }

  if (!dailyJoined) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--loft-bg)] text-center">
        <AnimatedBackgroundBlobs />
        {hiddenMediaPipeline}
        <div className="relative z-10 w-[min(92vw,24rem)] rounded-2xl border border-[var(--loft-border)] bg-[var(--loft-surface)]/72 px-6 py-5 text-main shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-4 h-1.5 w-24 overflow-hidden rounded-full bg-[var(--loft-surface-2)]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-cafe" />
          </div>
          <div className="text-[11px] font-black uppercase tracking-[0.28em] text-main/70 dark:text-white/70">
            Connecting to the session
          </div>
        </div>
      </div>
    );
  }

  const joinedRoomUI = (
    <>
      <div id="loft-room-header-shell" className="fixed top-0 left-0 right-0 z-[100] pointer-events-auto">
        <div id="loft-room-header">
          <RoomHeader
            roomTitle={tokenData?.roomTitle}
            participantCount={displayParticipants.length}
            isRecorded={tokenData?.isRecorded ?? false}
            onOpenSetup={() => setIsSetupOpen(true)}
            queueCount={isHostish ? handRaiseRequests.length : 0}
            onOpenQueue={isHostish ? openQueue : undefined}
            previewEnabled={previewParticipantsEnabled}
            onTogglePreview={isSuperUser ? handleTogglePreviewParticipants : undefined}
          />
        </div>
      </div>

      {createPortal(
        <div id="loft-joined-root" className="fixed inset-0 bg-transparent fixed-safe-area overflow-visible md:overflow-hidden">
          <div id="loft-blobs" className="fixed inset-0 z-0 pointer-events-none">
            <AnimatedBackgroundBlobs />
          </div>
          <div ref={foregroundRef} id="loft-daily-wrap" className="relative z-10 flex flex-col h-full">
            {hiddenMediaPipeline}

            {backdropNotice && (
              <div className="fixed top-20 md:top-24 left-1/2 -translate-x-1/2 z-[300]">
                <div className="px-4 py-2 rounded-xl bg-black/70 text-white text-[10px] font-bold uppercase tracking-[0.25em] shadow-2xl">
                  {backdropNotice}
                </div>
              </div>
            )}

            {screenShareNotice && (
              <div className="fixed bottom-24 left-1/2 z-[300] w-[min(92vw,34rem)] -translate-x-1/2">
                <div className="rounded-lg border border-[var(--loft-border)] bg-[var(--loft-surface)]/95 px-4 py-3 text-center text-xs font-semibold text-[var(--loft-text)] shadow-xl backdrop-blur-xl">
                  {screenShareNotice}
                </div>
              </div>
            )}

            <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>
              <div className="flex-1 flex overflow-hidden relative">
                <div
                  className={`flex-1 overflow-y-auto px-4 pb-4 pt-5 md:px-8 md:pb-5 md:pt-8 no-scrollbar transition-all duration-500 ${
                    isSidebarOpen ? 'md:mr-[400px]' : ''
                  }`}
                >
                  <div className={`mx-auto w-full ${isScreenShareFullscreen ? 'mb-0 max-w-none' : 'mb-6 max-w-[96rem] md:mb-8'} ${activeScreenTrack ? '' : 'hidden'}`}>
                    <div
                      ref={screenShareFrameRef}
                      className={`relative flex w-full flex-col items-center justify-center overflow-hidden border border-cafe/25 bg-[var(--loft-bg)]/45 p-2 shadow-2xl shadow-cafe/10 md:p-4 ${
                        isScreenShareFullscreen
                          ? 'fixed inset-0 z-[1600] h-[100dvh] rounded-none bg-black p-2 md:p-3'
                          : 'min-h-[52vh] rounded-xl md:min-h-[60vh]'
                      }`}
                    >
                      {isPortraitMobile && (
                        <div className="mb-2 flex w-full items-center gap-3 rounded-lg border border-cafe/30 bg-[var(--loft-surface)]/95 px-3 py-2 text-left shadow-xl backdrop-blur-md md:hidden">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-cafe/15 text-cafe">
                            <RotateCw className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--loft-text)]">Rotate for screen share</div>
                            <div className="mt-0.5 text-[11px] font-semibold text-muted">Landscape gives shared screens more usable space.</div>
                          </div>
                        </div>
                      )}
                      <div
                        className={`relative flex w-full max-w-full items-center justify-center overflow-hidden bg-black shadow-2xl ring-1 ring-white/10 ${
                          isScreenShareFullscreen ? 'h-full rounded-none' : 'max-h-full rounded-lg'
                        }`}
                        style={{ aspectRatio: screenShareAspectRatio }}
                      >
                        <video ref={screenRef} autoPlay playsInline muted className="block h-full w-full object-fill" />
                        <div className="absolute left-4 top-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/70 text-white text-[10px] font-black uppercase tracking-[0.2em] border border-white/15 backdrop-blur-md">
                          <span className="w-2 h-2 rounded-full bg-cafe animate-pulse" />
                          Screen sharing
                        </div>
                      </div>
                      <div className="absolute right-3 top-3 flex gap-2 md:right-4 md:top-4">
                        <button
                          type="button"
                          onClick={handleScreenShareFullscreen}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/15"
                          title={isScreenShareFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
                          aria-label={isScreenShareFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
                        >
                          {isScreenShareFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        {canStopScreenShare && (
                          <button
                            type="button"
                            onClick={handleToggleScreenShare}
                            className="flex h-10 items-center gap-2 rounded-lg border border-rose-300/25 bg-rose-500/18 px-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-lg backdrop-blur-md transition-colors hover:bg-rose-500/30"
                            title="Stop sharing screen"
                            aria-label="Stop sharing screen"
                          >
                            <MonitorOff className="h-4 w-4" />
                            Stop
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <section id="loft-stage-section" className="loft-stage-section space-y-3 md:space-y-4 mb-5 md:mb-7">
                    <div className="flex items-center gap-4">
                      <div className="h-[px] flex-1 bg-black/10 dark:bg-white/5" />
                      <h2 className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.6em] text-main/50 dark:text-white/70 px-4 whitespace-nowrap">
                        Leading the Chat
                      </h2>
                      <div className="h-[px] flex-1 bg-black/10 dark:bg-white/5" />
                    </div>
                    <div className={`loft-stage-grid ${stageGridClass} gap-3 md:gap-6 max-w-7xl mx-auto place-items-center`}>
                      {stageParticipants.map((participant) => (
                        <div key={participant.id} className={`loft-stage-card ${stageCardClass}`}>
                          <ParticipantCard
                            participant={participant}
                            isHost={isHost}
                            localBackgroundMode={participant.isLocal ? localBackgroundMode : undefined}
                            aspectClassName="aspect-[1.08/1] loft-stage-card-aspect"
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section id="loft-listener-section" className="mx-auto w-full max-w-[96rem] space-y-3 pb-44 md:pb-44 xl:pb-36">
                    <div className="flex items-center justify-between gap-4 px-1">
                      <h2 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.42em] text-main/50 dark:text-white/60">
                        Participants
                      </h2>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--loft-border)] bg-[var(--loft-surface-2)]/70 text-muted transition-colors hover:bg-[var(--loft-surface-strong)]/80 hover:text-[var(--loft-text)]"
                          onClick={() => scrollListenerTrack('left')}
                          aria-label="Scroll participants left"
                          data-loft-tooltip="Scroll left"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="rounded-full border border-[var(--loft-border)] bg-[var(--loft-surface-2)]/60 px-3 py-1 text-[9px] font-black uppercase tracking-[0.24em] text-main/45 dark:text-white/45">
                          {listenerParticipants.length}
                        </span>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--loft-border)] bg-[var(--loft-surface-2)]/70 text-muted transition-colors hover:bg-[var(--loft-surface-strong)]/80 hover:text-[var(--loft-text)]"
                          onClick={() => scrollListenerTrack('right')}
                          aria-label="Scroll participants right"
                          data-loft-tooltip="Scroll right"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className={`relative -mx-4 md:-mx-6 ${listenerParticipants.length === 0 ? 'hidden' : ''}`}>
                      <div
                        ref={listenerTrackRef}
                        className="loft-scrollbar-hidden max-w-full overflow-x-auto overflow-y-hidden scroll-smooth bg-transparent px-4 pb-4 md:px-6"
                        style={{
                          overscrollBehaviorX: 'contain',
                          background: 'transparent',
                          backgroundImage: 'none',
                          backdropFilter: 'none',
                          WebkitBackdropFilter: 'none',
                        }}
                      >
                        <div className="loft-listener-track mx-auto grid w-max auto-cols-[9.5rem] grid-flow-col grid-rows-1 gap-3 bg-transparent md:auto-cols-[10rem] md:gap-4 xl:grid-rows-2">
                          {listenerParticipants.map((participant) => (
                            <div
                              key={participant.id}
                              className="group relative flex w-full flex-col items-center gap-2 rounded-2xl border border-[var(--loft-border)] bg-transparent px-3 pb-3 pt-4 shadow-none transition-colors hover:border-cafe/35 hover:bg-white/[0.04] md:px-4 md:pt-5"
                            >
                              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[var(--loft-border)] bg-transparent text-lg font-black text-cafe/80 md:h-16 md:w-16">
                                {participant.avatarUrl ? (
                                  <img src={participant.avatarUrl} className="h-full w-full object-cover" alt={participant.name} />
                                ) : (
                                  participant.name?.[0] || '?'
                                )}
                              </div>
                              <div className="min-w-0 text-center">
                                <div className="max-w-[7.5rem] truncate text-[10px] font-black uppercase tracking-[0.14em] text-main dark:text-white md:max-w-[9rem]">
                                  {participant.name || 'Guest'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <div id="loft-sidebar">
                </div>
              </div>
            </div>

            {!dailyJoined && (needsTapToJoin || !!roomInitError || !!joinBlockedMessage) && (
              <JoinGateScreen
                joinBlockedMessage={joinBlockedMessage}
                roomInitError={roomInitError}
                onTap={waitingForHost ? undefined : handleTapToJoin}
                showDiagnostics={showRoomDiag}
                diagnostics={roomDiag}
                title={needsTapToJoin ? 'Tap to join' : waitingForHost ? 'Waiting for host' : undefined}
                tapLabel={waitingForHost ? 'Waiting for host...' : undefined}
                tapDisabled={waitingForHost}
              />
            )}
          </div>
        </div>,
        document.body
      )}

      <div id="loft-transport-bar" className="fixed inset-x-0 bottom-0 z-[1000] pointer-events-auto">
        <LoftTransportBar
          isSidebarOpen={isSidebarOpen}
          reactionTypes={REACTION_TYPES}
          onTriggerReaction={triggerReaction}
          isHost={isHost}
          isOnStage={isOnStage}
          canRaiseHand={!isHost && effectiveLocalRole === LoftRole.LISTENER}
          localHandRaised={localHandRaised}
          onToggleHand={handleToggleHand}
          isMicEnabled={isMicEnabled}
          onToggleMic={handleToggleMic}
          isVideoEnabled={isVideoEnabled}
          onToggleVideo={handleToggleVideo}
          isHostScreenSharing={!!activeScreenTrack}
          isScreenShareStarting={isScreenShareStarting}
          screenShareSupported={screenShareSupport.supported}
          onToggleScreenShare={handleToggleScreenShare}
          onMuteAll={handleMuteAll}
          hasUnmutedParticipants={hasUnmutedParticipants}
          remoteParticipantCount={remoteParticipantCount}
          onHostEndRoom={handleHostEndRoom}
          onLeave={handleLeave}
          onOpenChat={openChat}
          onOpenQueue={openQueue}
          raisedHandCount={handRaiseRequests.length}
        />
      </div>

      <LoftSettingsModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        
        // Theme
        themeMode={themeMode}
        onThemeChange={setThemeMode}
        
        // Devices
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        selectedAudioDeviceId={selectedAudioDeviceId}
        selectedVideoDeviceId={selectedVideoDeviceId}
        selectedSpeakerDeviceId={selectedSpeakerDeviceId}
        onAudioDeviceChange={setSelectedAudioDeviceId}
        onVideoDeviceChange={setSelectedVideoDeviceId}
        onSpeakerDeviceChange={setSelectedSpeakerDeviceId}
        
        // Mic level
        setupMicLevel={setupMicLevel}
        
        // Background
        backgroundMode={backgroundMode}
        blurDisabled={blurDisabled}
        setBackgroundModeAndPersist={setBackgroundModeAndPersist}
        callObject={callObject}
        
        // Avatar support for authenticated users
        onAvatarChange={handleAvatarChange}
      />

      <LoftSidebar
        isOpen={isSidebarOpen}
        sidebarTab={sidebarTab}
        onTabChange={setSidebarTab}
        onClose={() => setIsSidebarOpen(false)}
        messages={messages}
        chatInput={chatInput}
        onChatInputChange={setChatInput}
        onSendMessage={handleSendMessage}
        chatEndRef={chatEndRef}
        questions={questions}
        qaInput={qaInput}
        onQaInputChange={setQaInput}
        onSendQuestion={handleSendQuestion}
        onUpvoteQuestion={upvoteQuestion}
        isHost={isHost}
        polls={polls}
        onVotePoll={votePoll}
        showHandsTab={isHostish}
        handRaiseRequests={handRaiseRequests}
        isHandsLoading={isHandsLoading}
        onRefreshHands={async () => {
          await refreshHandRaises?.({ silent: false });
          await triggerRoomRefresh();
        }}
        onPromoteHand={handlePromoteHand}
        onDemoteStageMember={handleDemoteStageMember}
        stageParticipants={stageParticipants}
        formatTimeAgo={formatTimeAgo}
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
    </>
  );

};

const ControlBtn = ({ icon, onClick, color }: any) => (
  <button onClick={onClick} className={`w-9 h-9 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all border active:scale-90 shrink-0 shadow-xl ${color}`}>
    {icon}
  </button>
);

export default LoftRoomPage;

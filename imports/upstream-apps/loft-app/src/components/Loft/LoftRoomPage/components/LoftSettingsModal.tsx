import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, ChevronLeft, Upload, Loader2, Camera, Check } from 'lucide-react';
import DailyIframe from '@daily-co/daily-js';
import { supabase } from '@/services/supabaseClient';
import { useSupabaseUser } from '@/services/supabaseApi';
import { uploadAvatar, updateProfileAvatar } from '@/services/avatarService';
import DeviceDropdown from './DeviceDropdown';

// Reusable Toggle Component
const Toggle: React.FC<{
  enabled: boolean;
  onChange: () => void;
  label?: string;
}> = ({ enabled, onChange, label }) => (
  <button
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--loft-accent)] focus:ring-offset-2 ${
      enabled ? 'bg-cafe' : 'border border-[var(--loft-border)] bg-[var(--loft-surface-2)]'
    }`}
    role="switch"
    aria-checked={enabled}
    onClick={onChange}
    aria-label={label}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
      enabled ? 'translate-x-6' : 'translate-x-1'
    }`} />
  </button>
);

// Helper function to create thumbnail in browser
async function createThumbnail(file: File, maxWidth: number, maxHeight: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      // Calculate dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      
      // Scale down to fit within maxWidth x maxHeight
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Use better quality scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not create thumbnail'));
          }
        },
        'image/jpeg',
        0.85  // Good quality, smaller file
      );
      
      // Clean up
      URL.revokeObjectURL(img.src);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Could not load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

// Helper function to create compressed full image as JPEG
async function createCompressedImage(
  file: File, 
  maxWidth: number, 
  maxHeight: number, 
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      
      // Scale down if needed
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      if (ratio < 1) {
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not compress image'));
          }
        },
        'image/jpeg',  // Always output JPEG
        quality
      );
      
      URL.revokeObjectURL(img.src);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Could not load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

// Curated Loft backgrounds: calm 16:9 scenes designed for head-and-shoulders video.
const CUSTOM_BACKDROPS = [
  { 
    id: 'loft-skyline-window', 
    label: 'Skyline Window', 
    thumbnail: '/backgrounds/loft-skyline-window.png',
    fullImage: '/backgrounds/loft-skyline-window.png'
  },
  { 
    id: 'loft-focus-office', 
    label: 'Focus Office', 
    thumbnail: '/backgrounds/loft-focus-office.png',
    fullImage: '/backgrounds/loft-focus-office.png'
  },
  { 
    id: 'loft-library-wall', 
    label: 'Library Wall', 
    thumbnail: '/backgrounds/loft-library-wall.png',
    fullImage: '/backgrounds/loft-library-wall.png'
  },
  { 
    id: 'loft-library-wall-bright', 
    label: 'Library Wall Bright', 
    thumbnail: '/backgrounds/loft-library-wall-bright.png',
    fullImage: '/backgrounds/loft-library-wall-bright.png'
  },
  { 
    id: 'loft-library-wall-dark', 
    label: 'Library Wall Dark', 
    thumbnail: '/backgrounds/loft-library-wall-dark.png',
    fullImage: '/backgrounds/loft-library-wall-dark.png'
  },
  { 
    id: 'loft-studio-glass', 
    label: 'Studio Glass', 
    thumbnail: '/backgrounds/loft-studio-glass.png',
    fullImage: '/backgrounds/loft-studio-glass.png'
  },
  { 
    id: 'loft-career-cafe', 
    label: 'Career Cafe', 
    thumbnail: '/backgrounds/loft-career-cafe.png',
    fullImage: '/backgrounds/loft-career-cafe.png'
  },
  { 
    id: 'loft-evening-suite', 
    label: 'Evening Suite', 
    thumbnail: '/backgrounds/loft-evening-suite.png',
    fullImage: '/backgrounds/loft-evening-suite.png'
  },
];

type ThemeMode = 'dark' | 'light' | 'auto';
type VideoQualityPreference = 'auto' | 'high' | 'low' | 'bandwidth_saver';

// Custom background interface
interface CustomBackground {
  url: string;           // Full size public URL (for Daily.co)
  thumbnail: string;     // Thumbnail public URL (for grid display)
  fullPath?: string;     // Supabase storage path (for deletion)
  thumbPath?: string;    // Supabase storage path (for deletion)
}

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'auto', label: 'Auto' },
];

const buildDeviceOptions = (
  devices: MediaDeviceInfo[],
  kind: MediaDeviceKind,
  labelPrefix: string,
) => {
  const filtered = devices.filter((device) => device.kind === kind);
  return filtered.map((device, index) => ({
    value: device.deviceId,
    label: device.label?.trim() || `${labelPrefix}${filtered.length > 1 ? ` ${index + 1}` : ''}`,
  }));
};

type AvatarKind = 'arc' | 'signal' | 'column' | 'compass' | 'shield' | 'wave';

// Loft avatar presets: equal-status abstract identity tokens. Color comes from Loft theme variables.
const AVATAR_OPTIONS = [
  { seed: 'loft-pro-1', kind: 'arc' },
  { seed: 'loft-pro-2', kind: 'signal' },
  { seed: 'loft-pro-3', kind: 'column' },
  { seed: 'loft-pro-4', kind: 'compass' },
  { seed: 'loft-pro-5', kind: 'shield' },
  { seed: 'loft-pro-6', kind: 'wave' },
] satisfies { seed: string; kind: AvatarKind }[];

type PresetAvatar = typeof AVATAR_OPTIONS[number];

type LoftAvatarPalette = {
  bg: string;
  border: string;
  primary: string;
  secondary: string;
  accent: string;
  detail: string;
};

const getLoftAvatarPalette = (): LoftAvatarPalette => {
  if (typeof window === 'undefined') {
    return {
      bg: 'var(--loft-avatar-bg)',
      border: 'var(--loft-avatar-border)',
      primary: 'var(--loft-avatar-base)',
      secondary: 'var(--loft-avatar-platform)',
      accent: 'var(--loft-avatar-body)',
      detail: 'var(--loft-avatar-cut)',
    };
  }

  const styles = window.getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim();
  return {
    bg: read('--loft-avatar-bg'),
    border: read('--loft-avatar-border'),
    primary: read('--loft-avatar-base'),
    secondary: read('--loft-avatar-platform'),
    accent: read('--loft-avatar-body'),
    detail: read('--loft-avatar-cut'),
  };
};

const avatarShapeMarkup = (kind: AvatarKind, palette: LoftAvatarPalette) => {
  const base = `
    <rect width="160" height="160" rx="34" fill="${palette.bg}"/>
    <rect x="13" y="13" width="134" height="134" rx="28" fill="none" stroke="${palette.border}" stroke-width="2"/>
    <path d="M44 124h72l-7 14H51z" fill="${palette.primary}"/>
    <path d="M55 112h50l8 12H47z" fill="${palette.secondary}"/>
  `;

  const detailStroke = `stroke="${palette.detail}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"`;
  const accentStroke = `stroke="${palette.secondary}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"`;

  const shapes: Record<AvatarKind, string> = {
    arc: `
      <path d="M80 50c18 12 30 28 30 43 0 14-12 22-30 22s-30-8-30-22c0-15 12-31 30-43z" fill="${palette.accent}"/>
      <path d="M64 90c9 8 23 8 32 0" fill="none" ${detailStroke}/>
      <path d="M80 67v37" ${accentStroke}/>
    `,
    signal: `
      <path d="M55 107c7-30 28-48 52-55-5 14-4 26 5 38-8 10-21 17-37 17z" fill="${palette.accent}"/>
      <path d="M72 88c12-5 22-14 29-27" fill="none" ${accentStroke}/>
      <circle cx="91" cy="73" r="5" fill="${palette.primary}"/>
    `,
    column: `
      <path d="M58 68c0-8 7-15 15-15h14c8 0 15 7 15 15v39H58z" fill="${palette.accent}"/>
      <path d="M66 77h28M66 92h28" ${detailStroke}/>
      <path d="M80 56v50" ${accentStroke}/>
    `,
    compass: `
      <path d="M80 51c18 0 32 14 32 32s-14 32-32 32-32-14-32-32 14-32 32-32z" fill="${palette.accent}"/>
      <path d="M80 64v38M61 83h38" ${accentStroke}/>
      <path d="M65 99c9 6 21 6 30 0" fill="none" ${detailStroke}/>
    `,
    shield: `
      <path d="M80 49l30 17v22c0 15-11 25-30 32-19-7-30-17-30-32V66z" fill="${palette.accent}"/>
      <path d="M68 83c8-6 16-6 24 0" fill="none" ${detailStroke}/>
      <path d="M80 63v41" ${accentStroke}/>
    `,
    wave: `
      <path d="M80 52c17 0 30 13 30 30 0 14-9 25-23 29H73c-14-4-23-15-23-29 0-17 13-30 30-30z" fill="${palette.accent}"/>
      <path d="M64 76c8-8 24-8 32 0M64 96c8 8 24 8 32 0" fill="none" ${detailStroke}/>
      <path d="M80 59v48" ${accentStroke}/>
    `,
  };

  return base + shapes[kind];
};

const makeAvatarDataUrl = (kind: AvatarKind) => {
  const palette = getLoftAvatarPalette();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="Loft avatar option">${avatarShapeMarkup(kind, palette)}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const LoftAvatarToken: React.FC<{ kind: AvatarKind; className?: string }> = ({ kind, className }) => {
  const palette = {
    bg: 'var(--loft-avatar-bg)',
    border: 'var(--loft-avatar-border)',
    primary: 'var(--loft-avatar-base)',
    secondary: 'var(--loft-avatar-platform)',
    accent: 'var(--loft-avatar-body)',
    detail: 'var(--loft-avatar-cut)',
  };

  return (
    <svg
      viewBox="0 0 160 160"
      role="img"
      aria-label="Loft avatar option"
      className={className}
      dangerouslySetInnerHTML={{ __html: avatarShapeMarkup(kind, palette) }}
    />
  );
};

type BackgroundMode = 'none' | 'blur' | 'image';

const describeBackgroundError = (error: unknown) => {
  const message = String((error as { message?: string })?.message || error || '').toLowerCase();

  if (message.includes('video not available') || message.includes('camera')) {
    return 'Your camera was not ready for that background. Turn your camera on and try again.';
  }

  if (message.includes('not available') || message.includes('not supported') || message.includes('unsupported')) {
    return 'Background effects are not available in this browser. You can continue without one or try from a supported desktop browser.';
  }

  return 'Loft could not apply that background. Try again, or continue without a background.';
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  selectedSpeakerDeviceId?: string;
  videoDeviceError?: string | null;
  onAudioDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;
  onSpeakerDeviceChange?: (deviceId: string) => void;
  setupMicLevel: number;
  backgroundMode: BackgroundMode;
  blurDisabled: boolean;
  setBackgroundModeAndPersist: (mode: BackgroundMode) => void;
  callObject: any;
  onPrepareVideoForEffects?: () => Promise<void>;
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  onAvatarChange?: () => void; // Add callback for avatar changes
  onBackgroundChange?: () => void;
  guestName?: string; // Add guest name for display
};

type SettingsTab = 'audio-video' | 'video-quality' | 'user-preferences' | 'background-effects';
type SettingsView = { screen: 'home' } | { screen: 'detail'; tab: SettingsTab };

export const LoftSettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  audioDevices,
  videoDevices,
  selectedAudioDeviceId,
  selectedVideoDeviceId,
  selectedSpeakerDeviceId,
  videoDeviceError,
  onAudioDeviceChange,
  onVideoDeviceChange,
  onSpeakerDeviceChange,
  setupMicLevel,
  backgroundMode,
  blurDisabled,
  setBackgroundModeAndPersist,
  callObject,
  onPrepareVideoForEffects,
  themeMode,
  onThemeChange,
  onAvatarChange,
  onBackgroundChange,
  guestName,
}) => {
  const [view, setView] = useState<SettingsView>({ screen: 'home' });
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const [isResolvedDarkTheme, setIsResolvedDarkTheme] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });
  const [desktopActiveTab, setDesktopActiveTab] = useState<SettingsTab>('audio-video');
  const activeTab = isDesktop ? desktopActiveTab : (view.screen === 'detail' ? view.tab : 'audio-video');
  
  const videoRefDesktop = useRef<HTMLVideoElement>(null);
  const videoRefMobile = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const effectsWarmRef = useRef(false);
  
  const [selectedBackdropId, setSelectedBackdropId] = useState<string | null>(null);
  const [selectedBuiltinKey, setSelectedBuiltinKey] = useState<string | null>(null);
  
  const [mirrorCameraEnabled, setMirrorCameraEnabled] = useState(true);
  const [isApplyingBackground, setIsApplyingBackground] = useState(false);
  const isApplyingBackgroundRef = useRef(false); // Ref to prevent concurrent calls
  const [isUploadingCustom, setIsUploadingCustom] = useState(false);
  const [customBackgroundSlot, setCustomBackgroundSlot] = useState<number | null>(null);
  const [bgStatus, setBgStatus] = useState<{ type: 'idle' | 'error' | 'info'; message: string } | null>(null);
  const [videoQualityPreference, setVideoQualityPreference] = useState<VideoQualityPreference>('auto');
  const [videoQualityStatus, setVideoQualityStatus] = useState<string | null>(null);
  
  // User's custom backgrounds (up to 3)
  const [userCustomBackgrounds, setUserCustomBackgrounds] = useState<CustomBackground[]>([]);
  
  // Avatar states
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [avatarUpdateKey, setAvatarUpdateKey] = useState(0); // Force avatar re-read
  const [mediaPermissionState, setMediaPermissionState] = useState<PermissionState | 'unsupported' | null>(null);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  // Profile data for avatar
  const { profile } = useSupabaseUser();
  const resolveAvatarUrl = useCallback((avatar: PresetAvatar) => {
    return makeAvatarDataUrl(avatar.kind);
  }, [isResolvedDarkTheme]);
  const profileAvatarUrl = useMemo(() => {
    // Debug logging
    if (import.meta.env.DEV) {
    }
    
    // ABSOLUTE PRIORITY: Database profile picture (uploaded by user)
    if (profile?.avatarUrl) {
      const trimmed = profile.avatarUrl.trim();
      return trimmed || undefined;
    }
    
    return undefined;
  }, [profile?.avatarUrl]);

  // Session avatar (selected from predefined options) - separate from profile picture
  const sessionAvatarUrl = useMemo(() => {
    let sessionAvatar: string | null = null;
    let sessionAvatarSeed: string | null = null;
    try {
      sessionAvatar = localStorage.getItem('loft.sessionAvatar');
      sessionAvatarSeed = localStorage.getItem('loft.sessionAvatarSeed');
    } catch (error) {
      console.error('[avatar] Failed to read session avatar');
    }

    if (sessionAvatarSeed) {
      const preset = AVATAR_OPTIONS.find((avatar) => avatar.seed === sessionAvatarSeed);
      if (preset) return resolveAvatarUrl(preset);
    }
    
    if (sessionAvatar) {
      return sessionAvatar.trim() || undefined;
    }
    
    return undefined;
  }, [avatarUpdateKey, resolveAvatarUrl]); // Re-read when avatar changes or theme flips
  const hasDevices = useMemo(() => {
    const allDevices = [...audioDevices, ...videoDevices];
    return allDevices.length > 0;
  }, [audioDevices, videoDevices]);
  const audioInputOptions = useMemo(
    () => buildDeviceOptions(audioDevices, 'audioinput', 'Unnamed microphone'),
    [audioDevices],
  );
  const audioOutputOptions = useMemo(
    () => buildDeviceOptions(audioDevices, 'audiooutput', 'Unnamed speaker'),
    [audioDevices],
  );
  const videoInputOptions = useMemo(
    () => buildDeviceOptions(videoDevices, 'videoinput', 'Unnamed camera'),
    [videoDevices],
  );

  // Request permissions if browser access is denied or still pending.
  const requestPermissions = async () => {
    try {
      setPermissionMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMediaPermissionState('granted');
      window.dispatchEvent(new Event('loft:refresh-devices'));
    } catch (error) {
      console.error('[Settings] Permission request failed');
      setMediaPermissionState('denied');
      setPermissionMessage('Camera or microphone access is blocked for this browser window. Turn it on in the browser site permissions, return to this tab, then check permissions again.');
    }
  };
  const profileName = useMemo(() => {
    // Use guestName first (for guests), then profile name, then fallback
    return guestName || profile?.name || 'User';
  }, [guestName, profile?.name]);
  const profileInitials = useMemo(() => {
    return profileName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }, [profileName]);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [profileAvatarUrl, sessionAvatarUrl]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateTheme = () => {
      setIsResolvedDarkTheme(document.documentElement.classList.contains('dark'));
    };
    updateTheme();

    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === 'attributes' && mutation.attributeName === 'class')) {
        updateTheme();
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  // Check if user has uploaded profile picture (separate from session avatar)
  const hasUploadedProfilePicture = useMemo(() => {
    return !!profile?.avatarUrl?.trim();
  }, [profile?.avatarUrl]);

  // Check if user has session avatar (selected from predefined options)
  const hasSessionAvatar = useMemo(() => {
    try {
      const sessionAvatar = localStorage.getItem('loft.sessionAvatar');
      const sessionAvatarSeed = localStorage.getItem('loft.sessionAvatarSeed');
      return !!(sessionAvatarSeed?.trim() || sessionAvatar?.trim());
    } catch {
      return false;
    }
  }, [avatarUpdateKey]);

  useEffect(() => {
    if (!isOpen) return;

    let sessionAvatarSeed: string | null = null;
    try {
      sessionAvatarSeed = localStorage.getItem('loft.sessionAvatarSeed');
    } catch {
      return;
    }

    if (!sessionAvatarSeed) return;
    const preset = AVATAR_OPTIONS.find((avatar) => avatar.seed === sessionAvatarSeed);
    if (!preset) return;

    const avatarUrl = resolveAvatarUrl(preset);
    try {
      localStorage.setItem('loft.sessionAvatar', avatarUrl);
    } catch (error) {
      console.error('[avatar] Failed to update session avatar theme');
    }

    if (callObject && typeof callObject.setUserData === 'function') {
      try {
        const localParticipant = callObject.participants?.()?.local;
        let existingUserData: Record<string, any> = {};
        const rawUserData = localParticipant?.userData ?? localParticipant?.user_data;
        if (typeof rawUserData === 'string') {
          existingUserData = JSON.parse(rawUserData);
        } else if (rawUserData && typeof rawUserData === 'object') {
          existingUserData = rawUserData;
        }

        Promise.resolve(callObject.setUserData({
          ...existingUserData,
          avatarUrl,
          avatarSeed: preset.seed,
          avatarUpdatedAt: Date.now(),
        })).catch(() => {
          console.error('[avatar] Failed to sync themed avatar to Daily');
        });
      } catch {
        console.error('[avatar] Failed to read existing Daily user data');
      }
    }
  }, [callObject, isOpen, isResolvedDarkTheme, resolveAvatarUrl]);

  const isMobileBrowser = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const userAgent = navigator.userAgent || '';
    const isTouchMobile = typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1 && /Mobile|Tablet/i.test(userAgent);
    return /Android|iPhone|iPad|iPod/i.test(userAgent) || isTouchMobile;
  }, []);

  const isLikelyDesktopBrowser = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const hasDesktopPointer = typeof window.matchMedia === 'function'
      ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
      : false;
    return hasDesktopPointer && !isMobileBrowser;
  }, [isMobileBrowser]);

  const dailyReportsVideoProcessingUnsupported = useMemo(() => {
    try {
      const supportInfo = DailyIframe.supportedBrowser();
      if (supportInfo && typeof supportInfo === 'object') {
        return (supportInfo as any).supportsVideoProcessing === false;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const blurDisabledCapable = dailyReportsVideoProcessingUnsupported && !isLikelyDesktopBrowser;

  const backgroundEffectsUnavailableMessage = useMemo(() => {
    if (!blurDisabledCapable) return null;
    return isMobileBrowser
      ? 'Background effects are not available in this PWA browser on some phones, iPads, and tablets. Join from a supported desktop browser to use blur or image backgrounds.'
      : 'Background effects are not available in this browser window. Use a supported desktop browser to enable blur or image backgrounds.';
  }, [blurDisabledCapable, isMobileBrowser]);

  // Initialize selected background from localStorage
  useEffect(() => {
    if (isOpen) {
      const savedMode = localStorage.getItem('loft.bg.mode') as BackgroundMode;
      const savedImage = localStorage.getItem('loft.bg.image');
      
      setSelectedBackdropId(null);
      
      if (savedMode === 'image' && savedImage) {
        setSelectedBackdropId(savedImage);
        setBackgroundModeAndPersist('image');
      } else if (savedMode === 'blur') {
        setBackgroundModeAndPersist('blur');
      } else {
        setBackgroundModeAndPersist('none');
      }
    }
  }, [isOpen]);

  // Load user's custom backgrounds from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('loft.bg.custom');
    if (saved) {
      try {
        setUserCustomBackgrounds(JSON.parse(saved));
      } catch (e) {
      }
    }
  }, []);

  // Load video quality preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('loft.video.quality');
    if (saved) {
      try {
        setVideoQualityPreference(saved as VideoQualityPreference);
      } catch (e) {
      }
    }
  }, []);

  // Save video quality preference to localStorage
  const saveVideoQualityPreference = (quality: VideoQualityPreference) => {
    setVideoQualityPreference(quality);
    localStorage.setItem('loft.video.quality', quality);
  };

  // Apply video quality to Daily call object
  const applyVideoQuality = async (quality: VideoQualityPreference) => {
    if (!callObject) return;

    try {
      if (typeof callObject.setBandwidth !== 'function') {
        throw new Error('Video quality controls are unavailable in this browser session.');
      }

      switch (quality) {
        case 'auto':
          callObject.setBandwidth({ kbs: null });
          setVideoQualityStatus('Loft will manage video bandwidth for this session.');
          break;

        case 'high':
          callObject.setBandwidth({ kbs: 'NO_CAP' });
          setVideoQualityStatus('Loft will prioritize video clarity where the network allows.');
          break;

        case 'low':
          callObject.setBandwidth({ kbs: 600 });
          setVideoQualityStatus('Loft will reduce outgoing video bandwidth for this session.');
          break;

        case 'bandwidth_saver':
          callObject.setBandwidth({ kbs: 300 });
          await callObject.setLocalVideo(false);
          setVideoQualityStatus('Bandwidth saver is on. Your camera has been turned off.');
          break;
      }
    } catch (error) {
      console.error('[Loft Settings] Failed to apply video quality');
      setVideoQualityStatus('Video quality could not be changed in this browser session.');
    }
  };

  // Handle video quality change
  const handleVideoQualityChange = async (quality: VideoQualityPreference) => {
    saveVideoQualityPreference(quality);
    await applyVideoQuality(quality);
  };

  // Save custom backgrounds to localStorage
  function saveCustomBackgrounds(backgrounds: CustomBackground[]) {
    setUserCustomBackgrounds(backgrounds);
    localStorage.setItem('loft.bg.custom', JSON.stringify(backgrounds));
  }

  // Handle custom file upload
  async function handleCustomFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
      setBgStatus({ type: 'error', message: 'Please select an image (JPEG or PNG)' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBgStatus({ type: 'error', message: 'Image must be under 5MB' });
      return;
    }

    setIsUploadingCustom(true);
    setBgStatus({ type: 'info', message: 'Uploading...' });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBgStatus({ type: 'error', message: 'Please sign in to upload backgrounds' });
        return;
      }

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      
      // Always use .jpg extension for both files
      const fullPath = `${user.id}/${timestamp}-${randomId}-full.jpg`;
      const thumbPath = `${user.id}/${timestamp}-${randomId}-thumb.jpg`;

      // Create COMPRESSED FULL IMAGE as JPEG (not original file)
      const compressedFull = await createCompressedImage(file, 1280, 720, 0.85);

      // Create thumbnail
      const thumbnailBlob = await createThumbnail(file, 640, 360);

      // Upload both files in parallel
      const [fullUpload, thumbUpload] = await Promise.all([
        supabase.storage.from('backgrounds').upload(fullPath, compressedFull, {  // ← Compressed JPEG
          cacheControl: '31536000',
          upsert: false,
          contentType: 'image/jpeg'  // ← Force JPEG
        }),
        supabase.storage.from('backgrounds').upload(thumbPath, thumbnailBlob, {
          cacheControl: '31536000',
          upsert: false,
          contentType: 'image/jpeg'
        })
      ]);

      if (fullUpload.error) {
        console.error('Full image upload failed');
        throw fullUpload.error;
      }
      if (thumbUpload.error) {
        console.error('Thumbnail upload failed');
        throw thumbUpload.error;
      }

      // Get public URLs
      const { data: { publicUrl: fullUrl } } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(fullPath);

      const { data: { publicUrl: thumbUrl } } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(thumbPath);

      // Add to user's custom backgrounds
      const newBackground: CustomBackground = { 
        url: fullUrl, 
        thumbnail: thumbUrl,
        fullPath: fullPath,
        thumbPath: thumbPath
      };
      
      const newBackgrounds = [...userCustomBackgrounds, newBackground];
      saveCustomBackgrounds(newBackgrounds);

      // Apply immediately
      await applyBackground('image', fullUrl);

      setBgStatus({ type: 'info', message: 'Background added!' });
      setTimeout(() => setBgStatus(null), 2000);

    } catch (e: any) {
      console.error('[Loft Settings] Upload failed');
      setBgStatus({ type: 'error', message: e.message || 'Failed to upload image' });
    } finally {
      setIsUploadingCustom(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Handle avatar upload
  const handleAvatarUpload = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setAvatarUploadError(null);
    setIsAvatarUploading(true);
    try {
      const publicUrl = await uploadAvatar(file);
      await updateProfileAvatar(publicUrl);
      // Notify parent component of avatar change instead of refreshing
      onAvatarChange?.();
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[avatar] failed');
      setAvatarUploadError('Failed to update avatar.');
    } finally {
      setIsAvatarUploading(false);
    }
  }, []);

  // Handle avatar selection from predefined options (session-based)
  const handleAvatarSelect = useCallback(async (avatar: PresetAvatar) => {
    setAvatarUploadError(null);
    setIsAvatarUploading(true);
    try {
      const avatarUrl = resolveAvatarUrl(avatar);

      // Save the selected session avatar for the current browser session.
      try {
        localStorage.setItem('loft.sessionAvatar', avatarUrl);
        localStorage.setItem('loft.sessionAvatarSeed', avatar.seed);
        window.dispatchEvent(new Event('loft:session-avatar-changed'));
      } catch (error) {
        console.error('[avatar] Failed to save to localStorage');
      }

      // Repaint local UI immediately; Daily sync can lag behind on localhost.
      setAvatarLoadError(false);
      setAvatarUpdateKey(prev => prev + 1);
      onAvatarChange?.();
      
      // Also update Daily user data for real-time synchronization
      if (callObject) {
        try {
          const localParticipant = callObject.participants?.()?.local;
          let existingUserData: Record<string, any> = {};
          const rawUserData = localParticipant?.userData ?? localParticipant?.user_data;
          if (typeof rawUserData === 'string') {
            existingUserData = JSON.parse(rawUserData);
          } else if (rawUserData && typeof rawUserData === 'object') {
            existingUserData = rawUserData;
          }

          const userData = {
            ...existingUserData,
            avatarUrl,
            avatarSeed: avatar.seed,
            avatarUpdatedAt: Date.now()
          };
          
          await callObject.setUserData(userData);
        } catch (error) {
          console.error('[avatar] Failed to update Daily user data');
        }
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[avatar] selection failed');
      setAvatarUploadError('Failed to update avatar.');
    } finally {
      setIsAvatarUploading(false);
    }
  }, [callObject, onAvatarChange, resolveAvatarUrl]);

  // Handle reverting to profile picture (session-based)
  const handleRevertToProfilePicture = useCallback(async () => {
    setAvatarUploadError(null);
    setIsAvatarUploading(true);
    try {

      // Remove from localStorage for session only
      try {
        localStorage.removeItem('loft.sessionAvatar');
        localStorage.removeItem('loft.sessionAvatarSeed');
        window.dispatchEvent(new Event('loft:session-avatar-changed'));
      } catch (error) {
        console.error('[avatar] Failed to remove from localStorage');
      }

      // Repaint local UI immediately; Daily sync can lag behind on localhost.
      setAvatarLoadError(false);
      setAvatarUpdateKey(prev => prev + 1);
      onAvatarChange?.();

      if (callObject) {
        try {
          const localParticipant = callObject.participants?.()?.local;
          let existingUserData: Record<string, any> = {};
          const rawUserData = localParticipant?.userData ?? localParticipant?.user_data;
          if (typeof rawUserData === 'string') {
            existingUserData = JSON.parse(rawUserData);
          } else if (rawUserData && typeof rawUserData === 'object') {
            existingUserData = rawUserData;
          }

          await callObject.setUserData({
            ...existingUserData,
            avatarUrl: profileAvatarUrl || null,
            avatarSeed: null,
            avatarUpdatedAt: Date.now(),
          });
        } catch (error) {
          console.error('[avatar] Failed to restore Daily profile avatar');
        }
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[avatar] revert failed');
      setAvatarUploadError('Failed to revert to profile picture.');
    } finally {
      setIsAvatarUploading(false);
    }
  }, [callObject, onAvatarChange, profileAvatarUrl]);

  // Remove a custom background
  async function removeCustomBackground(index: number) {
    const bg = userCustomBackgrounds[index];
    if (!bg) return;

    try {
      // Collect paths to delete
      const pathsToDelete: string[] = [];
      if (bg.fullPath) pathsToDelete.push(bg.fullPath);
      if (bg.thumbPath) pathsToDelete.push(bg.thumbPath);

      // Delete from Supabase Storage
      if (pathsToDelete.length > 0) {
        const { error } = await supabase.storage
          .from('backgrounds')
          .remove(pathsToDelete);
        
        if (error) {
          console.warn('[Loft Settings] Failed to delete from storage');
        }
      }

      // Remove from local state
      const newBackgrounds = userCustomBackgrounds.filter((_, i) => i !== index);
      saveCustomBackgrounds(newBackgrounds);

      // If this was selected, reset to none
      if (selectedBackdropId === bg.url) {
        applyBackground('none');
      }

    } catch (e) {
      console.error('[Loft Settings] Failed to remove background');
    }
  }

  // Apply background function - IMPROVED VERSION
  async function applyBackground(
    mode: BackgroundMode, 
    imageUrl?: string,
    isRestore: boolean = false
  ) {
    if (!callObject) {
      console.error('[Loft Settings] No callObject available');
      return;
    }
    
    const meetingState = callObject.meetingState();
    if (meetingState !== 'joined-meeting') {
      console.error('[Loft Settings] Not in meeting');
      if (!isRestore) {
        setBgStatus({ type: 'error', message: 'Please join the meeting first.' });
      }
      return;
    }

    // Prevent concurrent calls
    if (isApplyingBackgroundRef.current) {
      return;
    }

    isApplyingBackgroundRef.current = true;
    setIsApplyingBackground(true);
    
    if (!isRestore) {
      setBgStatus({ type: 'info', message: mode === 'none' ? 'Turning background effects off...' : 'Applying background...' });
    }

    try {
      if (mode !== 'none') {
        const supportInfo = DailyIframe.supportedBrowser();
        const dailySaysNoVideoProcessing = supportInfo && typeof supportInfo === 'object' && (supportInfo as any).supportsVideoProcessing === false;
        if (dailySaysNoVideoProcessing && !isLikelyDesktopBrowser) {
          throw new Error(backgroundEffectsUnavailableMessage || 'Background effects are not available in this browser window.');
        }
      }

      // Step 1: Ensure video is on
      await onPrepareVideoForEffects?.();
      const localVideo = callObject.localVideo();
      if (!localVideo) {
        await callObject.setLocalVideo(true);
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Step 2: Wait for video track with EVENT-BASED approach instead of polling
      const videoReady = await new Promise<boolean>((resolve) => {
        let attempts = 0;
        const maxAttempts = 12;
        
        const checkVideo = () => {
          const participants = callObject.participants();
          const localParticipant = participants?.local;
          const videoTrack = localParticipant?.tracks?.video;

          if (videoTrack?.track && (videoTrack.state === 'playable' || videoTrack.state === 'sendable')) {
            resolve(true);
            return;
          }
          
          attempts++;
          if (attempts >= maxAttempts) {
            console.warn('[Loft Settings] Video track timeout');
            resolve(false);
            return;
          }

          setTimeout(checkVideo, 250);
        };
        
        checkVideo();
      });

      if (!videoReady) {
        throw new Error('Video not available. Please enable your camera and try again.');
      }

      // Step 3: Build processor config
      let processorConfig: any;
      
      if (mode === 'none') {
        processorConfig = { type: 'none' };
        setSelectedBackdropId(null);
        
      } else if (mode === 'blur') {
        processorConfig = {
          type: 'background-blur',
          config: { strength: 1 }
        };
        setSelectedBackdropId(null);
        
      } else if (mode === 'image' && imageUrl) {
        const absoluteUrl = imageUrl.startsWith('http') 
          ? imageUrl 
          : `${window.location.origin}${imageUrl}`;

        processorConfig = {
          type: 'background-image',
          config: { source: absoluteUrl }
        };
        setSelectedBackdropId(imageUrl);
      }

      // Step 4: Apply processor WITHOUT artificial timeout
      if (processorConfig) {
        // REMOVED: Promise.race timeout - let Daily.co handle its own timeout
        await callObject.updateInputSettings({ 
          video: { processor: processorConfig } 
        });

        if (mode !== 'none' && typeof callObject.getInputSettings !== 'function') {
          throw new Error('Background effect status could not be confirmed in this browser session.');
        }

        if (mode !== 'none') {
          let confirmedProcessor = false;
          for (let attempt = 0; attempt < 6; attempt++) {
            const inputSettings = await callObject.getInputSettings();
            const activeProcessor = inputSettings?.video?.processor;
            confirmedProcessor = activeProcessor?.type === processorConfig.type;

            if (confirmedProcessor) break;
            await new Promise(resolve => setTimeout(resolve, 250));
          }

          if (!confirmedProcessor) {
            throw new Error('Loft could not confirm that the requested background started.');
          }
        }

        try {
          const localParticipant = callObject.participants?.()?.local;
          let existingUserData: Record<string, any> = {};
          const rawUserData = localParticipant?.userData ?? localParticipant?.user_data;
          if (typeof rawUserData === 'string') {
            try {
              existingUserData = JSON.parse(rawUserData);
            } catch {
              existingUserData = {};
            }
          } else if (rawUserData && typeof rawUserData === 'object') {
            existingUserData = rawUserData;
          }

          await callObject.setUserData({
            ...existingUserData,
            backgroundMode: mode,
            backgroundImage: mode === 'image' ? imageUrl || null : null,
            backgroundUpdatedAt: Date.now(),
          });
        } catch {
          // Background processing still succeeded; userData sync is best effort.
        }
        
        // Force refresh with retry logic
        let refreshAttempts = 0;
        const maxRefreshAttempts = 3;
        
        while (refreshAttempts < maxRefreshAttempts) {
          const participants = callObject.participants();
          const videoTrack = participants?.local?.tracks?.video;
          const currentTrack = videoTrack?.track || videoTrack?.persistentTrack;
          
          if (currentTrack) {
            const stream = new MediaStream([currentTrack]);
            
            if (videoRefDesktop.current) {
              videoRefDesktop.current.srcObject = stream;
            }
            if (videoRefMobile.current) {
              videoRefMobile.current.srcObject = stream;
            }

            break;
          }
          
          refreshAttempts++;
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        
        if (!isRestore) {
          updateUIState(mode, imageUrl);
          onBackgroundChange?.();
          window.setTimeout(() => onBackgroundChange?.(), 300);
          setBgStatus({ type: 'info', message: mode === 'none' ? 'Background effects off.' : 'Background applied!' });
          setTimeout(() => setBgStatus(null), 1800);
        }
      }

    } catch (e: any) {
      console.error('[Loft Settings] Failed to apply background');
      
      if (!isRestore) {
        setBgStatus({
          type: 'error',
          message: describeBackgroundError(e)
        });
      }
    } finally {
      // CRITICAL: Always reset these flags
      setIsApplyingBackground(false);
      isApplyingBackgroundRef.current = false;
    }
  }

  function updateUIState(mode: BackgroundMode, imageUrl?: string) {
    if (mode === 'none') {
      localStorage.setItem('loft.bg.mode', 'none');
      localStorage.removeItem('loft.bg.image');
      setBackgroundModeAndPersist('none');
    } else if (mode === 'blur') {
      localStorage.setItem('loft.bg.mode', 'blur');
      localStorage.removeItem('loft.bg.image');
      setBackgroundModeAndPersist('blur');
    } else if (mode === 'image' && imageUrl) {
      localStorage.setItem('loft.bg.mode', 'image');
      localStorage.setItem('loft.bg.image', imageUrl);
      setBackgroundModeAndPersist('image');
    }
  }

  // Keep the effects preview passive. Applying an effect can turn video on, but opening
  // the tab must not force a user who turned camera off back onto camera.
  useEffect(() => {
    if (!isOpen || !callObject) return;
    if (activeTab !== 'background-effects') return;

    const ensureVideoAvailable = async () => {
      try {
        if (!callObject.localVideo()) return;
      } catch (error) {
        console.error('[Loft Settings] Failed to ensure video availability');
      }
    };

    ensureVideoAvailable();
  }, [isOpen, callObject, activeTab, onPrepareVideoForEffects]);

  // Set up video preview from Daily - ONLY for Effects tab
  useEffect(() => {
    if (!isOpen || !callObject) return;
    if (activeTab !== 'background-effects') return;

    let mounted = true;
    let retryCount = 0;
    const maxRetries = 20;
    let retryTimeout: NodeJS.Timeout;

    const setupVideoPreview = async () => {
      if (!mounted) return;
      
      const desktopVideo = videoRefDesktop.current;
      const mobileVideo = videoRefMobile.current;
      
      if (!desktopVideo && !mobileVideo) {
        if (retryCount < maxRetries) {
          retryCount++;
          retryTimeout = setTimeout(setupVideoPreview, 300);
        }
        return;
      }

        try {
          const localVideo = callObject.localVideo();
          if (!localVideo) {
            return;
          }

        const participants = callObject.participants();
        const localParticipant = participants?.local;
        const videoTrack = localParticipant?.tracks?.video;

        if (videoTrack?.track && (videoTrack.state === 'playable' || videoTrack.state === 'sendable' || videoTrack.state === 'sending')) {
          const trackToUse = videoTrack.track || videoTrack.persistentTrack;
          
          const stream = new MediaStream([trackToUse]);
          
          if (desktopVideo) {
            desktopVideo.srcObject = stream;
            desktopVideo.play().catch(e => {
              desktopVideo.muted = true;
              desktopVideo.play();
            });
          }
          
          if (mobileVideo) {
            mobileVideo.srcObject = stream;
            mobileVideo.play().catch(e => {
              mobileVideo.muted = true;
              mobileVideo.play();
            });
          }
          
          videoStreamRef.current = stream;
        } else if (retryCount < maxRetries) {
          retryCount++;
          retryTimeout = setTimeout(setupVideoPreview, 500);
        }
      } catch (error) {
        console.error('[Loft Settings] Failed to setup video preview');
        if (retryCount < maxRetries) {
          retryCount++;
          retryTimeout = setTimeout(setupVideoPreview, 500);
        }
      }
    };

    setupVideoPreview();

    // Listen for processor changes to refresh preview
    const handleProcessorChange = () => {
      retryCount = 0;
      setupVideoPreview();
    };

    callObject.on('track-started', handleProcessorChange);
    callObject.on('track-updated', handleProcessorChange);
    
    // IMPORTANT: Listen for processor updates
    callObject.on('input-settings-updated', handleProcessorChange);

    return () => {
      mounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      callObject.off('track-started', handleProcessorChange);
      callObject.off('track-updated', handleProcessorChange);
      callObject.off('input-settings-updated', handleProcessorChange);
      
      if (videoRefDesktop.current) videoRefDesktop.current.srcObject = null;
      if (videoRefMobile.current) videoRefMobile.current.srcObject = null;
      videoStreamRef.current = null;
    };
  }, [isOpen, callObject, activeTab]);

  // Load persisted background settings (legacy cleanup)
  useEffect(() => {
    if (!isOpen) return;

    // Clean up old localStorage keys
    localStorage.removeItem('loft.bg.index');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaPermissionState('unsupported');
      setPermissionMessage('This browser does not expose camera or microphone access to Loft.');
      return;
    }

    let cancelled = false;
    const checkBrowserMediaPermissions = async () => {
      if (!navigator.permissions?.query) {
        setMediaPermissionState(null);
        setPermissionMessage(null);
        return;
      }

      try {
        const results = await Promise.allSettled([
          navigator.permissions.query({ name: 'camera' as PermissionName }),
          navigator.permissions.query({ name: 'microphone' as PermissionName }),
        ]);
        if (cancelled) return;

        const states = results
          .filter((result): result is PromiseFulfilledResult<PermissionStatus> => result.status === 'fulfilled')
          .map((result) => result.value.state);

        if (states.includes('denied')) {
          setMediaPermissionState('denied');
          setPermissionMessage('Camera or microphone access is blocked for this browser window. Turn it on in the browser site permissions, return to this tab, then check permissions again.');
        } else if (states.includes('prompt')) {
          setMediaPermissionState('prompt');
          setPermissionMessage('Camera and microphone access needs browser approval before devices can be tested.');
        } else if (states.length > 0 && states.every((state) => state === 'granted')) {
          setMediaPermissionState('granted');
          setPermissionMessage(null);
        } else {
          setMediaPermissionState(null);
          setPermissionMessage(null);
        }
      } catch {
        setMediaPermissionState(null);
        setPermissionMessage(null);
      }
    };

    checkBrowserMediaPermissions();
    window.addEventListener('focus', checkBrowserMediaPermissions);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', checkBrowserMediaPermissions);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const settingsCards = [
    { id: 'audio-video' as SettingsTab, label: 'Audio & video' },
    { id: 'video-quality' as SettingsTab, label: 'Video quality' },
    { id: 'user-preferences' as SettingsTab, label: 'Appearance' },
    { id: 'background-effects' as SettingsTab, label: 'Effects' },
  ];

  return (
    <div className="fixed inset-0 z-[3000] pointer-events-auto">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        className={` 
          absolute inset-x-0 bottom-0 max-h-[calc(100svh-env(safe-area-inset-top)-0.5rem)] rounded-t-3xl border-t
          md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[640px] md:max-w-[calc(100vw-2rem)] md:rounded-none md:border-t-0 md:border-l
          bg-[var(--loft-glass-strong)] text-main border-[var(--loft-border)] shadow-2xl overflow-hidden
          flex flex-col
          transition-all duration-300
        `}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex flex-col px-5 py-4 border-b border-[var(--loft-border)]">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--loft-border)] md:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {view.screen === 'detail' && !isDesktop && (
                <button
                  type="button"
                  onClick={() => setView({ screen: 'home' })}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--loft-surface-2)] transition"
                >
                  <ChevronLeft className="w-4 h-4 text-[var(--loft-text)]" />
                </button>
              )}
              <div>
                <div className="text-[12px] font-black uppercase tracking-[0.35em] text-[var(--loft-text)]">
                  Settings
                </div>
                <div className="text-[10px] font-bold text-muted mt-1">
                  Changes save automatically.
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close settings"
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--loft-surface-2)] hover:bg-[var(--loft-surface-strong)] transition"
            >
              <X className="w-4 h-4 text-[var(--loft-text)]" />
            </button>
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden md:flex border-b border-[var(--loft-border)]">
          {settingsCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setDesktopActiveTab(card.id)}
              className={`
                flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-[0.25em] transition-all
                border-b-2 -mb-px
                ${
                  activeTab === card.id
                    ? 'border-cafe text-[var(--loft-text)]'
                    : 'border-transparent text-muted hover:text-[var(--loft-text)]'
                }
              `}
            >
              {card.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Mobile Home View */}
          {view.screen === 'home' && !isDesktop && (
            <div className="px-4 py-4 space-y-3">
              {settingsCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setView({ screen: 'detail', tab: card.id })}
                  className="w-full bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl p-4 text-left hover:bg-[var(--loft-surface)]/80 transition-all"
                >
                  <div className="text-[12px] font-black uppercase tracking-[0.3em] text-[var(--loft-text)]">
                    {card.label}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Detail View */}
          {(view.screen === 'detail' || isDesktop) && (
            <div className="px-5 py-5">
              {/* Audio & Video Tab */}
              {activeTab === 'audio-video' && (
                <div className="space-y-6">
                  {permissionMessage && (
                    <div className="bg-[var(--loft-surface)] border border-cafe/40 rounded-2xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-cafe" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-main">
                            Camera & Microphone Access
                          </h3>
                          <p className="text-sm text-muted mt-1">
                            {permissionMessage}
                          </p>
                          {mediaPermissionState !== 'denied' && mediaPermissionState !== 'unsupported' && (
                            <button
                              type="button"
                              onClick={requestPermissions}
                              className="mt-3 px-4 py-2 bg-cafe hover:opacity-90 text-[var(--loft-accent-contrast)] text-sm font-medium rounded-lg transition-colors"
                            >
                              Grant Permissions
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {!permissionMessage && !hasDevices && (
                    <div className="bg-[var(--loft-surface)] border border-cafe/40 rounded-2xl p-4">
                      <h3 className="text-sm font-medium text-main">
                        No Devices Detected
                      </h3>
                      <p className="text-sm text-muted mt-1">
                        Loft cannot see any camera or microphone devices in this browser window.
                      </p>
                      <button
                        type="button"
                        onClick={requestPermissions}
                        className="mt-3 px-4 py-2 bg-cafe hover:opacity-90 text-[var(--loft-accent-contrast)] text-sm font-medium rounded-lg transition-colors"
                      >
                        Check Permissions
                      </button>
                    </div>
                  )}

                  {/* Audio Section */}
                  <div className="space-y-3">
                    <div className="text-base font-semibold text-muted">
                      Audio
                    </div>

                    <div className="bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl p-4 space-y-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted">
                          Microphone
                        </div>
                        <DeviceDropdown
                          label=""
                          value={selectedAudioDeviceId}
                          onChange={onAudioDeviceChange}
                          options={audioInputOptions}
                        />
                        {audioInputOptions.length === 0 && (
                          <div className="rounded-xl border border-cafe/30 bg-cafe/10 px-3 py-2 text-xs font-semibold text-[var(--loft-text)]">
                            No microphone devices detected. Grant browser permission, then choose a device.
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted">
                          Speaker / output device
                        </div>
                        <DeviceDropdown
                          label=""
                          value={selectedSpeakerDeviceId || ''}
                          onChange={onSpeakerDeviceChange || (() => {})}
                          options={audioOutputOptions}
                        />
                        {audioOutputOptions.length === 0 && (
                          <div className="rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-3 py-2 text-xs font-semibold text-muted">
                            No speaker output device is exposed by this browser.
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-muted">
                            Microphone level
                          </div>
                          <div className="h-6 rounded-full bg-[var(--loft-surface-2)] border border-[var(--loft-border)] overflow-hidden">
                            <div
                              className="h-full bg-cafe transition-[width] duration-100"
                              style={{ width: `${Math.round((setupMicLevel || 0) * 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium text-muted">
                            Noise reduction
                          </div>
                          <div className="rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-3 py-2 text-xs font-semibold text-muted">
                            Not available in this browser session.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Video Section */}
                  <div className="space-y-3">
                    <div className="text-base font-semibold text-muted">
                      Video
                    </div>

                    <div className="bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl p-4 space-y-4 pb-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-muted">
                            Camera
                          </div>
                          <DeviceDropdown
                            label=""
                            value={selectedVideoDeviceId}
                            onChange={onVideoDeviceChange}
                            options={videoInputOptions}
                          />
                          {videoInputOptions.length === 0 && (
                            <div className="rounded-xl border border-cafe/30 bg-cafe/10 px-3 py-2 text-xs font-semibold text-[var(--loft-text)]">
                              No camera devices detected. Grant browser permission, then choose a device.
                            </div>
                          )}
                          {videoDeviceError && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-500 dark:text-red-300">
                              {videoDeviceError}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-medium text-muted">
                            Camera resolution
                          </div>
                          <DeviceDropdown
                            label=""
                            value="auto"
                            onChange={() => {}}
                            options={[
                              { value: 'auto', label: 'Auto' },
                              { value: '720p', label: '720p' },
                              { value: '1080p', label: '1080p' },
                              { value: '4k', label: '4K' }
                            ]}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted">
                          Mirror camera
                        </div>
                        <Toggle
                          enabled={mirrorCameraEnabled}
                          onChange={() => setMirrorCameraEnabled(!mirrorCameraEnabled)}
                          label="Mirror camera"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Quality Tab */}
              {activeTab === 'video-quality' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="text-base font-semibold text-muted">
                      Video quality settings
                    </div>

                    <div className="text-sm text-muted">
                      Choose how much outgoing video bandwidth Loft should use in this session.
                    </div>

                    <div className="bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl p-4">
                      <div className="space-y-3">
                        {/* Auto */}
                        <button
                          type="button"
                          onClick={() => handleVideoQualityChange('auto')}
                          className="w-full text-left p-3 rounded-lg border border-[var(--loft-border)] hover:bg-[var(--loft-surface-2)] transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-[11px] font-medium text-[var(--loft-text)] group-hover:text-cafe transition-colors">
                                Auto
                              </div>
                              <div className="text-[10px] text-muted mt-1">
                                Loft manages available bandwidth for the current connection.
                              </div>
                            </div>
                            <div className="ml-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                videoQualityPreference === 'auto'
                                  ? 'border-cafe bg-cafe'
                                  : 'border-[var(--loft-border)] bg-transparent'
                              }`}>
                                {videoQualityPreference === 'auto' && (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* High quality */}
                        <button
                          type="button"
                          onClick={() => handleVideoQualityChange('high')}
                          className="w-full text-left p-3 rounded-lg border border-[var(--loft-border)] hover:bg-[var(--loft-surface-2)] transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-[11px] font-medium text-[var(--loft-text)] group-hover:text-cafe transition-colors">
                                High quality
                              </div>
                              <div className="text-[10px] text-muted mt-1">
                                Prioritizes video clarity by lifting Loft's local bandwidth cap.
                              </div>
                            </div>
                            <div className="ml-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                videoQualityPreference === 'high'
                                  ? 'border-cafe bg-cafe'
                                  : 'border-[var(--loft-border)] bg-transparent'
                              }`}>
                                {videoQualityPreference === 'high' && (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* Low quality */}
                        <button
                          type="button"
                          onClick={() => handleVideoQualityChange('low')}
                          className="w-full text-left p-3 rounded-lg border border-[var(--loft-border)] hover:bg-[var(--loft-surface-2)] transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-[11px] font-medium text-[var(--loft-text)] group-hover:text-cafe transition-colors">
                                Low quality
                              </div>
                              <div className="text-[10px] text-muted mt-1">
                                Lowers outgoing video bandwidth for slow or unstable connections.
                              </div>
                            </div>
                            <div className="ml-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                videoQualityPreference === 'low'
                                  ? 'border-cafe bg-cafe'
                                  : 'border-[var(--loft-border)] bg-transparent'
                              }`}>
                                {videoQualityPreference === 'low' && (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* Bandwidth saver */}
                        <button
                          type="button"
                          onClick={() => handleVideoQualityChange('bandwidth_saver')}
                          className="w-full text-left p-3 rounded-lg border border-[var(--loft-border)] hover:bg-[var(--loft-surface-2)] transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-[11px] font-medium text-[var(--loft-text)] group-hover:text-cafe transition-colors">
                                Bandwidth saver
                              </div>
                              <div className="text-[10px] text-muted mt-1">
                                Turns your camera off and keeps outgoing video bandwidth low.
                              </div>
                            </div>
                            <div className="ml-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                videoQualityPreference === 'bandwidth_saver'
                                  ? 'border-cafe bg-cafe'
                                  : 'border-[var(--loft-border)] bg-transparent'
                              }`}>
                                {videoQualityPreference === 'bandwidth_saver' && (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                        {videoQualityStatus && (
                          <div className="rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-3 py-2 text-[10px] font-semibold text-muted">
                            {videoQualityStatus}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* User Preferences Tab */}
              {activeTab === 'user-preferences' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="text-base font-semibold text-muted">
                      Appearance
                    </div>

                    <div className="bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl p-4 space-y-4">
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted">
                          Theme
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {THEME_OPTIONS.map(({ mode, label }) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => onThemeChange(mode)}
                              className={`h-10 rounded-xl border-2 text-[10px] font-black uppercase tracking-[0.25em] transition-all ${
                                themeMode === mode
                                  ? 'border-cafe bg-cafe/15 text-[var(--loft-text)] shadow-lg shadow-cafe/20'
                                  : 'border-[var(--loft-border)] bg-[var(--loft-surface)] text-muted hover:text-[var(--loft-text)]'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted">
                          Profile Avatar
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className={`relative group cursor-pointer${isAvatarUploading ? ' pointer-events-none' : ''}`} onClick={() => {
                            if (isAvatarUploading) return;
                            avatarInputRef.current?.click();
                          }}>
                            <div className="w-16 h-16 rounded-xl border-2 border-[var(--loft-border)] bg-[var(--loft-surface-2)] overflow-hidden relative transition-all hover:border-cafe/60">
                              {(sessionAvatarUrl || profileAvatarUrl) && !avatarLoadError ? (
                                <img 
                                  src={sessionAvatarUrl || profileAvatarUrl} 
                                  className="w-full h-full object-cover" 
                                  alt={`${profileName}'s avatar`}
                                  onError={() => setAvatarLoadError(true)}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[var(--loft-text)] text-lg font-black">
                                  {profileInitials}
                                </div>
                              )}
                              {!isAvatarUploading && (
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                  <Camera className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>
                            <input
                              ref={avatarInputRef}
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.currentTarget.value = '';
                                if (!file) return;
                                handleAvatarUpload(file);
                              }}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-medium text-[var(--loft-text)]">
                              {profileName}
                            </div>
                            <div className="text-[10px] text-muted">
                              Click to change avatar
                            </div>
                          </div>
                        </div>
                        {isAvatarUploading && (
                          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-cafe">
                            Uploading avatar…
                          </div>
                        )}
                        {avatarUploadError && (
                          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-500 dark:text-red-300">
                            {avatarUploadError}
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-muted">
                          Choose Avatar
                        </div>
                        <div className="grid grid-cols-6 gap-2">
                          {AVATAR_OPTIONS.map((avatar) => {
                            const avatarUrl = resolveAvatarUrl(avatar);
                            return (
                              <button
                                key={avatar.seed}
                                type="button"
                                onClick={() => handleAvatarSelect(avatar)}
                                className={`aspect-square rounded-lg border-2 overflow-hidden transition-all hover:border-cafe/60 ${
                                  sessionAvatarUrl === avatarUrl
                                    ? 'border-cafe ring-2 ring-cafe/20'
                                    : 'border-[var(--loft-border)]'
                                }`}
                              >
                                <LoftAvatarToken
                                  kind={avatar.kind}
                                  className="w-full h-full"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Option to revert to profile picture - only show if user has uploaded profile picture */}
                      {hasUploadedProfilePicture && (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={handleRevertToProfilePicture}
                            className="w-full h-9 rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] text-[10px] font-black uppercase tracking-[0.2em] text-muted hover:border-cafe/60 hover:text-cafe transition-all"
                          >
                            Revert to Profile Picture
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Background Effects Tab */}
              {activeTab === 'background-effects' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="text-base font-semibold text-muted">
                      Background effects
                    </div>
                    <div className="text-sm text-muted">
                      Add blur or virtual backgrounds to your video.
                    </div>
                  </div>

                  <div className="bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl p-4 space-y-5">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(14rem,0.9fr)] sm:items-stretch">
                      <div className="flex flex-col gap-3">
                        <div className="text-xs font-black uppercase tracking-[0.22em] text-muted">
                          Preview
                        </div>
                        <div className="relative aspect-video min-h-[180px] rounded-xl overflow-hidden border border-[var(--loft-border)] bg-[var(--loft-avatar-bg)] sm:flex-1">
                          <video
                            ref={videoRefDesktop}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover ${mirrorCameraEnabled ? 'scale-x-[-1]' : ''}`}
                          />
                          {!videoStreamRef.current && (
                            <div className="absolute inset-0 flex items-center justify-center text-muted">
                              <div className="text-center px-4">
                                <div className="text-sm font-medium">Camera preview loading...</div>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="text-xs font-black uppercase tracking-[0.22em] text-muted">
                          Quick effects
                        </div>
                        <div className="grid flex-1 grid-rows-2 gap-3">
                        <button
                          type="button"
                          onClick={() => applyBackground('none')}
                          aria-pressed={backgroundMode === 'none'}
                          className={`w-full text-left p-3 rounded-xl border transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-cafe/60 ${
                            backgroundMode === 'none'
                              ? 'border-cafe bg-[color-mix(in_srgb,var(--loft-accent)_14%,transparent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--loft-accent)_20%,transparent)]'
                              : 'border-[var(--loft-border)] bg-[var(--loft-surface-2)] hover:border-cafe/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-lg bg-[var(--loft-surface)] border border-[var(--loft-border)] flex items-center justify-center">
                                <span className="text-[10px] font-black uppercase">Off</span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-main">No background</div>
                                <div className="text-xs text-muted">Use your original background</div>
                              </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              backgroundMode === 'none'
                                ? 'bg-cafe border-cafe text-[var(--loft-accent-contrast)]'
                                : 'border-[var(--loft-border)] bg-[var(--loft-surface)]'
                            }`}>
                              {backgroundMode === 'none' && <Check className="h-3.5 w-3.5" />}
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => applyBackground('blur')}
                          disabled={blurDisabledCapable}
                          aria-pressed={backgroundMode === 'blur'}
                          className={`w-full text-left p-3 rounded-xl border transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-cafe/60 ${
                            backgroundMode === 'blur'
                              ? 'border-cafe bg-[color-mix(in_srgb,var(--loft-accent)_14%,transparent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--loft-accent)_20%,transparent)]'
                              : blurDisabledCapable
                              ? 'border-[var(--loft-border)] bg-[var(--loft-surface-2)] opacity-50 cursor-not-allowed'
                              : 'border-[var(--loft-border)] bg-[var(--loft-surface-2)] hover:border-cafe/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-lg border border-[var(--loft-border)] bg-[var(--loft-avatar-bg)] flex items-center justify-center">
                                <div className="w-4 h-4 rounded-full bg-cafe/60 blur-[1px]" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-main">Background blur</div>
                                <div className="text-xs text-muted">
                                  {blurDisabledCapable ? 'Unsupported in this browser' : 'Blur your background'}
                                </div>
                              </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              backgroundMode === 'blur'
                                ? 'bg-cafe border-cafe text-[var(--loft-accent-contrast)]'
                                : 'border-[var(--loft-border)] bg-[var(--loft-surface)]'
                            }`}>
                              {backgroundMode === 'blur' && <Check className="h-3.5 w-3.5" />}
                            </div>
                          </div>
                        </button>
                        </div>

                      </div>
                    </div>

                      {backgroundEffectsUnavailableMessage && !bgStatus && !isApplyingBackground && (
                        <div className="rounded-xl border border-cafe/25 bg-cafe/10 px-3 py-2 text-xs font-semibold text-cafe">
                          {backgroundEffectsUnavailableMessage}
                        </div>
                      )}

                      {(isApplyingBackground || bgStatus) && (
                        <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                          bgStatus?.type === 'error'
                            ? 'border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-300'
                            : 'border-cafe/25 bg-cafe/10 text-cafe'
                        }`}>
                          {isApplyingBackground ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Applying background...</span>
                            </div>
                          ) : (
                            bgStatus?.message
                          )}
                        </div>
                      )}

                      {/* Custom Backgrounds */}
                      <div className="space-y-3">
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.22em] text-muted">
                              Loft backgrounds
                            </div>
                            <div className="mt-1 text-xs text-muted">
                              Select a professional backdrop for your session.
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {CUSTOM_BACKDROPS.map((backdrop) => (
                            <button
                              key={backdrop.id}
                              type="button"
                              onClick={() => applyBackground('image', backdrop.fullImage)}
                              disabled={blurDisabledCapable}
                              className={`group relative aspect-video min-h-[116px] rounded-xl border overflow-hidden bg-[var(--loft-surface-2)] transition-all hover:scale-[1.01] ${
                                selectedBackdropId === backdrop.fullImage
                                  ? 'border-cafe ring-2 ring-cafe/20'
                                  : blurDisabledCapable
                                  ? 'border-[var(--loft-border)] opacity-55 cursor-not-allowed'
                                  : 'border-[var(--loft-border)] hover:border-cafe/60'
                              }`}
                              aria-label={blurDisabledCapable ? `${backdrop.label} background unavailable in this browser` : `Use ${backdrop.label} background`}
                            >
                              <img
                                src={backdrop.thumbnail}
                                alt={backdrop.label}
                                className="h-full w-full object-cover opacity-100 saturate-[0.95] contrast-[1.04] transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                              <div className="absolute inset-x-0 bottom-0 px-2.5 py-2 text-left">
                                <div className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-white">
                                  {backdrop.label}
                                </div>
                              </div>
                              {selectedBackdropId === backdrop.fullImage && (
                                <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-cafe text-[var(--loft-accent-contrast)] shadow-lg">
                                  <Check className="h-3.5 w-3.5" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Upload */}
                      <div className="space-y-2">
                        <div className="text-xs font-black uppercase tracking-[0.22em] text-muted">
                          Custom background
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {userCustomBackgrounds.map((bg, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => applyBackground('image', bg.url)}
                              className={`aspect-square rounded-lg border-2 overflow-hidden transition-all hover:scale-[1.02] relative group ${
                                selectedBackdropId === bg.url
                                  ? 'border-cafe ring-2 ring-cafe/20'
                                  : 'border-[var(--loft-border)] hover:border-cafe/60'
                              }`}
                            >
                              <img
                                src={bg.thumbnail}
                                alt={`Custom background ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeCustomBackground(index);
                                }}
                                className="absolute top-1 right-1 w-6 h-6 bg-[var(--loft-text)] text-[var(--loft-bg)] rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                              >
                                x
                              </button>
                            </button>
                          ))}
                          
                          {/* Upload Button */}
                          {userCustomBackgrounds.length < 3 && (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="aspect-square rounded-lg border-2 border-dashed border-[var(--loft-border)] bg-[var(--loft-surface-2)] hover:border-cafe/60 transition-colors flex flex-col items-center justify-center text-muted hover:text-cafe"
                            >
                              <Upload className="w-6 h-6 mb-1" />
                              <span className="text-xs">Upload</span>
                            </button>
                          )}
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleCustomFileSelect}
                        />
                      </div>
                    </div>
                  </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

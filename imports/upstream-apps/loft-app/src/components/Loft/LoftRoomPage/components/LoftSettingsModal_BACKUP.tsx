import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronLeft, Upload, Loader2 } from 'lucide-react';
import AnimatedBackgroundBlobs from '../../AnimatedBackgroundBlobs';
import DailyIframe from '@daily-co/daily-js';

// Daily's built-in backgrounds with preview images
const DAILY_BUILT_IN_BACKDROPS = [
  { 
    id: '1', 
    label: 'Office', 
    dailyIndex: 1,
    previewUrl: 'https://cdn.daily.co/assets/virtual-backgrounds/office.jpg'
  },
  { 
    id: '2', 
    label: 'Living Room', 
    dailyIndex: 2,
    previewUrl: 'https://cdn.daily.co/assets/virtual-backgrounds/living-room.jpg'
  },
  { 
    id: '3', 
    label: 'Cafe', 
    dailyIndex: 3,
    previewUrl: 'https://cdn.daily.co/assets/virtual-backgrounds/cafe.jpg'
  },
  { 
    id: '4', 
    label: 'Outdoors', 
    dailyIndex: 4,
    previewUrl: 'https://cdn.daily.co/assets/virtual-backgrounds/outdoors.jpg'
  },
  { 
    id: '5', 
    label: 'Studio', 
    dailyIndex: 5,
    previewUrl: 'https://cdn.daily.co/assets/virtual-backgrounds/studio.jpg'
  },
  { 
    id: '6', 
    label: 'Modern', 
    dailyIndex: 6,
    previewUrl: 'https://cdn.daily.co/assets/virtual-backgrounds/modern.jpg'
  },
];

type ThemeMode = 'dark' | 'light' | 'auto';

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
  { mode: 'auto', label: 'Auto' },
];

type BackgroundMode = 'none' | 'blur' | 'image';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  onAudioDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;
  setupMicLevel: number;
  backgroundMode: BackgroundMode;
  blurDisabled: boolean;
  setBackgroundModeAndPersist: (mode: BackgroundMode) => void;
  callObject: any;
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
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
  onAudioDeviceChange,
  onVideoDeviceChange,
  setupMicLevel,
  backgroundMode,
  blurDisabled,
  setBackgroundModeAndPersist,
  callObject,
  themeMode,
  onThemeChange,
}) => {
  const [view, setView] = useState<SettingsView>({ screen: 'home' });
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const [desktopActiveTab, setDesktopActiveTab] = useState<SettingsTab>('audio-video');
  const activeTab = isDesktop ? desktopActiveTab : (view.screen === 'detail' ? view.tab : 'audio-video');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  
  const [selectedBackdropIndex, setSelectedBackdropIndex] = useState<number | null>(null);
  const [isApplyingBackground, setIsApplyingBackground] = useState(false);
  const [isUploadingCustom, setIsUploadingCustom] = useState(false);
  const [customBackgroundSlot, setCustomBackgroundSlot] = useState<number | null>(null);
  
  // Use capability-based detection instead of passed blurDisabled prop
  const blurDisabledCapable = useMemo(() => {
    try {
      const supportInfo = DailyIframe.supportedBrowser();
      if (supportInfo && typeof supportInfo === 'object') {
        // Let Daily.co decide, not us
        return !(supportInfo as any).supportsVideoProcessing;
      }
      return true;
    } catch {
      return true;
    }
  }, []);

  // Apply background function with better segmentation
  async function applyBackground(mode: BackgroundMode, dailyIndex?: number) {
    if (!callObject) {
      console.error('[Loft Settings] No callObject available');
      return;
    }
    
    // Check actual Daily.co support (not screen size)
    const supportInfo = DailyIframe.supportedBrowser();
    const supportsProcessing = supportInfo && 
      typeof supportInfo === 'object' && 
      (supportInfo as any).supportsVideoProcessing === true;
    
    console.log('[Loft] Video processing support:', {
      supported: supportsProcessing,
      mobile: (supportInfo as any)?.mobile,
      browser: (supportInfo as any)?.name,
    });
    
    if (!supportsProcessing) {
      // Let Daily tell us it's not supported
      alert('Background effects are not supported on this device/browser. Try Chrome on desktop or iPad.');
      return;
    }

    setIsApplyingBackground(true);

    try {

      // Ensure video is on
      const localVideo = callObject.localVideo();
      if (!localVideo) {
        await callObject.setLocalVideo(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      let processorConfig: any;
      
      if (mode === 'none') {
        processorConfig = {
          type: 'none'
        };
        setSelectedBackdropIndex(null);
      } else if (mode === 'blur') {
        // Improved blur configuration
        processorConfig = {
          type: 'background-blur',
          config: { 
            strength: 1.0  // Maximum strength (0.0 - 1.0)
          }
        };
        setSelectedBackdropIndex(null);
      } else if (mode === 'image' && dailyIndex !== undefined) {
        // Improved segmentation for background images
        processorConfig = {
          type: 'background-image',
          config: { 
            source: dailyIndex,
            // Better edge detection
            edgeBlur: 5,  // Blur the edges more (0-10)
          }
        };
        setSelectedBackdropIndex(dailyIndex);
      }

      if (processorConfig) {
        const inputSettings = {
          video: {
            processor: processorConfig
          }
        };

        
        // Try to apply - Daily will tell us if it fails
        await callObject.updateInputSettings(inputSettings);
        
        updateUIState(mode, dailyIndex);
        
        // Give more time for processor to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (e: any) {
      const errorMessage = typeof e === 'string' ? e : (e?.message || String(e));
      console.error('[Loft Settings] Failed to apply background:', errorMessage);
      
      // Show helpful error based on device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const helpText = isMobile 
        ? 'Background effects may not be supported on this mobile device. Try an iPad or desktop Chrome.'
        : 'Background effects failed. Make sure you\'re using Chrome or Edge.';
      
      alert(`${errorMessage}\n\n${helpText}`);
    } finally {
      setIsApplyingBackground(false);
    }
  }

  // Upload custom background to Daily
  async function uploadCustomBackground(file: File) {
    if (!callObject) {
      console.error('[Loft Settings] No callObject available');
      return;
    }

    setIsUploadingCustom(true);

    try {

      // Find next available slot (7-10 for custom images)
      const customSlot = customBackgroundSlot || 7;

      // Create object URL from file
      const imageUrl = URL.createObjectURL(file);

      // Load image to verify it's valid
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });


      // Apply the custom background
      const inputSettings = {
        video: {
          processor: {
            type: 'background-image',
            config: { 
              source: customSlot,
              edgeBlur: 5
            }
          }
        }
      };

      await callObject.updateInputSettings(inputSettings);
      
      setCustomBackgroundSlot(customSlot);
      setSelectedBackdropIndex(customSlot);
      updateUIState('image', customSlot);

      alert('Custom background uploaded! Note: Due to Daily.co limitations, this may not persist after refresh.');

    } catch (e: any) {
      console.error('[Loft Settings] Failed to upload custom background:', e);
      alert('Failed to upload custom background. Please try a different image (JPEG or PNG, under 5MB).');
    } finally {
      setIsUploadingCustom(false);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG or PNG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }

    uploadCustomBackground(file);
  }

  function updateUIState(mode: BackgroundMode, dailyIndex?: number) {
    if (mode === 'none') {
      localStorage.setItem('loft.bg.mode', 'none');
      localStorage.removeItem('loft.bg.index');
      setBackgroundModeAndPersist('none');
    } else if (mode === 'blur') {
      localStorage.setItem('loft.bg.mode', 'blur');
      localStorage.removeItem('loft.bg.index');
      setBackgroundModeAndPersist('blur');
    } else if (mode === 'image' && dailyIndex !== undefined) {
      localStorage.setItem('loft.bg.mode', 'image');
      localStorage.setItem('loft.bg.index', dailyIndex.toString());
      setBackgroundModeAndPersist('image');
    }
  }

  // Set up video preview from Daily - ONLY for Background Effects tab
  useEffect(() => {
    if (!isOpen || !callObject || !videoRef.current) return;
    if (activeTab !== 'background-effects') return; // Only run on Background Effects tab

    let mounted = true;
    let animationFrameId: number;

    const updateVideoPreview = () => {
      if (!mounted || !videoRef.current) return;

      try {
        const participants = callObject.participants();
        const localParticipant = participants?.local;
        
        if (localParticipant?.video && localParticipant.tracks?.video?.track) {
          const videoTrack = localParticipant.tracks.video.track;
          
          const currentStream = videoRef.current.srcObject as MediaStream | null;
          const currentTrackId = currentStream?.getVideoTracks()[0]?.id;
          
          if (currentTrackId !== videoTrack.id) {
            const stream = new MediaStream([videoTrack]);
            videoRef.current.srcObject = stream;
            videoStreamRef.current = stream;
            videoRef.current.play().catch(e => console.warn('[Loft Settings] Video play failed:', e));
          }
        }
      } catch (error) {
        console.error('[Loft Settings] Failed to update video preview:', error);
      }

      animationFrameId = requestAnimationFrame(updateVideoPreview);
    };

    updateVideoPreview();

    return () => {
      mounted = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      videoStreamRef.current = null;
    };
  }, [isOpen, callObject, activeTab]); // Added activeTab dependency

  // Load persisted background settings
  useEffect(() => {
    if (!isOpen) return;

    const savedMode = localStorage.getItem('loft.bg.mode') as BackgroundMode | null;
    const savedIndex = localStorage.getItem('loft.bg.index');
    
    if (savedIndex) {
      setSelectedBackdropIndex(parseInt(savedIndex, 10));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const settingsCards = [
    { id: 'audio-video' as SettingsTab, label: 'Audio & Video' },
    { id: 'video-quality' as SettingsTab, label: 'Video Quality' },
    { id: 'user-preferences' as SettingsTab, label: 'User Preferences' },
    { id: 'background-effects' as SettingsTab, label: 'Background Effects' },
  ];

  return (
    <div className="fixed inset-0 z-[3000] pointer-events-auto">
      <div className="absolute inset-0 bg-[var(--loft-bg)]" onClick={onClose} />
      
      <div className="absolute inset-0 z-0 pointer-events-none">
        <AnimatedBackgroundBlobs />
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        className="
          absolute inset-0 md:inset-y-10 md:left-1/2 md:-translate-x-1/2 md:w-[720px] md:rounded-[2rem]
          bg-[var(--loft-surface)]/80 dark:bg-[var(--loft-surface)]/75 text-main border border-[var(--loft-border)] shadow-2xl overflow-hidden
          flex flex-col
        "
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex flex-col px-5 py-4 border-b border-[var(--loft-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {view.screen === 'detail' && !isDesktop && (
                <button
                  type="button"
                  onClick={() => setView({ screen: 'home' })}
                  className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition"
                >
                  <ChevronLeft className="w-4 h-4 text-main dark:text-white" />
                </button>
              )}
              <div>
                <div className="text-[12px] font-black uppercase tracking-[0.35em] text-main/70">
                  Settings
                </div>
                <div className="text-[10px] font-bold text-main/50 mt-1">
                  Changes save automatically.
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close settings"
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 transition"
            >
              <X className="w-4 h-4 text-main dark:text-white" />
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
                    ? 'border-cafe text-main dark:text-white'
                    : 'border-transparent text-main/50 dark:text-white/50 hover:text-main/70 dark:hover:text-white/70'
                }
              `}
            >
              {card.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
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
                  <div className="text-[12px] font-black uppercase tracking-[0.3em] text-main/80">
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
                  {/* Audio Section */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-main/50">
                      Audio
                    </div>

                    <div className="bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl p-4 space-y-4">
                      <div className="space-y-2">
                        <div className="text-[9px] font-bold text-main/50 uppercase tracking-[0.28em]">
                          Microphone
                        </div>
                        <div className="rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface)] px-3 py-2">
                          <select
                            value={selectedAudioDeviceId}
                            onChange={(e) => onAudioDeviceChange(e.target.value)}
                            className="w-full bg-transparent text-[11px] text-main/70 outline-none"
                          >
                            {audioDevices.map((device, idx) => (
                              <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microphone ${idx + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[9px] font-bold text-main/50 uppercase tracking-[0.28em]">
                          Input level
                        </div>
                        <div className="h-3 rounded-full bg-black/10 dark:bg-white/15 overflow-hidden">
                          <div
                            className="h-full bg-cafe transition-[width] duration-100"
                            style={{ width: `${Math.round((setupMicLevel || 0) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Video Section */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-main/50">
                      Video
                    </div>

                    <div className="bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl p-4 space-y-4">
                      <div className="space-y-2">
                        <div className="text-[9px] font-bold text-main/50 uppercase tracking-[0.28em]">
                          Camera
                        </div>
                        <div className="rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface)] px-3 py-2">
                          <select
                            value={selectedVideoDeviceId}
                            onChange={(e) => onVideoDeviceChange(e.target.value)}
                            className="w-full bg-transparent text-[11px] text-main/70 outline-none"
                          >
                            {videoDevices.map((device, idx) => (
                              <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Camera ${idx + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Video Quality Tab */}
              {activeTab === 'video-quality' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-main/50">
                      Video Quality Settings
                    </div>

                    <div className="bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl p-4 space-y-4">
                      <div className="text-[11px] text-main/70">
                        Video quality is automatically optimized for your connection.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* User Preferences Tab */}
              {activeTab === 'user-preferences' && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-main/50">
                      Appearance
                    </div>

                    <div className="bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl p-4 space-y-4">
                      <div className="space-y-2">
                        <div className="text-[9px] font-bold text-main/50 uppercase tracking-[0.28em]">
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
                                  ? 'border-cafe bg-cafe/20 text-main dark:text-white shadow-lg shadow-cafe/20'
                                  : 'border-[var(--loft-border)] bg-[var(--loft-surface)] text-main/70 dark:text-white/60 hover:text-main dark:hover:text-white'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Background Effects Tab */}
              {activeTab === 'background-effects' && (
                <div className="space-y-6">
                  {/* Live Video Preview */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-main/50">
                      Preview with Effects
                    </div>
                    <div className="bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl overflow-hidden">
                      <div className="relative aspect-video bg-black">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                          style={{ transform: 'scaleX(-1)' }}
                        />
                        {isApplyingBackground && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <div className="text-white text-sm font-bold">Applying...</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-main/60 italic text-center px-2">
                      💡 Sit 2-3 feet from camera in good lighting for best background separation
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-main/50">
                      Background Effects
                    </div>

                    <div className="bg-[var(--loft-surface)] border border-[var(--loft-border)] rounded-2xl p-4 space-y-4">
                      <div className="space-y-2">
                        <div className="text-[9px] font-bold text-main/50 uppercase tracking-[0.28em]">
                          Background
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => applyBackground('none')}
                            disabled={isApplyingBackground}
                            className={`h-11 rounded-xl border-2 transition-all flex items-center justify-center text-[10px] font-black uppercase tracking-[0.25em] ${
                              backgroundMode === 'none' && selectedBackdropIndex === null
                                ? 'border-cafe bg-cafe/15 text-main'
                                : 'border-[var(--loft-border)] bg-[var(--loft-surface)] text-main/70'
                            } ${isApplyingBackground ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            None
                          </button>
                          <button
                            type="button"
                            onClick={() => applyBackground('blur')}
                            disabled={blurDisabledCapable || isApplyingBackground}
                            className={`h-11 rounded-xl border-2 transition-all flex items-center justify-center text-[10px] font-black uppercase tracking-[0.25em] ${
                              backgroundMode === 'blur'
                                ? 'border-cafe bg-cafe/15 text-main'
                                : 'border-[var(--loft-border)] bg-[var(--loft-surface)] text-main/70'
                            } ${(blurDisabledCapable || isApplyingBackground) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            Blur
                          </button>
                        </div>

                        {blurDisabledCapable && (
                          <div className="mt-2 text-[10px] text-main/50">
                            Blur isn&apos;t supported on this device.
                          </div>
                        )}
                      </div>

                      {/* Built-in Backdrops WITH PREVIEW IMAGES */}
                      <div className="space-y-3">
                        <div className="text-[9px] font-bold text-main/50 uppercase tracking-[0.28em]">
                          Daily Backgrounds
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {DAILY_BUILT_IN_BACKDROPS.map((backdrop) => (
                            <button
                              key={backdrop.id}
                              type="button"
                              onClick={() => applyBackground('image', backdrop.dailyIndex)}
                              disabled={isApplyingBackground}
                              className={`relative aspect-[4/3] rounded-xl border-2 overflow-hidden transition-all ${
                                selectedBackdropIndex === backdrop.dailyIndex && backgroundMode === 'image'
                                  ? 'border-cafe shadow-lg shadow-cafe/20 ring-2 ring-cafe/30'
                                  : 'border-[var(--loft-border)] hover:border-cafe/50'
                              } ${isApplyingBackground ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {/* Preview image with fallback gradient */}
                              <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900">
                                <img 
                                  src={backdrop.previewUrl} 
                                  alt={backdrop.label}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    // Hide broken image, show gradient
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                              <div className="absolute bottom-1 left-1 right-1">
                                <div className="text-[8px] font-black uppercase tracking-[0.2em] text-white/90 text-center">
                                  {backdrop.label}
                                </div>
                              </div>
                              {selectedBackdropIndex === backdrop.dailyIndex && backgroundMode === 'image' && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-cafe rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Background Upload */}
                      <div className="space-y-3">
                        <div className="text-[9px] font-bold text-main/50 uppercase tracking-[0.28em]">
                          Custom Background
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingCustom || isApplyingBackground}
                          className={`w-full h-20 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 ${
                            isUploadingCustom || isApplyingBackground
                              ? 'border-[var(--loft-border)] opacity-50 cursor-not-allowed'
                              : 'border-[var(--loft-border)] hover:border-cafe/50 hover:bg-cafe/5'
                          }`}
                        >
                          {isUploadingCustom ? (
                            <>
                              <Loader2 className="w-5 h-5 text-cafe animate-spin" />
                              <div className="text-[9px] font-bold text-main/50 uppercase tracking-[0.25em]">
                                Uploading...
                              </div>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-main/50" />
                              <div className="text-[9px] font-bold text-main/50 uppercase tracking-[0.25em]">
                                Upload Image
                              </div>
                            </>
                          )}
                        </button>
                        <div className="text-[9px] text-main/50 italic">
                          Upload your own background (JPEG/PNG, max 5MB). Desktop Chrome/Edge only.
                        </div>
                      </div>
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

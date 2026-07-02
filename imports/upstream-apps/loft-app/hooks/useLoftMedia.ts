import { useState, useRef, useEffect, useCallback } from 'react';
import type { DailyCall } from '@daily-co/daily-js';
import { BACKGROUND_PRESETS } from '../constants/media';

type UseLoftMediaOptions = {
  enabled?: boolean;
  callObject?: DailyCall | null;
};

export const useLoftMedia = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options?: UseLoftMediaOptions
) => {
  const enabled = options?.enabled ?? true;
  const callObject = options?.callObject ?? null;
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isPreviewOn, setIsPreviewOn] = useState(false);
  const [selectedBgId, setSelectedBgId] = useState(() => {
    try {
      if (typeof window === 'undefined') return 'none';
      return window.localStorage?.getItem('loft_bg_id') || 'none';
    } catch {
      return 'none';
    }
  });
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [videoDeviceId, setVideoDeviceId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('loft_media_video_device');
    } catch {
      return null;
    }
  });
  const [audioDeviceId, setAudioDeviceId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('loft_media_audio_device');
    } catch {
      return null;
    }
  });
  
  const bgImages = useRef<Record<string, HTMLImageElement>>({});
  const animationFrameId = useRef<number | null>(null);
  const segmentation = useRef<any>(null);
  const isStartingRef = useRef(false);
  const pendingRestartRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const isDev = (import.meta as any).env?.DEV;
  const lastFrameLogTsRef = useRef(0);

  // Pre-load background images
  useEffect(() => {
    BACKGROUND_PRESETS.forEach(preset => {
      if (preset.type === 'image') {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = preset.value;
        bgImages.current[preset.id] = img;
      }
    });
  }, []);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage?.setItem('loft_bg_id', selectedBgId);
    } catch {
      // ignore
    }
  }, [selectedBgId]);

  useEffect(() => {
    if (!isDev) return;
    try {
      // eslint-disable-next-line no-console
    } catch {
      // ignore
    }
  }, [selectedBgId, isDev]);

  const onResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sync dimensions
    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (vw > 0 && vh > 0 && (canvas.width !== vw || canvas.height !== vh)) {
        canvas.width = vw;
        canvas.height = vh;
        if (isDev) {
          try {
            // eslint-disable-next-line no-console
            console.debug('[Loft][MediaPipe] canvas resized', { vw, vh });
          } catch {
            // ignore
          }
        }
    }

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const mask = results?.segmentationMask || null;

    const drawForeground = () => {
      ctx.save();
      if (mask) {
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(mask, 0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(results.image, 0, 0, w, h);
      ctx.restore();
    };

    if (selectedBgId === 'blur') {
      ctx.save();
      ctx.filter = 'blur(10px)';
      ctx.drawImage(results.image, 0, 0, w, h);
      ctx.restore();
      if (mask && isDev) {
        try {
          // eslint-disable-next-line no-console
          console.debug('[Loft][segmentation-results]', { hasMask: !!mask });
        } catch {
          // ignore
        }
      }
      if (mask) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(mask, 0, 0, w, h);
        ctx.restore();
      }
      drawForeground();
    } else if (selectedBgId === 'none') {
      drawForeground();
    } else {
      const bgImg = bgImages.current[selectedBgId];
      if (bgImg) {
        ctx.drawImage(bgImg, 0, 0, w, h);
        if (mask) {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.drawImage(mask, 0, 0, w, h);
          ctx.restore();
        }
        drawForeground();
      } else {
        drawForeground();
      }
    }

    const shouldLogFrame = (() => {
      if (!isDev) return false;
      try {
        if (typeof window === 'undefined') return false;
        return window.localStorage?.getItem('loft_debug_frames') === '1';
      } catch {
        return false;
      }
    })();
    if (shouldLogFrame) {
      const now = Date.now();
      if (now - lastFrameLogTsRef.current >= 1000) {
        lastFrameLogTsRef.current = now;
        try {
          // eslint-disable-next-line no-console
          console.debug('[Loft][Media] frame', { bg: selectedBgId, timestamp: now });
        } catch {
          // ignore
        }
      }
    }
  }, [selectedBgId, canvasRef, videoRef, isDev]);

  // Update the segmentation instance's callback when onResults changes
  useEffect(() => {
    if (segmentation.current) {
      segmentation.current.onResults(onResults);
    }
  }, [onResults]);

  const stopScreenShare = useCallback(async () => {
    if (screenStream) {
      try {
        screenStream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      setScreenStream(null);
    }
    if (callObject?.stopScreenShare) {
      try {
        await Promise.resolve(callObject.stopScreenShare());
      } catch (err) {
        console.warn('[Loft] stopScreenShare daily error', err);
      }
    }
    if ((import.meta as any)?.env?.DEV) {
      console.debug('[Loft] stopScreenShare: stopped daily?', !!callObject);
    }
  }, [screenStream, callObject]);

  const startScreenShare = useCallback(async () => {
    if (!enabled) return null;
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = displayStream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          stopScreenShare();
        };
      }

      if ((import.meta as any)?.env?.DEV) {
        console.debug('[Loft] startScreenShare: got track', !!track, 'daily?', !!callObject);
      }

      if (callObject?.startScreenShare) {
        try {
          if (track) {
            await Promise.resolve(callObject.startScreenShare({ mediaStreamTrack: track } as any));
          } else {
            await Promise.resolve(callObject.startScreenShare());
          }
        } catch (err) {
          console.warn('[Loft] startScreenShare track payload failed, retrying default', err);
          await Promise.resolve(callObject.startScreenShare());
        }
      } else if ((import.meta as any)?.env?.DEV) {
        console.warn('[Loft] startScreenShare: no daily callObject, only local stream');
      }

      setScreenStream(displayStream);
      return displayStream;
    } catch (err) {
      console.error('Screen share error:', err);
      return null;
    }
  }, [enabled, callObject, stopScreenShare]);

  const persistDeviceChoices = useCallback((stream: MediaStream | null) => {
    if (!stream) return;
    try {
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      const videoId = videoTrack?.getSettings()?.deviceId;
      const audioId = audioTrack?.getSettings()?.deviceId;
      if (videoId) {
        localStorage.setItem('loft_media_video_device', videoId);
        setVideoDeviceId(videoId);
      }
      if (audioId) {
        localStorage.setItem('loft_media_audio_device', audioId);
        setAudioDeviceId(audioId);
      }
    } catch {
      // ignore device persistence errors
    }
  }, []);

  const stopMedia = useCallback((clearCanvas = true, keepStreamAlive = false) => {
    if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
    }
    if (segmentation.current) {
        segmentation.current.close();
        segmentation.current = null;
    }
    // 🔥 FIX: Only stop the raw stream if we're fully stopping (not just switching to processed track)
    if (stream && !keepStreamAlive) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (clearCanvas) {
      // Clear canvas on true stop
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    // 🔥 FIX: Only clear preview state if we're fully stopping
    if (!keepStreamAlive) {
      setIsPreviewOn(false);
    }
    setPreviewError(null);

    if (clearCanvas && videoRef.current && !keepStreamAlive) {
      try {
        (videoRef.current as any).srcObject = null;
      } catch {
        // ignore
      }
    }
  }, [stream, canvasRef]);

  const startMedia = useCallback(async (force = false) => {
    if (!enabled) return;
    if (isPreviewOn && !force) return;
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    setIsModelLoading(true);
    setPreviewError(null);
    try {
      const tryConstraints = async (strict: boolean) => {
        return await navigator.mediaDevices.getUserMedia({
          video: videoDeviceId
            ? strict
              ? { width: 1280, height: 720, deviceId: { exact: videoDeviceId } }
              : { width: 1280, height: 720, deviceId: videoDeviceId }
            : { width: 1280, height: 720 },
          audio: audioDeviceId
            ? strict
              ? { deviceId: { exact: audioDeviceId } }
              : { deviceId: audioDeviceId }
            : true,
        });
      };

      let newStream: MediaStream;
      try {
        newStream = await tryConstraints(true);
      } catch {
        // Fallback: some devices (esp. external webcams) fail exact constraints
        newStream = await tryConstraints(false);
      }

      const vt = newStream.getVideoTracks()[0];
      if (!vt) {
        newStream.getTracks().forEach(t => t.stop());
        throw new Error('No video track available from selected camera.');
      }
      if (isDev) {
        try {
          const settings = vt.getSettings ? vt.getSettings() : {};
          // eslint-disable-next-line no-console
          console.debug('[Loft][Media] camera start', {
            label: vt.label,
            deviceId: settings?.deviceId,
          });
        } catch {
          // ignore
        }
      }
      persistDeviceChoices(newStream);
      setStream(newStream);
      setIsPreviewOn(true);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play().catch(() => {
          // Ignore AbortError / autoplay quirks; the rAF loop will resume once playable.
        });
      }

      // Wait for video dimensions to become available before starting segmentation.
      const waitForVideoReady = async () => {
        const video = videoRef.current;
        if (!video) return false;
        for (let i = 0; i < 40; i++) {
          const vw = video.videoWidth || 0;
          const vh = video.videoHeight || 0;
          if (vw > 0 && vh > 0 && video.readyState >= 2) return true;
          await new Promise((r) => setTimeout(r, 50));
        }
        return false;
      };

      const videoReady = await waitForVideoReady();
      if (isDev) {
        try {
          const v = videoRef.current;
          // eslint-disable-next-line no-console
          console.debug('[Loft][Media] video ready', {
            ok: videoReady,
            readyState: v?.readyState,
            vw: v?.videoWidth,
            vh: v?.videoHeight,
            trackState: newStream.getVideoTracks?.()[0]?.readyState,
          });
        } catch {
          // ignore
        }
      }

      // Initialize MediaPipe if not present
      if (typeof (window as any).SelfieSegmentation !== 'undefined') {
        if (!videoReady) {
          // If we don't have dimensions yet, avoid starting the segmentation loop.
          // The caller can retry (e.g., via restartMedia).
          return;
        }
        segmentation.current = new (window as any).SelfieSegmentation({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });
        segmentation.current.setOptions({ modelSelection: 1, selfThreshold: 0.5 });
        segmentation.current.onResults(onResults);
        if (isDev) {
          try {
            // eslint-disable-next-line no-console
            console.debug('[Loft][Media] segmentation start', { modelSelection: 1 });
          } catch {
            // ignore
          }
        }

        const process = async () => {
          if (!segmentation.current) return;
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              await segmentation.current.send({ image: videoRef.current });
            } catch (err) {
              // ignore
            }
          }
          animationFrameId.current = requestAnimationFrame(process);
        };

        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
        process();
      }
    } catch (err) {
      setIsPreviewOn(false);
      const anyErr = err as any;
      const name = anyErr?.name ? String(anyErr.name) : 'MediaError';
      const message = anyErr?.message ? String(anyErr.message) : String(err);
      const msg = `${name}: ${message}`;
      setPreviewError(msg);

      if (lastErrorRef.current !== msg) {
        lastErrorRef.current = msg;
        console.error('Preview media error:', msg);
      }
    } finally {
      setIsModelLoading(false);
      isStartingRef.current = false;
    }
  }, [videoRef, onResults, isPreviewOn, videoDeviceId, audioDeviceId]);

  const restartMedia = useCallback(async () => {
    if (!enabled) return;
    if (isStartingRef.current) {
      pendingRestartRef.current = true;
      return;
    }
    stopMedia(false);
    await startMedia(true);
  }, [stopMedia, startMedia]);

  const setPreferredDevices = useCallback(
    async (next: { videoDeviceId?: string | null; audioDeviceId?: string | null }) => {
      if (typeof next.videoDeviceId !== 'undefined') setVideoDeviceId(next.videoDeviceId);
      if (typeof next.audioDeviceId !== 'undefined') setAudioDeviceId(next.audioDeviceId);
      if (isPreviewOn) {
        if (isStartingRef.current) {
          pendingRestartRef.current = true;
          return;
        }
        await restartMedia();
      }
    },
    [isPreviewOn, restartMedia]
  );

  useEffect(() => {
    if (!pendingRestartRef.current) return;
    if (isStartingRef.current) return;
    if (!isPreviewOn) {
      pendingRestartRef.current = false;
      return;
    }
    pendingRestartRef.current = false;
    restartMedia();
  }, [isPreviewOn, restartMedia]);

  const toggleMedia = useCallback(() => {
    if (!enabled) return;
    if (isPreviewOn) stopMedia();
    else startMedia();
  }, [isPreviewOn, stopMedia, startMedia]);

  useEffect(() => {
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (segmentation.current) segmentation.current.close();
      if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    };
  }, [screenStream]);

  const applyBackgroundMode = useCallback((mode: 'none' | 'blur' | 'image') => {
    setSelectedBgId(mode);
  }, [setSelectedBgId]);

  return {
    stream,
    screenStream,
    isPreviewOn,
    previewError,
    selectedBgId,
    setSelectedBgId,
    applyBackgroundMode,
    toggleMedia,
    stopMedia,
    startMedia, // 🔥 FIX: Expose startMedia for auto-start
    restartMedia,
    setPreferredDevices,
    startScreenShare,
    stopScreenShare,
    isModelLoading
  };
};
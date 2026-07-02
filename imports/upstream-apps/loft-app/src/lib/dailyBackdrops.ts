import DailyIframe from '@daily-co/daily-js';

export type DailySupportInfo = {
  supportsVideoProcessing?: boolean;
  supportsAudioProcessing?: boolean;
  supportsMediaDevices?: boolean;
  supportsDisplayCapture?: boolean;
  supportsGetDisplayMedia?: boolean;
  supportsFullscreen?: boolean;
  supportsSfu?: boolean;
  supportsP2P?: boolean;
  supportsSimulcast?: boolean;
  [key: string]: any;
} | null;

export function getDailySupportInfo(): DailySupportInfo {
  try {
    const supported = (DailyIframe as any)?.supportedBrowser?.();
    if (!supported || typeof supported !== 'object') {
      return null;
    }
    return supported;
  } catch {
    return null;
  }
}

export function supportsDailyBackdrops(): boolean {
  try {
    return getDailySupportInfo()?.supportsVideoProcessing === true;
  } catch {
    return false;
  }
}

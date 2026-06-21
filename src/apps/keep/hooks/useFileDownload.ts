import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

interface UseFileDownloadOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface DownloadResult {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  error?: string;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

export function useFileDownload(options: UseFileDownloadOptions = {}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadFile = useCallback(async (fileId: string, action: 'download' | 'open' = 'download'): Promise<DownloadResult> => {
    setIsDownloading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL not configured');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/keep-file-download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId, action }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Download failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data?.success) {
        throw new Error(data?.error || 'Download failed');
      }

      return {
        success: true,
        downloadUrl: data.downloadUrl,
        fileName: data.file?.fileName,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      setError(message);
      options.onError?.(message);
      return { success: false, error: message };
    } finally {
      setIsDownloading(false);
    }
  }, [options]);

  const executeDownload = useCallback(async (fileId: string, fileName?: string) => {
    const result = await downloadFile(fileId, 'download');

    if (result.success && !result.downloadUrl) {
      const message = 'Download URL was not returned';
      setError(message);
      options.onError?.(message);
      return { success: false, error: message };
    }

    if (result.success && result.downloadUrl) {
      window.location.assign(result.downloadUrl);
      options.onSuccess?.();
    }

    return result;
  }, [downloadFile, options]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    downloadFile,
    executeDownload,
    isDownloading,
    error,
    clearError,
  };
}

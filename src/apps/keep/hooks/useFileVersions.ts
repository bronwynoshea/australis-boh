import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { UploadFile } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

export interface FileVersion {
  id: string;
  file_id: string;
  version_number: number;
  storage_bucket: string;
  storage_path: string;
  file_size_bytes: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
  change_reason: string | null;
}

interface UseFileVersionsResult {
  versions: FileVersion[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  uploadNewVersion: (file: File, reason?: string) => Promise<boolean>;
  isUploading: boolean;
  uploadProgress: UploadFile[];
}

export function useFileVersions(
  fileId: string | undefined,
  options: { onUploadSuccess?: () => void; onUploadError?: (error: string) => void } = {}
): UseFileVersionsResult {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadFile[]>([]);

  const fetchVersions = useCallback(async () => {
    if (!fileId) {
      setVersions([]);
      return;
    }

    setLoading(true);
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

      const response = await fetch(
        `${supabaseUrl}/functions/v1/keep-file-versions?file_id=${encodeURIComponent(fileId)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch versions: ${response.status}`);
      }

      const data = await response.json();

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch versions');
      }

      setVersions(data.versions || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch versions';
      setError(message);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  const uploadNewVersion = useCallback(async (file: File, reason?: string): Promise<boolean> => {
    if (!fileId) {
      setError('No file selected');
      return false;
    }

    setIsUploading(true);
    setUploadProgress([{ file, progress: 0, status: 'uploading' }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL not configured');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('file_id', fileId);
      if (reason) {
        formData.append('reason', reason);
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/keep-file-versions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data?.success) {
        throw new Error(data?.error || 'Upload failed');
      }

      setUploadProgress([{ file, progress: 100, status: 'success' }]);
      options.onUploadSuccess?.();
      
      // Refresh versions list
      await fetchVersions();
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      setUploadProgress([{ file, progress: 0, status: 'error', error: message }]);
      options.onUploadError?.(message);
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [fileId, fetchVersions, options]);

  // Fetch versions on mount and when fileId changes
  const refetch = fetchVersions;

  return {
    versions,
    loading,
    error,
    refetch,
    uploadNewVersion,
    isUploading,
    uploadProgress,
  };
}

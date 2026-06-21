import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { UploadFile } from '../types';

// Get Supabase URL from environment (same pattern as lib/supabase.ts)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

interface UseSupabaseUploadOptions {
  folderId: string;
}

function getFileRelativePath(file: File): string | null {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (!relativePath) return null;

  const normalized = relativePath.replace(/\\/g, '/');
  const segments = normalized
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean);

  if (
    segments.length === 0 ||
    normalized.startsWith('/') ||
    normalized.includes('://') ||
    segments.some(segment => segment === '.' || segment === '..')
  ) {
    return null;
  }

  return segments.join('/');
}

export function useSupabaseUpload(options: UseSupabaseUploadOptions) {
  const { folderId } = options;
  const [uploads, setUploads] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = async (files: File[]) => {
    if (!folderId) {
      console.error('[useSupabaseUpload] No folderId provided');
      return;
    }

    setUploading(true);

    const newUploads: UploadFile[] = files.map(file => ({
      file,
      relativePath: getFileRelativePath(file) || undefined,
      progress: 0,
      status: 'pending' as const,
    }));

    setUploads(prev => [...prev, ...newUploads]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadIndex = uploads.length + i;

      try {
        setUploads(prev => {
          const updated = [...prev];
          updated[uploadIndex] = { ...updated[uploadIndex], status: 'uploading', progress: 50 };
          return updated;
        });

        // Create FormData for multipart upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder_id', folderId);
        const relativePath = getFileRelativePath(file);
        if (relativePath) {
          formData.append('relative_path', relativePath);
        }

        // Use fetch directly for multipart/form-data
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          throw new Error('Not authenticated');
        }

        if (!supabaseUrl) {
          throw new Error('SUPABASE_URL not configured');
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/keep-upload-file`, {
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

        setUploads(prev => {
          const updated = [...prev];
          updated[uploadIndex] = { ...updated[uploadIndex], status: 'success', progress: 100 };
          return updated;
        });
      } catch (err) {
        console.error('[useSupabaseUpload] Upload error:', err);
        setUploads(prev => {
          const updated = [...prev];
          updated[uploadIndex] = {
            ...updated[uploadIndex],
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          };
          return updated;
        });
      }
    }

    setUploading(false);
  };

  const clearUploads = () => {
    setUploads([]);
  };

  return {
    uploads,
    uploading,
    uploadFiles,
    clearUploads,
  };
}

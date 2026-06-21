import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { KeepFile, KeepFileItem } from '../types';

interface UseSupabaseFilesOptions {
  folderId?: string;
  area?: 'workspace' | 'gold_library';
  lifecycleStatus?: string;
  includeInactive?: boolean;
}

function displayFileName(fileName: string, fileExt: string): string {
  const baseName = fileName.replace(/\\/g, '/').split('/').filter(Boolean).pop() || fileName;
  return fileExt ? `${baseName}.${fileExt}` : baseName;
}

function transformKeepFileToFileItem(file: KeepFile & { uploaded_by_name?: string }): KeepFileItem {
  return {
    id: file.id,
    name: displayFileName(file.file_name, file.file_ext),
    mimeType: file.mime_type,
    size: file.file_size_bytes,
    modifiedTime: file.updated_at,
    isFolder: false,
    fileExt: file.file_ext,
    folderId: file.folder_id,
    uploadedBy: file.uploaded_by,
    uploadedByName: file.uploaded_by_name,
    hasGoldLibraryCopy: Boolean(file.has_gold_library_copy),
    goldLibraryFileId: file.gold_library_file_id,
    goldLibraryStatus: file.gold_library_status,
  };
}

export function useSupabaseFiles(options: UseSupabaseFilesOptions = {}) {
  const { folderId, area, lifecycleStatus, includeInactive = false } = options;
  const [files, setFiles] = useState<KeepFileItem[]>([]);
  const [rawFiles, setRawFiles] = useState<KeepFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    // Only fetch if we have a folderId or area
    if (!folderId && !area) {
      setFiles([]);
      setRawFiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build query string for GET request
      const queryParams = new URLSearchParams();
      if (folderId) queryParams.set('folder_id', folderId);
      if (area) queryParams.set('area', area);
      if (lifecycleStatus) queryParams.set('lifecycle_status', lifecycleStatus);
      if (includeInactive) queryParams.set('include_inactive', 'true');

      const queryString = queryParams.toString();
      const functionName = queryString ? `keep-files?${queryString}` : 'keep-files';

      const { data, error: invokeError } = await supabase.functions.invoke(functionName, {
        method: 'GET',
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to fetch files');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch files');
      }

      const keepFiles: (KeepFile & { uploaded_by_name?: string })[] = data.files || [];
      setRawFiles(keepFiles);
      setFiles(keepFiles.map(transformKeepFileToFileItem));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch files';
      setError(message);
      setFiles([]);
      setRawFiles([]);
      console.error('[useSupabaseFiles] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [folderId, area, lifecycleStatus, includeInactive]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return {
    files,
    rawFiles,
    loading,
    error,
    refetch: fetchFiles,
  };
}

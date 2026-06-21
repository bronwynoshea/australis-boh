import { useState, useEffect } from 'react';
import { keepApi } from '../api/keepApi';
import type { DriveFile } from '../types';

export function useKeepFiles(sectionSlug?: string, folderId?: string, area?: 'workspace' | 'vault') {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async () => {
    if (!sectionSlug && !folderId) {
      setFiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await keepApi.listFiles({ sectionSlug, folderId, area });
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [sectionSlug, folderId, area]);

  return {
    files,
    loading,
    error,
    refetch: fetchFiles,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { KeepFolder } from '../types';

export function useFolderAncestors(folderId: string | null) {
  const [ancestors, setAncestors] = useState<KeepFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAncestors = useCallback(async () => {
    if (!folderId) {
      setAncestors([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ancestorChain: KeepFolder[] = [];
      let currentId: string | null = folderId;

      // Walk up the parent chain
      while (currentId) {
        const queryParams = new URLSearchParams();
        queryParams.set('folder_id', currentId);
        queryParams.set('include_inactive', 'true');

        const { data, error: invokeError } = await supabase.functions.invoke(
          `keep-folder-by-id?${queryParams.toString()}`,
          { method: 'GET' }
        );

        if (invokeError) {
          throw new Error(invokeError.message || 'Failed to fetch folder');
        }

        if (!data?.success || !data.folder) {
          break;
        }

        const folder: KeepFolder = data.folder;
        ancestorChain.unshift(folder); // Add to beginning (root first)
        currentId = folder.parent_id;
      }

      setAncestors(ancestorChain);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch folder ancestors';
      setError(message);
      console.error('[useFolderAncestors] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    fetchAncestors();
  }, [fetchAncestors]);

  return {
    ancestors,
    loading,
    error,
    refetch: fetchAncestors,
  };
}

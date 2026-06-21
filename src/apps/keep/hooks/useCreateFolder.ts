import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { KeepFolder } from '../types';

interface CreateFolderOptions {
  parentId: string;
  name: string;
}

interface CreateFolderResult {
  folder: KeepFolder | null;
  error: string | null;
}

export function useCreateFolder() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createFolder = useCallback(async (options: CreateFolderOptions): Promise<CreateFolderResult> => {
    setIsCreating(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('keep-create-folder', {
        method: 'POST',
        body: {
          parent_id: options.parentId,
          name: options.name,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to create folder');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create folder');
      }

      return {
        folder: data.folder,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create folder';
      setError(message);
      return {
        folder: null,
        error: message,
      };
    } finally {
      setIsCreating(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    createFolder,
    isCreating,
    error,
    clearError,
  };
}

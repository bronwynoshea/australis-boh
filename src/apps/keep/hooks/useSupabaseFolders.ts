import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { KeepFolder } from '../types';

interface UseSupabaseFoldersOptions {
  area?: 'workspace' | 'gold_library';
  parentId?: string | null;
  includeInactive?: boolean;
  systemFolderName?: string; // If set, finds this system folder and returns its children
}

export function useSupabaseFolders(options: UseSupabaseFoldersOptions = {}) {
  const { area, parentId, includeInactive = false, systemFolderName } = options;
  const [folders, setFolders] = useState<KeepFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Special case: if systemFolderName is provided, find that folder first then load its children
      if (systemFolderName && area) {
        // Step 1: Find the system folder
        const findQueryParams = new URLSearchParams();
        findQueryParams.set('area', area);
        findQueryParams.set('parent_id', ''); // root level
        findQueryParams.set('include_inactive', 'true');

        const findQueryString = findQueryParams.toString();
        const findFunctionName = `keep-folders?${findQueryString}`;

        const { data: rootData, error: rootError } = await supabase.functions.invoke(findFunctionName, {
          method: 'GET',
        });

        if (rootError) {
          throw new Error(rootError.message || 'Failed to fetch root folders');
        }

        const rootFolders = rootData?.folders || [];
        console.log(`[useSupabaseFolders] Area: ${area}, Looking for: "${systemFolderName}"`);
        console.log(`[useSupabaseFolders] Root folders found:`, rootFolders.map((f: KeepFolder) => ({ name: f.name, id: f.id })));

        // If no root folders at all, show empty
        if (rootFolders.length === 0) {
          console.warn(`[useSupabaseFolders] No root folders found for area: ${area}`);
          setFolders([]);
          setLoading(false);
          return;
        }

        // Try to find the system folder (e.g., "Workspace" or "Gold Library")
        const systemFolder = rootFolders.find((f: KeepFolder) =>
          f.name.toLowerCase() === systemFolderName.toLowerCase()
        );

        if (!systemFolder) {
          // Fallback: If no system folder found, just show all root folders
          // This handles cases where folders are directly at root level
          console.log(`[useSupabaseFolders] No system folder "${systemFolderName}" found, showing all ${rootFolders.length} root folders`);
          setFolders(rootFolders);
          setLoading(false);
          return;
        }
        console.log(`[useSupabaseFolders] Found system folder:`, systemFolder.name, systemFolder.id);

        // Step 2: Load children of the system folder
        const childQueryParams = new URLSearchParams();
        childQueryParams.set('area', area);
        childQueryParams.set('parent_id', systemFolder.id);
        if (includeInactive) childQueryParams.set('include_inactive', 'true');

        const childQueryString = childQueryParams.toString();
        const childFunctionName = `keep-folders?${childQueryString}`;

        console.log(`[useSupabaseFolders] Loading children of "${systemFolder.name}" with parent_id: ${systemFolder.id}`);

        const { data: childData, error: childError } = await supabase.functions.invoke(childFunctionName, {
          method: 'GET',
        });

        if (childError) {
          throw new Error(childError.message || 'Failed to fetch child folders');
        }

        console.log(`[useSupabaseFolders] Children found: ${childData?.folders?.length || 0}`, childData?.folders?.map((f: KeepFolder) => f.name));
        setFolders(childData?.folders || []);
        return;
      }

      // Standard case: Build query string for GET request
      const queryParams = new URLSearchParams();
      if (area) queryParams.set('area', area);
      if (parentId !== undefined) queryParams.set('parent_id', parentId ?? '');
      if (includeInactive) queryParams.set('include_inactive', 'true');

      const queryString = queryParams.toString();
      const functionName = queryString ? `keep-folders?${queryString}` : 'keep-folders';

      const { data, error: invokeError } = await supabase.functions.invoke(functionName, {
        method: 'GET',
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to fetch folders');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch folders');
      }

      setFolders(data.folders || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch folders';
      setError(message);
      setFolders([]);
      console.error('[useSupabaseFolders] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [area, parentId, includeInactive, systemFolderName]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  return {
    folders,
    loading,
    error,
    refetch: fetchFolders,
  };
}

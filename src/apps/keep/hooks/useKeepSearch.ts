import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { KeepFileItem, KeepFolder } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

interface UseKeepSearchOptions {
  area: 'workspace' | 'gold_library';
  query: string;
}

interface UseKeepSearchResult {
  results: KeepFileItem[];
  loading: boolean;
  error: string | null;
}

function toFileItem(file: any): KeepFileItem {
  const baseName = String(file.file_name || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || file.file_name;

  return {
    id: file.id,
    name: file.file_ext ? `${baseName}.${file.file_ext}` : baseName,
    mimeType: file.mime_type || 'application/octet-stream',
    size: file.file_size_bytes ?? null,
    modifiedTime: file.updated_at || file.created_at || '',
    isFolder: false,
    fileExt: file.file_ext,
    folderId: file.folder_id,
    uploadedBy: file.uploaded_by,
    uploadedByName: file.uploaded_by_name,
    type: file.type,
    subtype: file.subtype,
  };
}

function toFolderItem(folder: KeepFolder): KeepFileItem {
  return {
    id: folder.id,
    name: folder.name,
    mimeType: 'application/vnd.google-apps.folder',
    size: null,
    modifiedTime: '',
    isFolder: true,
    folderId: folder.parent_id || undefined,
  };
}

export function useKeepSearch({ area, query }: UseKeepSearchOptions): UseKeepSearchResult {
  const [results, setResults] = useState<KeepFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      if (!supabaseUrl) throw new Error('SUPABASE_URL not configured');

      const params = new URLSearchParams({ area, q: trimmed });
      const response = await fetch(`${supabaseUrl}/functions/v1/keep-search?${params.toString()}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Search failed');
      }

      const folders = (data.folders || []).map(toFolderItem);
      const files = (data.files || []).map(toFileItem);
      setResults([...folders, ...files]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [area]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      search(query);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query, search]);

  return { results, loading, error };
}

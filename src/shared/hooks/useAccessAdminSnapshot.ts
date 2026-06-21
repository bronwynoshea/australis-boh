import { useCallback, useEffect, useState } from 'react';
import { fetchAccessAdminSnapshot, type AccessAdminSnapshot } from '../../boh/api/bohApi';

interface UseAccessAdminSnapshotResult {
  snapshot: AccessAdminSnapshot | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAccessAdminSnapshot(): UseAccessAdminSnapshotResult {
  const [snapshot, setSnapshot] = useState<AccessAdminSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAccessAdminSnapshot();
      setSnapshot(data);
    } catch (err) {
      console.error('[AccessAdmin] Failed to load snapshot', err);
      setError(err instanceof Error ? err.message : 'Failed to load access data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  return {
    snapshot,
    isLoading,
    error,
    refresh: loadSnapshot,
  };
}

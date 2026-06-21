import { useCallback, useEffect, useState } from 'react';
import type { BohApp } from '../../boh/api/bohApi';
import { fetchBohAppRegistry } from '../../boh/api/bohApi';

interface UseBohAppRegistryResult {
  apps: BohApp[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBohAppRegistry(): UseBohAppRegistryResult {
  const [apps, setApps] = useState<BohApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const registry = await fetchBohAppRegistry();
      setApps(registry);
    } catch (err) {
      console.error('[AccessAdmin] Failed to load BOH app registry', err);
      setError(err instanceof Error ? err.message : 'Failed to load BOH apps');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  return {
    apps,
    isLoading,
    error,
    refresh: loadApps,
  };
}

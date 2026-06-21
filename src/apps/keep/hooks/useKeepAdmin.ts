import { useState, useEffect } from 'react';
import { keepApi } from '../api/keepApi';
import type { KeepUserAccess } from '../types';

export function useKeepAdmin() {
  const [userAccess, setUserAccess] = useState<KeepUserAccess[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserAccess = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await keepApi.getUserAccess();
      setUserAccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user access');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserAccess();
  }, []);

  const grantAccess = async (userId: string, sectionSlug: string) => {
    try {
      await keepApi.grantUserAccess({ userId, sectionSlug });
      await fetchUserAccess();
    } catch (err) {
      throw err;
    }
  };

  const revokeAccess = async (id: string) => {
    try {
      await keepApi.revokeUserAccess(id);
      await fetchUserAccess();
    } catch (err) {
      throw err;
    }
  };

  return {
    userAccess,
    loading,
    error,
    grantAccess,
    revokeAccess,
    refetch: fetchUserAccess,
  };
}

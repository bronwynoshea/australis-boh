import { useState, useEffect } from 'react';
import { fetchPatronOrganisations } from '../api/patronApiMock';
import type { PatronOrganisation } from '../types';

interface UsePatronOrganisationsFilters {
  search?: string;
  pipelineStageId?: string;
}

export function usePatronOrganisations(filters?: UsePatronOrganisationsFilters) {
  const [organisations, setOrganisations] = useState<PatronOrganisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPatronOrganisations(filters);
      setOrganisations(data);
    } catch (err) {
      console.error('Error loading patron organisations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organisations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [filters?.search, filters?.pipelineStageId]);

  return { organisations, loading, error, refetch };
}


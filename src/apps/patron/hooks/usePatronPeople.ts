import { useState, useEffect } from 'react';
import { fetchPatronPeople } from '../api/patronApi';
import type { PatronPerson } from '../types';

interface UsePatronPeopleFilters {
  search?: string;
  pipelineStageId?: string;
  assignedTo?: string;
}

export function usePatronPeople(filters?: UsePatronPeopleFilters) {
  const [people, setPeople] = useState<PatronPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPatronPeople(filters);
      setPeople(data);
    } catch (err) {
      console.error('Error loading patron people:', err);
      setError(err instanceof Error ? err.message : 'Failed to load people');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [filters?.search, filters?.pipelineStageId, filters?.assignedTo]);

  return { people, loading, error, refetch };
}


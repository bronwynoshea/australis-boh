import { useState, useEffect } from 'react';
import { fetchPatronActivities } from '../api/patronApi';
import type { PatronActivity } from '../types';

interface UsePatronActivitiesFilters {
  personId?: string;
  organisationId?: string;
}

export function usePatronActivities(filters?: UsePatronActivitiesFilters) {
  const [activities, setActivities] = useState<PatronActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivities = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPatronActivities(filters);
        setActivities(data);
      } catch (err) {
        console.error('Error loading patron activities:', err);
        setError(err instanceof Error ? err.message : 'Failed to load activities');
      } finally {
        setLoading(false);
      }
    };

    loadActivities();
  }, [filters?.personId, filters?.organisationId]);

  return { activities, loading, error };
}


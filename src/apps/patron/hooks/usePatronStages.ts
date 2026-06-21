import { useState, useEffect } from 'react';
import { fetchPatronStages } from '../api/patronApiMock';
import type { PatronPipelineStage } from '../types';

export function usePatronStages() {
  const [stages, setStages] = useState<PatronPipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStages = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPatronStages();
        setStages(data);
      } catch (err) {
        console.error('Error loading patron stages:', err);
        setError(err instanceof Error ? err.message : 'Failed to load stages');
      } finally {
        setLoading(false);
      }
    };

    loadStages();
  }, []);

  return { stages, loading, error };
}


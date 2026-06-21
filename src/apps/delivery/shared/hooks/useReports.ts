import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';
import type {
  OverviewReportData,
  InitiativeDetailReport,
  MinorReleaseReport,
  ExecutiveSummaryReport,
  ReportWindow,
  InitiativeReadiness,
} from '../types/reporting';

interface UseOverviewReportOptions {
  report_window: ReportWindow;
  app_id?: string;
  quarter?: string;
  year?: number;
  readiness_filter?: InitiativeReadiness;
  enabled?: boolean; // Add manual control
}

export function useOverviewReport(options: UseOverviewReportOptions) {
  const [data, setData] = useState<OverviewReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const fetchData = useCallback(async () => {
    // Prevent multiple simultaneous calls using ref
    if (isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Get current user session for proper authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setError('Authentication required: Please log in');
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/menu-product-release-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(options),
        }
      );

      const result = await response.json();

      if (response.ok && result.success && result.data) {
        setData(result.data);
      } else {
        // Handle both HTTP errors and API errors
        const errorMessage = result.error?.message || result.error || 'Failed to load report data';
        setError(errorMessage);
        console.error('[useOverviewReport] API Error:', result);
      }
    } catch (err) {
      console.error('[useOverviewReport] Network Error:', err);
      setError('Network error: Failed to connect to server');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [options]);

  // Only auto-fetch if enabled is true (default to false for manual execution)
  useEffect(() => {
    if (options.enabled) {
      fetchData();
    }
  }, [fetchData, options.enabled]);

  return { data, isLoading, error, refetch: fetchData };
}

export function useInitiativeDetailReport(initiativeId: string | null) {
  const [data, setData] = useState<InitiativeDetailReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!initiativeId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get current user session for proper authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setError('Authentication required: Please log in');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/menu-initiative-report-detail`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ initiative_id: initiativeId }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success && result.data) {
        setData(result.data);
      } else {
        const errorMessage = result.error?.message || result.error || 'Failed to load initiative details';
        setError(errorMessage);
        console.error('[useInitiativeDetailReport] API Error:', result);
      }
    } catch (err) {
      console.error('[useInitiativeDetailReport] Network Error:', err);
      setError('Network error: Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

export function useMinorReleaseReport(releaseId: string | null) {
  const [data, setData] = useState<MinorReleaseReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!releaseId) return;

    setIsLoading(true);
    setError(null);

    try {
      const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (!publishableKey) {
        setError('Configuration error: Missing publishable key');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/menu-minor-release-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publishableKey}`,
          },
          body: JSON.stringify({ release_id: releaseId }),
        }
      );

      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load release report');
      }
    } catch (err) {
      console.error('[useMinorReleaseReport] Error:', err);
      setError('Failed to load release report');
    } finally {
      setIsLoading(false);
    }
  }, [releaseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

interface UseExecutiveSummaryOptions {
  reportWindow: ReportWindow;
  enabled?: boolean; // Add manual control
}

export function useExecutiveSummary(options: UseExecutiveSummaryOptions) {
  const [data, setData] = useState<ExecutiveSummaryReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const fetchData = useCallback(async () => {
    // Prevent multiple simultaneous calls using ref
    if (isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Get current user session for proper authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        setError('Authentication required: Please log in');
        setIsLoading(false);
        isLoadingRef.current = false;
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/menu-executive-release-summary`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ report_window: options.reportWindow }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success && result.data) {
        setData(result.data);
      } else {
        const errorMessage = result.error?.message || result.error || 'Failed to load executive summary';
        setError(errorMessage);
        console.error('[useExecutiveSummary] API Error:', result);
      }
    } catch (err) {
      console.error('[useExecutiveSummary] Network Error:', err);
      setError('Network error: Failed to connect to server');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [options.reportWindow]);

  // Only auto-fetch if enabled is true (default to false for manual execution)
  useEffect(() => {
    if (options.enabled) {
      fetchData();
    }
  }, [fetchData, options.enabled]);

  return { data, isLoading, error, refetch: fetchData };
}

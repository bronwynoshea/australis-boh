import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../../lib/supabase';

// ============================================================================
// NEW VIEW-BASED REPORTING TYPES
// ============================================================================

export type ForgeOperationalStatus = 'active' | 'complete' | 'planned' | 'empty';
export type ForgeReportingType = 'execution' | 'summary' | 'planned';

// Executive Summary View: forge_executive_summary_view
export interface ForgeExecutiveSummaryRow {
  environment: 'internal' | 'external' | string;
  release_tier: 'major' | 'minor' | string;
  total_releases: number;
  active_releases: number;
  completed_releases: number;
  planned_releases: number;
  empty_releases: number;
  total_tickets: number;
  closed_tickets: number;
  open_tickets: number;
  high_priority_tickets: number;
  linked_initiatives: number;
  linked_workstreams: number;
}

// Release Schedule View: forge_release_schedule_view
export interface ForgeReleaseScheduleRow {
  release_id: string;
  version_label: string;
  version_number: string | null;
  release_tier: 'major' | 'minor' | string;
  environment: 'internal' | 'external' | string;
  release_date: string;
  release_status: string;
  parent_major_release_id: string | null;
  parent_major_version_label: string | null;
  total_tickets: number;
  closed_tickets: number;
  open_tickets: number;
  high_priority_tickets: number;
  linked_initiatives: number;
  linked_workstreams: number;
  reporting_type: string;
  operational_status: ForgeOperationalStatus;
  display_group_sort: number;
}

// 6-Month Roadmap View: forge_roadmap_6_month_view
export interface ForgeRoadmapRow {
  initiative_id: string;
  initiative_title: string;
  target_year: number;
  target_quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | string;
  workstream_id: string;
  workstream_title: string;
  workstream_status_key: string;
  workstream_status: string;
  reporting_type: ForgeReportingType;
}

// ============================================================================
// LEGACY TYPES (kept for backward compatibility)
// ============================================================================

export type ReleaseReportingType = 'active' | 'historical' | 'empty';
export type OperationalStatus = ForgeOperationalStatus;

// Types for Forge Overview Report
export interface ForgeOverviewData {
  submitted_initiative_count: number;
  active_workstream_count: number;
  completed_workstream_count: number;
  total_minor_release_count: number;
  completion_rate: number;

  next_release: {
    id: string;
    version_label: string;
    version_number: string;
    release_date: string;
    status: string;
    ticket_count: number;
  } | null;

  current_release_work: {
    total_tickets: number;
    completed_tickets: number;
    pending_tickets: number;
  };

  workstream_pipeline: Array<{
    key: string;
    label: string;
    color_token: string;
    count: number;
  }>;

  generated_at: string;
  filters: {
    quarter?: string;
    year?: number;
    app_id?: string;
  };
}

// Release item in the report (mapped from view)
export interface ForgeReleaseReportItem {
  id: string;
  version_label: string;
  version_number: string;
  release_tier: 'major' | 'minor' | 'patch';
  release_date: string | null;
  release_year: number;
  quarter: string;
  status: string;
  operational_status: OperationalStatus;
  summary: string;
  environment: 'internal' | 'external';
  parent_major_release_id: string | null;
  parent_major_version: string | null;
  ticket_count: number;
  open_ticket_count: number;
  closed_ticket_count: number;
  high_priority_open_count: number;
  initiative_count: number;
  workstream_count: number;
  reporting_type: ReleaseReportingType;
}

export interface ForgeReleaseReportData {
  summary: {
    total_releases: number;
    total_tickets: number;
    releases_with_tickets: number;
    high_priority_open_tickets: number;
  };
  releases: ForgeReleaseReportItem[];
  generated_at: string;
  filters: {
    quarter?: string;
    year?: number;
    app_id?: string;
    environment?: 'internal' | 'external';
    release_tier?: 'major' | 'minor' | 'patch';
    status?: string;
  };
}

interface UseForgeOverviewOptions {
  quarter?: string;
  year?: number;
  app_id?: string;
  enabled?: boolean;
}

interface UseForgeReleaseReportOptions {
  report_window?: string;
  quarter?: string;
  year?: number;
  app_id?: string;
  release_id?: string;
  environment?: 'internal' | 'external';
  release_tier?: 'major' | 'minor' | 'patch';
  status?: string;
  enabled?: boolean;
}

// Raw row from forge_executive_report_snapshot view
export interface ForgeExecutiveReportSnapshotRow {
  environment: 'internal' | 'external';
  release_tier: 'major' | 'minor' | 'patch';
  total_releases: number;
  active_releases: number;
  historical_releases: number;
  empty_releases: number;
  total_tickets: number;
  closed_tickets: number;
  open_tickets: number;
  high_priority_tickets: number;
  linked_initiatives: number;
  linked_workstreams: number;
}

// Executive report data shape (aggregated from view)
export interface ForgeExecutiveReportData {
  summary: {
    total_releases: number;
    released_count: number; // historical releases
    active_count: number; // active releases
    empty_count: number; // empty releases
    total_tickets: number;
    open_tickets: number;
    high_priority_tickets: number;
    linked_initiatives: number;
    linked_workstreams: number;
  };
  byEnvironment: {
    internal: Omit<ForgeExecutiveReportSnapshotRow, 'environment'> | null;
    external: Omit<ForgeExecutiveReportSnapshotRow, 'environment'> | null;
  };
  byTier: {
    major: Omit<ForgeExecutiveReportSnapshotRow, 'release_tier'> | null;
    minor: Omit<ForgeExecutiveReportSnapshotRow, 'release_tier'> | null;
    patch: Omit<ForgeExecutiveReportSnapshotRow, 'release_tier'> | null;
  };
  generated_at: string;
  filters: {
    environment?: 'internal' | 'external';
    release_tier?: 'major' | 'minor' | 'patch';
  };
}

interface UseForgeExecutiveReportOptions {
  environment?: 'internal' | 'external';
  release_tier?: 'major' | 'minor' | 'patch';
  enabled?: boolean;
}

// Forge Overview Report Hook
export function useForgeOverviewReport(options: UseForgeOverviewOptions) {
  const [data, setData] = useState<ForgeOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forge-overview-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            quarter: options.quarter,
            year: options.year,
            app_id: options.app_id,
          }),
        }
      );

      const result = await response.json();

      if (response.ok && result.success && result.data) {
        setData(result.data);
      } else {
        const errorMessage = result.error?.message || result.error || 'Failed to load Forge overview';
        setError(errorMessage);
        console.error('[useForgeOverviewReport] API Error:', result);
      }
    } catch (err) {
      console.error('[useForgeOverviewReport] Network Error:', err);
      setError('Network error: Failed to connect to server');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [options.quarter, options.year, options.app_id]);

  useEffect(() => {
    if (options.enabled) {
      fetchData();
    }
  }, [fetchData, options.enabled]);

  return { data, isLoading, error, refetch: fetchData };
}

// Forge Executive Report Hook - uses forge_executive_report_snapshot view
export function useForgeExecutiveReport(options: UseForgeExecutiveReportOptions) {
  const [data, setData] = useState<ForgeExecutiveReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Build query from forge_executive_report_snapshot view
      let query = supabase
        .from('forge_executive_report_snapshot')
        .select('*');

      // Apply filters
      if (options.environment) {
        query = query.eq('environment', options.environment);
      }
      if (options.release_tier) {
        query = query.eq('release_tier', options.release_tier);
      }

      const { data: snapshotData, error: queryError } = await query;

      if (queryError) {
        console.error('[useForgeExecutiveReport] Query error:', queryError);
        setError(queryError.message);
        return;
      }

      // Map view rows to executive report format
      const rows: ForgeExecutiveReportSnapshotRow[] = snapshotData || [];

      // Aggregate totals from all rows
      const summary = {
        total_releases: rows.reduce((sum, r) => sum + r.total_releases, 0),
        released_count: rows.reduce((sum, r) => sum + r.historical_releases, 0),
        active_count: rows.reduce((sum, r) => sum + r.active_releases, 0),
        empty_count: rows.reduce((sum, r) => sum + r.empty_releases, 0),
        total_tickets: rows.reduce((sum, r) => sum + r.total_tickets, 0),
        open_tickets: rows.reduce((sum, r) => sum + r.open_tickets, 0),
        high_priority_tickets: rows.reduce((sum, r) => sum + r.high_priority_tickets, 0),
        linked_initiatives: rows.reduce((sum, r) => sum + r.linked_initiatives, 0),
        linked_workstreams: rows.reduce((sum, r) => sum + r.linked_workstreams, 0),
      };

      // Build breakdown by environment
      const internalRow = rows.find((r) => r.environment === 'internal');
      const externalRow = rows.find((r) => r.environment === 'external');

      // Build breakdown by tier
      const majorRow = rows.find((r) => r.release_tier === 'major');
      const minorRow = rows.find((r) => r.release_tier === 'minor');
      const patchRow = rows.find((r) => r.release_tier === 'patch');

      const reportData: ForgeExecutiveReportData = {
        summary,
        byEnvironment: {
          internal: internalRow
            ? {
                release_tier: internalRow.release_tier,
                total_releases: internalRow.total_releases,
                active_releases: internalRow.active_releases,
                historical_releases: internalRow.historical_releases,
                empty_releases: internalRow.empty_releases,
                total_tickets: internalRow.total_tickets,
                closed_tickets: internalRow.closed_tickets,
                open_tickets: internalRow.open_tickets,
                high_priority_tickets: internalRow.high_priority_tickets,
                linked_initiatives: internalRow.linked_initiatives,
                linked_workstreams: internalRow.linked_workstreams,
              }
            : null,
          external: externalRow
            ? {
                release_tier: externalRow.release_tier,
                total_releases: externalRow.total_releases,
                active_releases: externalRow.active_releases,
                historical_releases: externalRow.historical_releases,
                empty_releases: externalRow.empty_releases,
                total_tickets: externalRow.total_tickets,
                closed_tickets: externalRow.closed_tickets,
                open_tickets: externalRow.open_tickets,
                high_priority_tickets: externalRow.high_priority_tickets,
                linked_initiatives: externalRow.linked_initiatives,
                linked_workstreams: externalRow.linked_workstreams,
              }
            : null,
        },
        byTier: {
          major: majorRow
            ? {
                environment: majorRow.environment,
                total_releases: majorRow.total_releases,
                active_releases: majorRow.active_releases,
                historical_releases: majorRow.historical_releases,
                empty_releases: majorRow.empty_releases,
                total_tickets: majorRow.total_tickets,
                closed_tickets: majorRow.closed_tickets,
                open_tickets: majorRow.open_tickets,
                high_priority_tickets: majorRow.high_priority_tickets,
                linked_initiatives: majorRow.linked_initiatives,
                linked_workstreams: majorRow.linked_workstreams,
              }
            : null,
          minor: minorRow
            ? {
                environment: minorRow.environment,
                total_releases: minorRow.total_releases,
                active_releases: minorRow.active_releases,
                historical_releases: minorRow.historical_releases,
                empty_releases: minorRow.empty_releases,
                total_tickets: minorRow.total_tickets,
                closed_tickets: minorRow.closed_tickets,
                open_tickets: minorRow.open_tickets,
                high_priority_tickets: minorRow.high_priority_tickets,
                linked_initiatives: minorRow.linked_initiatives,
                linked_workstreams: minorRow.linked_workstreams,
              }
            : null,
          patch: patchRow
            ? {
                environment: patchRow.environment,
                total_releases: patchRow.total_releases,
                active_releases: patchRow.active_releases,
                historical_releases: patchRow.historical_releases,
                empty_releases: patchRow.empty_releases,
                total_tickets: patchRow.total_tickets,
                closed_tickets: patchRow.closed_tickets,
                open_tickets: patchRow.open_tickets,
                high_priority_tickets: patchRow.high_priority_tickets,
                linked_initiatives: patchRow.linked_initiatives,
                linked_workstreams: patchRow.linked_workstreams,
              }
            : null,
        },
        generated_at: new Date().toISOString(),
        filters: {
          environment: options.environment,
          release_tier: options.release_tier,
        },
      };

      setData(reportData);
    } catch (err) {
      console.error('[useForgeExecutiveReport] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load executive report');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [options.environment, options.release_tier]);

  useEffect(() => {
    if (options.enabled) {
      fetchData();
    }
  }, [fetchData, options.enabled]);

  return { data, isLoading, error, refetch: fetchData };
}

// Forge Release Report Hook - uses forge_release_report_snapshot view
export function useForgeReleaseReport(options: UseForgeReleaseReportOptions) {
  const [data, setData] = useState<ForgeReleaseReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Build query from forge_release_report_snapshot view
      let query = supabase
        .from('forge_release_report_snapshot')
        .select('*');

      // Apply filters
      if (options.year) {
        // Filter by year extracted from release_date
        const startOfYear = `${options.year}-01-01`;
        const endOfYear = `${options.year}-12-31`;
        query = query.gte('release_date', startOfYear).lte('release_date', endOfYear);
      }
      if (options.environment) {
        query = query.eq('environment', options.environment);
      }
      if (options.release_tier) {
        query = query.eq('release_tier', options.release_tier);
      }
      if (options.status) {
        query = query.eq('release_status', options.status);
      }
      if (options.release_id) {
        query = query.eq('release_id', options.release_id);
      }

      const { data: snapshotData, error: queryError } = await query;

      if (queryError) {
        console.error('[useForgeReleaseReport] Query error:', queryError);
        setError(queryError.message);
        return;
      }

      // Map view rows to report format
      let rows: ForgeReleaseScheduleRow[] = snapshotData || [];

      if (options.quarter && options.quarter !== 'All') {
        const quarterMonths: Record<string, [number, number]> = {
          Q1: [1, 3],
          Q2: [4, 6],
          Q3: [7, 9],
          Q4: [10, 12],
        };
        const [startMonth, endMonth] = quarterMonths[options.quarter] ?? [1, 12];
        rows = rows.filter((row) => {
          if (!row.release_date) return false;
          const month = new Date(row.release_date).getUTCMonth() + 1;
          return month >= startMonth && month <= endMonth;
        });
      }

      // Map to the expected shape
      const releases: ForgeReleaseReportItem[] = rows.map((row) => ({
        id: row.release_id,
        version_label: row.version_label,
        version_number: row.version_number || '',
        release_tier: row.release_tier as 'major' | 'minor' | 'patch',
        release_date: row.release_date,
        release_year: row.release_date ? new Date(row.release_date).getFullYear() : new Date().getFullYear(),
        quarter: row.release_date
          ? `Q${Math.floor(new Date(row.release_date).getMonth() / 3) + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4'
          : 'Q1',
        status: row.release_status,
        operational_status: row.operational_status,
        summary: '', // View doesn't provide this, keep empty for compatibility
        environment: row.environment as 'internal' | 'external',
        parent_major_release_id: row.parent_major_release_id,
        parent_major_version: row.parent_major_version_label,
        ticket_count: row.total_tickets,
        open_ticket_count: row.open_tickets,
        closed_ticket_count: row.closed_tickets,
        high_priority_open_count: row.high_priority_tickets,
        initiative_count: row.linked_initiatives,
        workstream_count: row.linked_workstreams,
        reporting_type: row.reporting_type as ReleaseReportingType,
      }));

      // Compute summary from view data (backend-driven, no client-side aggregation)
      const summary = {
        total_releases: releases.length,
        total_tickets: rows.reduce((sum, r) => sum + r.total_tickets, 0),
        releases_with_tickets: rows.filter((r) => r.total_tickets > 0).length,
        high_priority_open_tickets: rows.reduce((sum, r) => sum + r.high_priority_tickets, 0),
      };

      const reportData: ForgeReleaseReportData = {
        summary,
        releases,
        generated_at: new Date().toISOString(),
        filters: {
          quarter: options.quarter,
          year: options.year,
          app_id: options.app_id,
          environment: options.environment,
          release_tier: options.release_tier,
          status: options.status,
        },
      };

      setData(reportData);
    } catch (err) {
      console.error('[useForgeReleaseReport] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load release report');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [
    options.quarter,
    options.year,
    options.app_id,
    options.release_id,
    options.environment,
    options.release_tier,
    options.status,
  ]);

  useEffect(() => {
    if (options.enabled) {
      fetchData();
    }
  }, [fetchData, options.enabled]);

  return { data, isLoading, error, refetch: fetchData };
}

// Workstream Reporting Types
export type WorkstreamReportingType = 'execution' | 'summary' | 'planned';

// Raw row from forge_menu_reporting_snapshot view
export interface ForgeMenuReportingSnapshotRow {
  initiative_id: string;
  initiative_title: string;
  target_year: number;
  target_quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  workstream_id: string | null;
  workstream_title: string | null;
  workstream_status_key: string | null;
  workstream_status: string | null;
  story_count: number;
  task_count: number;
  completed_task_count: number;
  task_completion_percent: number;
  reporting_type: WorkstreamReportingType;
}

// Workstream item in the report
export interface ForgeWorkstreamReportItem {
  initiative_id: string;
  initiative_title: string;
  target_year: number;
  target_quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  workstream_id: string | null;
  workstream_title: string | null;
  workstream_status_key: string | null;
  workstream_status: string | null;
  story_count: number;
  task_count: number;
  completed_task_count: number;
  task_completion_percent: number;
  reporting_type: WorkstreamReportingType;
}

// Workstream report grouped by quarter
export interface ForgeWorkstreamQuarterGroup {
  year: number;
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  reporting_type: WorkstreamReportingType;
  initiatives: ForgeWorkstreamReportItem[];
  summary: {
    total_initiatives: number;
    total_workstreams: number;
    total_stories: number;
    total_tasks: number;
    completed_tasks: number;
    avg_completion_percent: number;
  };
}

export interface ForgeWorkstreamReportData {
  quarters: ForgeWorkstreamQuarterGroup[];
  summary: {
    total_quarters: number;
    total_initiatives: number;
    total_workstreams: number;
    total_stories: number;
    total_tasks: number;
    completed_tasks: number;
    execution_quarters: number;
    summary_quarters: number;
    planned_quarters: number;
  };
  generated_at: string;
  filters: {
    year?: number;
    quarter?: string;
  };
}

interface UseForgeWorkstreamReportOptions {
  year?: number;
  quarter?: string;
  enabled?: boolean;
}

// Forge Workstream Report Hook - uses forge_menu_reporting_snapshot view
export function useForgeWorkstreamReport(options: UseForgeWorkstreamReportOptions) {
  const [data, setData] = useState<ForgeWorkstreamReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLoadingRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Build query from forge_menu_reporting_snapshot view
      let query = supabase
        .from('forge_menu_reporting_snapshot')
        .select('*');

      // Apply filters
      if (options.year) {
        query = query.eq('target_year', options.year);
      }
      if (options.quarter) {
        query = query.eq('target_quarter', options.quarter);
      }

      const { data: snapshotData, error: queryError } = await query;

      if (queryError) {
        console.error('[useForgeWorkstreamReport] Query error:', queryError);
        setError(queryError.message);
        return;
      }

      // Map view rows to report format
      const rows: ForgeMenuReportingSnapshotRow[] = snapshotData || [];

      // Map to the expected shape
      const items: ForgeWorkstreamReportItem[] = rows.map((row) => ({
        initiative_id: row.initiative_id,
        initiative_title: row.initiative_title,
        target_year: row.target_year,
        target_quarter: row.target_quarter,
        workstream_id: row.workstream_id,
        workstream_title: row.workstream_title,
        workstream_status_key: row.workstream_status_key,
        workstream_status: row.workstream_status,
        story_count: row.story_count,
        task_count: row.task_count,
        completed_task_count: row.completed_task_count,
        task_completion_percent: row.task_completion_percent,
        reporting_type: row.reporting_type,
      }));

      // Group by quarter and reporting_type
      const quarterGroups = new Map<string, ForgeWorkstreamQuarterGroup>();

      items.forEach((item) => {
        const key = `${item.target_year}-${item.target_quarter}`;
        if (!quarterGroups.has(key)) {
          quarterGroups.set(key, {
            year: item.target_year,
            quarter: item.target_quarter,
            reporting_type: item.reporting_type,
            initiatives: [],
            summary: {
              total_initiatives: 0,
              total_workstreams: 0,
              total_stories: 0,
              total_tasks: 0,
              completed_tasks: 0,
              avg_completion_percent: 0,
            },
          });
        }
        const group = quarterGroups.get(key)!;
        group.initiatives.push(item);
      });

      // Calculate summaries for each quarter
      quarterGroups.forEach((group) => {
        const initiatives = group.initiatives;
        const workstreams = initiatives.filter((i) => i.workstream_id !== null);
        const totalStories = initiatives.reduce((sum, i) => sum + i.story_count, 0);
        const totalTasks = initiatives.reduce((sum, i) => sum + i.task_count, 0);
        const completedTasks = initiatives.reduce((sum, i) => sum + i.completed_task_count, 0);
        const avgCompletion = initiatives.length > 0
          ? initiatives.reduce((sum, i) => sum + i.task_completion_percent, 0) / initiatives.length
          : 0;

        group.summary = {
          total_initiatives: new Set(initiatives.map((i) => i.initiative_id)).size,
          total_workstreams: workstreams.length,
          total_stories: totalStories,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          avg_completion_percent: Math.round(avgCompletion),
        };
      });

      // Convert to array and sort by year/quarter
      const quarters = Array.from(quarterGroups.values()).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year; // Descending year
        const quarterOrder = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
        return quarterOrder[b.quarter] - quarterOrder[a.quarter]; // Descending quarter
      });

      // Global summary
      const allInitiatives = items;
      const executionCount = quarters.filter((q) => q.reporting_type === 'execution').length;
      const summaryCount = quarters.filter((q) => q.reporting_type === 'summary').length;
      const plannedCount = quarters.filter((q) => q.reporting_type === 'planned').length;

      const reportData: ForgeWorkstreamReportData = {
        quarters,
        summary: {
          total_quarters: quarters.length,
          total_initiatives: new Set(allInitiatives.map((i) => i.initiative_id)).size,
          total_workstreams: allInitiatives.filter((i) => i.workstream_id !== null).length,
          total_stories: allInitiatives.reduce((sum, i) => sum + i.story_count, 0),
          total_tasks: allInitiatives.reduce((sum, i) => sum + i.task_count, 0),
          completed_tasks: allInitiatives.reduce((sum, i) => sum + i.completed_task_count, 0),
          execution_quarters: executionCount,
          summary_quarters: summaryCount,
          planned_quarters: plannedCount,
        },
        generated_at: new Date().toISOString(),
        filters: {
          year: options.year,
          quarter: options.quarter,
        },
      };

      setData(reportData);
    } catch (err) {
      console.error('[useForgeWorkstreamReport] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workstream report');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [options.year, options.quarter]);

  useEffect(() => {
    if (options.enabled) {
      fetchData();
    }
  }, [fetchData, options.enabled]);

  return { data, isLoading, error, refetch: fetchData };
}

// ============================================================================
// NEW VIEW-BASED FETCH FUNCTIONS
// ============================================================================

export async function fetchForgeExecutiveSummary(
  supabaseClient: typeof supabase,
  filters: { environment?: string; release_tier?: string }
): Promise<ForgeExecutiveSummaryRow[]> {
  let query = supabaseClient
    .from('forge_executive_summary_view')
    .select('*');

  if (filters.environment && filters.environment !== 'All') {
    query = query.eq('environment', filters.environment);
  }

  if (filters.release_tier && filters.release_tier !== 'All') {
    query = query.eq('release_tier', filters.release_tier);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ForgeExecutiveSummaryRow[];
}

export async function fetchForgeReleaseSchedule(
  supabaseClient: typeof supabase,
  filters: {
    environment?: string;
    release_tier?: string;
    year?: number | string;
    quarter?: string;
  }
): Promise<ForgeReleaseScheduleRow[]> {
  let query = supabaseClient
    .from('forge_release_schedule_view')
    .select('*')
    .order('display_group_sort', { ascending: true })
    .order('release_date', { ascending: true });

  if (filters.environment && filters.environment !== 'All') {
    query = query.eq('environment', filters.environment);
  }

  if (filters.release_tier && filters.release_tier !== 'All') {
    query = query.eq('release_tier', filters.release_tier);
  }

  if (filters.year && filters.year !== 'All') {
    const start = `${filters.year}-01-01`;
    const end = `${filters.year}-12-31`;
    query = query.gte('release_date', start).lte('release_date', end);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as ForgeReleaseScheduleRow[];

  if (filters.quarter && filters.quarter !== 'All') {
    const quarterMonths: Record<string, [number, number]> = {
      Q1: [1, 3],
      Q2: [4, 6],
      Q3: [7, 9],
      Q4: [10, 12],
    };
    const [startMonth, endMonth] = quarterMonths[filters.quarter] ?? [1, 12];
    return rows.filter((row) => {
      const month = new Date(row.release_date).getUTCMonth() + 1;
      return month >= startMonth && month <= endMonth;
    });
  }

  return rows;
}

export async function fetchForgeRoadmap6Month(
  supabaseClient: typeof supabase,
  filters: { year?: number | string; quarter?: string }
): Promise<ForgeRoadmapRow[]> {
  const { data, error } = await supabaseClient
    .from('forge_roadmap_6_month_view')
    .select('*')
    .order('target_year', { ascending: true })
    .order('target_quarter', { ascending: true })
    .order('initiative_title', { ascending: true });

  if (error) throw error;

  let rows = (data ?? []) as ForgeRoadmapRow[];

  if (filters.year && filters.year !== 'All') {
    rows = rows.filter((r) => r.target_year === Number(filters.year));
  }

  if (filters.quarter && filters.quarter !== 'All') {
    rows = rows.filter((r) => r.target_quarter === filters.quarter);
  }

  return rows;
}

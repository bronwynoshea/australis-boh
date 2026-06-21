import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabase';
import Toast from '../../../../components/Toast';
import ReportFiltersBar from '../../shared/components/ReportFiltersBar';
import ReportExportActions from '../../shared/components/ReportExportActions';
import FilterDropdown from '../../shared/components/FilterDropdown';
import {
  fetchForgeExecutiveSummary,
  fetchForgeReleaseSchedule,
  fetchForgeRoadmap6Month,
  type ForgeExecutiveSummaryRow,
  type ForgeReleaseScheduleRow,
  type ForgeRoadmapRow,
  type ForgeOperationalStatus,
  type ForgeReportingType,
} from '../../shared/hooks/useForgeReports';
import type {
  ReportFilters,
} from '../../shared/types/reporting';

// Forge-first report types
// - release: release + ticket table view
// - executive: delivery-oriented metrics (not Menu planning metrics)
// - workstream: workstream health view

type ReportType = 'release' | 'executive' | 'workstream';

interface ReleaseTableRow {
  id: string;
  version_label: string;
  version_number: string;
  release_tier: 'major' | 'minor';
  environment: 'internal' | 'external';
  status: string;
  operational_status: ForgeOperationalStatus;
  release_date: string | null;
  parent_major_release_id?: string;
  parent_major_version?: string;
  ticket_count: number;
  open_ticket_count: number;
  closed_ticket_count: number;
  high_priority_open_count: number;
  workstream_count: number;
  reporting_type: string;
}

const getReleaseStatus = (release: ForgeReleaseScheduleRow) => release.release_status || 'unknown';
const getReleaseTicketCount = (release: ForgeReleaseScheduleRow) => release.total_tickets ?? 0;
const getReleaseOpenTicketCount = (release: ForgeReleaseScheduleRow) => release.open_tickets ?? 0;
const getReleaseHighPriorityCount = (release: ForgeReleaseScheduleRow) => release.high_priority_tickets ?? 0;

const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [availableApps, setAvailableApps] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const [reportType, setReportType] = useState<ReportType>('release');
  const [hasRunReport, setHasRunReport] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({
    report_window: '90days',
    app_id: undefined,
    quarter: undefined,
    year: undefined,
    environment: undefined,
    release_tier: undefined,
    status: undefined,
  });

  const [availableQuarters] = useState<string[]>(['Q1', 'Q2', 'Q3', 'Q4']);
  const [availableYears] = useState<number[]>([2025, 2026, 2027]);

  // Load available apps
  useEffect(() => {
    const loadApps = async () => {
      const { data, error } = await supabase
        .from('boh_app')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (!error && data) {
        setAvailableApps(data);
      }
    };
    loadApps();
  }, []);

  // New view-based data states
  const [executiveData, setExecutiveData] = useState<ForgeExecutiveSummaryRow[]>([]);
  const [releaseScheduleData, setReleaseScheduleData] = useState<ForgeReleaseScheduleRow[]>([]);
  const [roadmapData, setRoadmapData] = useState<ForgeRoadmapRow[]>([]);
  const [isLoadingExecutive, setIsLoadingExecutive] = useState(false);
  const [isLoadingRelease, setIsLoadingRelease] = useState(false);
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState(false);
  const [executiveError, setExecutiveError] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);

  // Reset hasRunReport when report type changes
  const handleReportTypeChange = useCallback((newType: ReportType) => {
    setReportType(newType);
    setHasRunReport(false); // Reset so button shows "Run Report"
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setIsToastVisible(true);
  };

  // Execute report based on type
  const handleRunReport = useCallback(async () => {
    setHasRunReport(true);

    if (reportType === 'executive') {
      setIsLoadingExecutive(true);
      setExecutiveError(null);
      try {
        const data = await fetchForgeExecutiveSummary(supabase, {
          environment: filters.environment,
          release_tier: filters.release_tier,
        });
        setExecutiveData(data);
      } catch (err) {
        setExecutiveError(err instanceof Error ? err.message : 'Failed to load executive summary');
      } finally {
        setIsLoadingExecutive(false);
      }
    } else if (reportType === 'workstream') {
      setIsLoadingRoadmap(true);
      setRoadmapError(null);
      try {
        const data = await fetchForgeRoadmap6Month(supabase, {
          year: filters.year,
          quarter: filters.quarter,
        });
        setRoadmapData(data);
      } catch (err) {
        setRoadmapError(err instanceof Error ? err.message : 'Failed to load roadmap');
      } finally {
        setIsLoadingRoadmap(false);
      }
    } else {
      setIsLoadingRelease(true);
      setReleaseError(null);
      try {
        const data = await fetchForgeReleaseSchedule(supabase, {
          environment: filters.environment,
          release_tier: filters.release_tier,
          year: filters.year,
          quarter: filters.quarter,
        });
        setReleaseScheduleData(data);
      } catch (err) {
        setReleaseError(err instanceof Error ? err.message : 'Failed to load release schedule');
      } finally {
        setIsLoadingRelease(false);
      }
    }
  }, [reportType, filters.environment, filters.release_tier, filters.year, filters.quarter]);

  // Handle release click - navigate to release detail
  const handleReleaseClick = useCallback((releaseId: string, tier: string) => {
    if (tier === 'major') {
      navigate(`/forge/releases/major/${releaseId}`);
    } else {
      navigate(`/forge/releases/minor/${releaseId}`);
    }
  }, [navigate]);

  useEffect(() => {
    if (releaseError || executiveError || roadmapError) {
      showToast(releaseError || executiveError || roadmapError || 'An error occurred');
    }
  }, [releaseError, executiveError, roadmapError]);

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Generate export text for release report
  const reportSummaryText = useMemo(() => {
    if (releaseScheduleData.length === 0) return '';

    const totalReleases = releaseScheduleData.length;
    const totalTickets = releaseScheduleData.reduce((sum, r) => sum + r.total_tickets, 0);
    const highPriorityOpen = releaseScheduleData.reduce((sum, r) => sum + r.high_priority_tickets, 0);

    const lines: string[] = [
      `Forge Release Schedule Report - ${filters.quarter || 'All'} ${filters.year || ''}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      `Summary:`,
      `- Total Releases: ${totalReleases}`,
      `- Total Tickets: ${totalTickets}`,
      `- High Priority Open: ${highPriorityOpen}`,
      '',
      `Releases:`,
    ];

    releaseScheduleData.forEach((release) => {
      lines.push(
        `- ${release.version_label} (${release.release_tier}): ${release.total_tickets} tickets, ${release.open_tickets} open, ${release.high_priority_tickets} high priority`
      );
    });

    return lines.join('\n');
  }, [releaseScheduleData, filters.quarter, filters.year]);

  // Render Release Table - uses release schedule view
  const renderReleaseTable = () => {
    if (releaseScheduleData.length === 0) return null;

    // Filter releases by environment and tier if specified
    let filteredReleases = releaseScheduleData.filter((r) => {
      if (filters.environment && r.environment !== filters.environment) return false;
      if (filters.release_tier && r.release_tier !== filters.release_tier) return false;
      return true;
    });

    // Sort by status priority, then by release date
    const statusPriority: Record<string, number> = {
      'in progress': 1,
      'planned': 2,
      'released': 3,
      'deprecated': 4,
    };
    
    filteredReleases = filteredReleases.sort((a, b) => {
      const aPriority = statusPriority[getReleaseStatus(a)] || 5;
      const bPriority = statusPriority[getReleaseStatus(b)] || 5;
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      // Then sort by date (null dates at end)
      if (!a.release_date && !b.release_date) return 0;
      if (!a.release_date) return 1;
      if (!b.release_date) return -1;
      return new Date(a.release_date).getTime() - new Date(b.release_date).getTime();
    });

    // Count by tier and calculate totals
    const totalReleases = filteredReleases.length;
    const majorCount = filteredReleases.filter((r) => r.release_tier === 'major').length;
    const minorCount = filteredReleases.filter((r) => r.release_tier === 'minor').length;
    const totalTickets = filteredReleases.reduce((sum, r) => sum + r.total_tickets, 0);
    const highPriorityOpen = filteredReleases.reduce((sum, r) => sum + r.high_priority_tickets, 0);

    return (
      <div className="space-y-6">
        {/* Top Summary Metrics - Release First */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
            <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">{totalReleases}</div>
            <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Total Releases</div>
          </div>
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
            <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">{majorCount}</div>
            <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Major Releases</div>
          </div>
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
            <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">{minorCount}</div>
            <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Minor Releases</div>
          </div>
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
            <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">{totalTickets}</div>
            <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Assigned Tickets</div>
          </div>
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
            <div className="text-2xl font-bold text-boh-primary">{highPriorityOpen}</div>
            <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">High Priority Open</div>
          </div>
        </div>

        {/* Releases Table - Dense Structured List */}
        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border overflow-hidden">
          <div className="px-4 py-3 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
            <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Release Delivery Status</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-boh-surface-light dark:bg-boh-surface border-b border-boh-border-light dark:border-boh-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Release</th>
                  <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Tier</th>
                  <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Environment</th>
                  <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Release Date</th>
                  <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Parent Major</th>
                  <th className="px-4 py-3 text-center font-medium text-boh-text-sub-light dark:text-boh-text-sub">Tickets</th>
                  <th className="px-4 py-3 text-center font-medium text-boh-text-sub-light dark:text-boh-text-sub">Open</th>
                  <th className="px-4 py-3 text-center font-medium text-boh-text-sub-light dark:text-boh-text-sub">High Priority</th>
                  <th className="px-4 py-3 text-center font-medium text-boh-text-sub-light dark:text-boh-text-sub">Workstreams</th>
                  <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Delivery State</th>
                  <th className="px-4 py-3 text-left font-medium text-boh-text-sub-light dark:text-boh-text-sub">Release Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-boh-border-light dark:divide-boh-border">
                {filteredReleases.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-boh-text-sub-light dark:text-boh-text-sub">
                      No releases found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredReleases.map((release) => (
                    <tr
                      key={release.id}
                      className="hover:bg-boh-surface-light dark:hover:bg-boh-surface/50 cursor-pointer transition-colors"
                      onClick={() => handleReleaseClick(release.id, release.release_tier)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-boh-text-light dark:text-boh-text">{release.version_label}</div>
                        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{release.version_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                          release.release_tier === 'major' 
                            ? 'bg-boh-primary-tint text-boh-primary dark:bg-boh-primary/20 dark:text-boh-primary' 
                            : 'bg-boh-primary-tint text-boh-primary dark:bg-boh-primary/20 dark:text-boh-primary'
                        }`}>
                          {release.release_tier}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-boh-text-light dark:text-boh-text">{release.environment}</span>
                      </td>
                      <td className="px-4 py-3 text-boh-text-light dark:text-boh-text">
                        {formatDate(release.release_date)}
                      </td>
                      <td className="px-4 py-3 text-boh-text-light dark:text-boh-text">
                        {release.parent_major_version || (release.release_tier === 'major' ? '—' : 'Unassigned')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${getReleaseTicketCount(release) > 0 ? 'text-boh-text-light dark:text-boh-text' : 'text-boh-primary dark:text-boh-primary'}`}>
                          {getReleaseTicketCount(release)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${getReleaseOpenTicketCount(release) > 0 ? 'text-boh-primary dark:text-boh-primary' : 'text-boh-success dark:text-boh-success'}`}>
                          {getReleaseOpenTicketCount(release)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${getReleaseHighPriorityCount(release) > 0 ? 'text-boh-primary dark:text-boh-primary' : 'text-boh-success dark:text-boh-success'}`}>
                          {getReleaseHighPriorityCount(release)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-boh-text-light dark:text-boh-text">
                        {release.workstream_count}
                      </td>
                      {/* Delivery State - operational status, visually prominent */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${
                          release.operational_status === 'active'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : release.operational_status === 'complete'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : release.operational_status === 'planned'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}>
                          {release.operational_status === 'active' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mr-1.5"></span>
                          )}
                          {release.operational_status === 'complete' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 mr-1.5"></span>
                          )}
                          {release.operational_status === 'planned' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400 mr-1.5"></span>
                          )}
                          {release.operational_status === 'empty' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mr-1.5"></span>
                          )}
                          {release.operational_status}
                        </span>
                      </td>
                      {/* Release Record - raw status from release metadata */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 text-xs rounded-full ${
                          getReleaseStatus(release) === 'released'
                            ? 'bg-boh-surface-light dark:bg-boh-surface text-boh-success dark:text-boh-success'
                            : getReleaseStatus(release) === 'in progress'
                            ? 'bg-boh-primary-tint text-boh-primary dark:bg-boh-primary/20 dark:text-boh-primary'
                            : 'bg-boh-surface-light dark:bg-boh-surface text-boh-primary dark:text-boh-primary'
                        }`}>
                          {getReleaseStatus(release)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Render Executive Summary - uses executive summary view
  // Updated: removed orange warning emoji, using theme-safe colors only
  const renderExecutiveSummary = () => {
    if (executiveData.length === 0) return null;

    // Calculate metrics from executive data
    const totalReleases = executiveData.reduce((sum, row) => sum + row.total_releases, 0);
    const activeReleases = executiveData.reduce((sum, row) => sum + row.active_releases, 0);
    const completedReleases = executiveData.reduce((sum, row) => sum + row.completed_releases, 0);
    const emptyReleases = executiveData.reduce((sum, row) => sum + row.empty_releases, 0);
    const totalTickets = executiveData.reduce((sum, row) => sum + row.total_tickets, 0);
    const openTickets = executiveData.reduce((sum, row) => sum + row.open_tickets, 0);
    const highPriorityTickets = executiveData.reduce((sum, row) => sum + row.high_priority_tickets, 0);

    return (
      <div className="space-y-6">
        {/* Delivery-Oriented Executive Summary */}
        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-6">
          <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">
            Delivery Executive Summary
          </h2>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-6">
            This summary focuses on delivery execution metrics: releases, tickets, and workstreams.
            Data sourced from backend executive snapshot view.
          </p>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-boh-bg-light dark:bg-boh-bg/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-boh-text-light dark:text-boh-text">{totalReleases}</div>
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Total Releases</div>
            </div>
            <div className="bg-boh-bg-light dark:bg-boh-bg/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-boh-success dark:text-boh-success">{completedReleases}</div>
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Completed</div>
            </div>
            <div className="bg-boh-bg-light dark:bg-boh-bg/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-boh-text-light dark:text-boh-text">{totalTickets}</div>
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Total Tickets</div>
            </div>
            <div className="bg-boh-bg-light dark:bg-boh-bg/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-boh-primary">{highPriorityTickets}</div>
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">High Priority</div>
            </div>
          </div>

          {/* Release Type Breakdown */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-boh-bg-light dark:bg-boh-bg/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">{activeReleases}</div>
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Active Releases</div>
            </div>
            <div className="bg-boh-bg-light dark:bg-boh-bg/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">{emptyReleases}</div>
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Empty Releases</div>
            </div>
            <div className="bg-boh-bg-light dark:bg-boh-bg/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">{openTickets}</div>
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Open Tickets</div>
            </div>
          </div>

          {/* Attention Needed Section */}
          <div className="border-t border-boh-border-light dark:border-boh-border pt-6">
            <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-4 uppercase tracking-wide">
              Items Needing Attention
            </h3>
            <div className="grid gap-3">
              {emptyReleases > 0 && (
                <div className="flex items-center justify-between p-3 bg-boh-primary-tint dark:bg-boh-surface rounded-lg">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-boh-primary dark:text-boh-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="text-sm text-boh-text-light dark:text-boh-text">
                      Empty releases (no tickets, initiatives, or workstreams)
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-boh-primary dark:text-boh-primary">{emptyReleases}</span>
                </div>
              )}

              {highPriorityTickets > 0 && (
                <div className="flex items-center justify-between p-3 bg-boh-primary-tint dark:bg-boh-surface rounded-lg">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-boh-primary dark:text-boh-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="text-sm text-boh-text-light dark:text-boh-text">
                      High-priority tickets requiring attention
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-boh-primary dark:text-boh-primary">{highPriorityTickets}</span>
                </div>
              )}

              {emptyReleases === 0 && highPriorityTickets === 0 && (
                <div className="flex items-center gap-3 p-3 bg-boh-surface-light dark:bg-boh-surface rounded-lg">
                  <svg className="w-5 h-5 text-boh-success dark:text-boh-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="text-sm text-boh-text-light dark:text-boh-text">
                    No delivery issues detected. All releases have associated work and no high-priority items are blocking delivery.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Paragraph */}
        <div className="bg-boh-bg-light dark:bg-boh-bg/30 rounded-lg p-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
          <p>
            Report generated {new Date().toLocaleString()}.
            Covering {totalReleases} releases ({activeReleases} active, {completedReleases} completed, {emptyReleases} empty)
            with {totalTickets} total tickets ({openTickets} open).
            {highPriorityTickets > 0
              ? ` ${highPriorityTickets} high-priority tickets require attention.`
              : ' No high-priority blockers.'}
          </p>
        </div>
      </div>
    );
  };

  // Render 6-Month Roadmap - uses roadmap view
  const renderRoadmap = () => {
    if (roadmapData.length === 0) return null;

    // Group by quarter
    type QuarterGroup = { year: number; quarter: string; items: ForgeRoadmapRow[] };
    const quarterGroups: Record<string, QuarterGroup> = {};
    
    roadmapData.forEach((row) => {
      const key = `${row.target_year}-${row.target_quarter}`;
      if (!quarterGroups[key]) {
        quarterGroups[key] = {
          year: row.target_year,
          quarter: row.target_quarter,
          items: [],
        };
      }
      quarterGroups[key].items.push(row);
    });

    const quarters = Object.values(quarterGroups).sort((a: QuarterGroup, b: QuarterGroup) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.quarter.localeCompare(b.quarter);
    });

    // Helper to get reporting type badge style
    const getReportingTypeBadge = (type: ForgeReportingType) => {
      switch (type) {
        case 'execution':
          return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
        case 'summary':
          return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
        case 'planned':
          return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
        default:
          return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300';
      }
    };

    return (
      <div className="space-y-6">
        {/* Roadmap Header */}
        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-6">
          <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">
            6-Month Roadmap
          </h2>
        <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-6">
          Initiative and workstream planning by quarter. Data sourced from backend roadmap view.
        </p>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg p-4 border border-boh-border-light dark:border-boh-border">
            <div className="text-3xl font-bold text-boh-text-light dark:text-boh-text">{quarters.length}</div>
            <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Quarters</div>
          </div>
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg p-4 border border-boh-border-light dark:border-boh-border">
            <div className="text-3xl font-bold text-boh-text-light dark:text-boh-text">{roadmapData.length}</div>
            <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Workstreams</div>
          </div>
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg p-4 border border-boh-border-light dark:border-boh-border">
            <div className="text-3xl font-bold text-boh-text-light dark:text-boh-text">
              {new Set(roadmapData.map(r => r.initiative_id)).size}
            </div>
            <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Initiatives</div>
          </div>
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg p-4 border border-boh-border-light dark:border-boh-border">
            <div className="text-3xl font-bold text-boh-text-light dark:text-boh-text">
              {roadmapData.filter(r => r.reporting_type === 'execution').length}
            </div>
            <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">In Execution</div>
          </div>
        </div>
      </div>

      {/* Quarter Details */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text uppercase tracking-wide">
          Quarter Breakdown
        </h3>

        {quarters.length === 0 ? (
          <div className="text-center py-8 text-boh-text-sub-light dark:text-boh-text-sub">
            No quarters found matching current filters.
          </div>
        ) : (
          quarters.map((quarter) => (
            <div
              key={`${quarter.year}-${quarter.quarter}`}
              className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border overflow-hidden"
            >
              {/* Quarter Header */}
              <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border flex items-center justify-between">
                <h4 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
                  {quarter.year} {quarter.quarter}
                </h4>
                <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  {quarter.items.length} workstreams
                </div>
              </div>

              {/* Initiative List */}
              <div className="divide-y divide-boh-border-light dark:divide-boh-border">
                {quarter.items.map((item) => (
                  <div
                    key={item.workstream_id}
                    className="px-6 py-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-boh-text-light dark:text-boh-text">
                        {item.initiative_title}
                      </div>
                      <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                        {item.workstream_title}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                        {item.workstream_status}
                      </span>
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getReportingTypeBadge(item.reporting_type)}`}>
                        {item.reporting_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary Footer */}
      <div className="bg-boh-bg-light dark:bg-boh-bg/30 rounded-lg p-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
        <p>
          Report generated {new Date().toLocaleString()}.
          Covering {quarters.length} quarters with {new Set(roadmapData.map(r => r.initiative_id)).size} initiatives
          and {roadmapData.length} workstreams.
        </p>
      </div>
    </div>
  );
};

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b border-boh-border-light dark:border-boh-border flex-shrink-0 px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
              Forge
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
              Reports
            </h1>
          </div>
          {hasRunReport && releaseScheduleData.length > 0 && reportType === 'release' && (
            <ReportExportActions
              reportText={reportSummaryText}
              onCopy={() => navigator.clipboard.writeText(reportSummaryText)}
              onPrint={() => window.print()}
            />
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 h-full p-4 sm:p-6 lg:px-8">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start h-full">
          {/* Main Report Output Area */}
          <div className="min-h-0 min-w-0 flex flex-col">
            {/* Release Table Report */}
            {hasRunReport && !isLoadingRelease && reportType === 'release' && releaseScheduleData.length > 0 && renderReleaseTable()}

            {/* Executive Summary */}
            {hasRunReport && !isLoadingExecutive && reportType === 'executive' && executiveData.length > 0 && renderExecutiveSummary()}

            {/* 6-Month Roadmap */}
            {hasRunReport && !isLoadingRoadmap && reportType === 'workstream' && roadmapData.length > 0 && renderRoadmap()}

            {/* Loading State */}
            {hasRunReport && (isLoadingRelease || isLoadingExecutive || isLoadingRoadmap) && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3 text-boh-text-sub-light dark:text-boh-text-sub">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Running {reportType === 'executive' ? 'Executive Summary' : reportType === 'release' ? 'Release Report' : 'Workstream Report'}...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {hasRunReport && !isLoadingRelease && !isLoadingExecutive && !isLoadingRoadmap && (releaseError || executiveError || roadmapError) && (
              <div className="text-center py-12">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-boh-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-2">
                  Report generation failed
                </h3>
                <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-4">
                  {releaseError || executiveError || roadmapError || 'Unable to generate report. Please try again.'}
                </p>
                <button
                  onClick={handleRunReport}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-boh-primary text-boh-text font-medium rounded-lg hover:bg-boh-primary/90 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="23 4 23 10 17 10"></polygon>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                  </svg>
                  Try Again
                </button>
              </div>
            )}

            {/* Initial Empty State */}
            {!hasRunReport && !isLoadingRelease && !isLoadingExecutive && !isLoadingRoadmap && (
              <div className="rounded-2xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-8 lg:p-10 shadow-sm">
                <div className="max-w-4xl">
                  <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">
                    Quick report presets
                  </h3>
                  
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <button
                      onClick={() => {
                        setFilters({ ...filters, report_window: '90days' });
                        handleReportTypeChange('release');
                        setTimeout(() => handleRunReport(), 100);
                      }}
                      className="w-full px-4 py-3 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-left hover:border-boh-primary dark:hover:border-boh-primary transition-all"
                    >
                      <p className="text-sm font-medium text-boh-text-light dark:text-boh-text">Release Delivery Status</p>
                      <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        Current releases, tickets, and delivery progress
                      </p>
                    </button>

                    <button
                      onClick={() => {
                        setFilters({ ...filters, report_window: '90days' });
                        handleReportTypeChange('executive');
                        setTimeout(() => handleRunReport(), 100);
                      }}
                      className="w-full px-4 py-3 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-left hover:border-boh-primary dark:hover:border-boh-primary transition-all"
                    >
                      <p className="text-sm font-medium text-boh-text-light dark:text-boh-text">Executive Summary</p>
                      <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        Delivery metrics and items needing attention
                      </p>
                    </button>

                    <button
                      onClick={() => {
                        setFilters({ ...filters, report_window: '6months' });
                        handleReportTypeChange('release');
                        setTimeout(() => handleRunReport(), 100);
                      }}
                      className="w-full px-4 py-3 border border-boh-border-light dark:border-boh-border rounded-lg bg-boh-surface-light dark:bg-boh-surface text-left hover:border-boh-primary dark:hover:border-boh-primary transition-all"
                    >
                      <p className="text-sm font-medium text-boh-text-light dark:text-boh-text">6-Month Roadmap</p>
                      <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        Medium-term release and delivery timeline
                      </p>
                    </button>
                  </div>

                  <div className="mt-6 pt-6 border-t border-boh-border-light dark:border-boh-border">
                    <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                      Forge reports are release-first and ticket-aware. Initiative planning summaries belong in Menu.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Right Rail: Report Controls */}
          <div className="hidden xl:block w-[320px] relative">
            <div className="sticky top-6 p-4 space-y-6">
              {/* Report Type Selector */}
              <div>
                <FilterDropdown
                  label="Report Type"
                  displayValue={
                    reportType === 'release' ? 'Release Delivery Report' : 
                    reportType === 'executive' ? 'Executive Summary' : 
                    reportType === 'workstream' ? 'Workstream Health' : ''
                  }
                  options={[
                    { value: 'release', label: 'Release Delivery Report' },
                    { value: 'executive', label: 'Executive Summary' },
                    { value: 'workstream', label: 'Workstream Health' },
                  ]}
                  onSelect={(value) => handleReportTypeChange(value as ReportType)}
                />
              </div>

              {/* Run Report Button - resets to "Run Report" when type changes */}
              <div>
                <button
                  onClick={handleRunReport}
                  disabled={isLoadingRelease || isLoadingExecutive}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-boh-primary text-boh-text font-semibold rounded-lg hover:bg-boh-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoadingRelease || isLoadingExecutive ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Running...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      {hasRunReport ? 'Re-run Report' : 'Run Report'}
                    </>
                  )}
                </button>
              </div>

              {/* Report Filters */}
              <div>
                <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-3 uppercase tracking-wide">
                  Report Filters
                </h3>
                <ReportFiltersBar
                  filters={filters}
                  onChange={setFilters}
                  availableApps={availableApps}
                  availableQuarters={availableQuarters}
                  availableYears={availableYears}
                />
              </div>

              {/* Report Summary (when data exists) */}
              {hasRunReport && !isLoadingRelease && releaseScheduleData.length > 0 && (
                <div className="pt-6 border-t border-boh-border-light dark:border-boh-border">
                  <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-3 uppercase tracking-wide">
                    Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-boh-text-sub-light dark:text-boh-text-sub">Total Releases</span>
                      <span className="font-medium text-boh-text-light dark:text-boh-text">{releaseScheduleData.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-boh-text-sub-light dark:text-boh-text-sub">Total Tickets</span>
                      <span className="font-medium text-boh-text-light dark:text-boh-text">{releaseScheduleData.reduce((sum, r) => sum + r.total_tickets, 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-boh-text-sub-light dark:text-boh-text-sub">High Priority Open</span>
                      <span className="font-medium text-boh-primary dark:text-boh-primary">{releaseScheduleData.reduce((sum, r) => sum + r.high_priority_tickets, 0)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <Toast
        message={toastMessage}
        isVisible={isToastVisible}
        onClose={() => setIsToastVisible(false)}
      />
    </div>
  );
};

export default ReportsPage;

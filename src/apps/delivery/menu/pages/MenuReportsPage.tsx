import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabase';
import Toast from '../../../../components/Toast';
import ReportFiltersBar from '../../shared/components/ReportFiltersBar';
import ReportSummaryCards from '../../shared/components/ReportSummaryCards';
import ReportExportActions from '../../shared/components/ReportExportActions';
import ReadinessBadge from '../../shared/components/ReadinessBadge';
import InitiativeDetailPanel from '../../shared/components/InitiativeDetailPanel';
import ExecutiveSummaryPanel from '../../shared/components/ExecutiveSummaryPanel';
import FilterDropdown from '../../shared/components/FilterDropdown';
import { useOverviewReport, useInitiativeDetailReport, useExecutiveSummary } from '../../shared/hooks/useReports';
import type {
  OverviewReportData,
  AppSummary,
  InitiativeInfo,
  ReportFilters,
  ReportWindow,
} from '../../shared/types/reporting';

type ReportType = 'initiative-overview' | 'strategic-summary';

const MenuReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [availableApps, setAvailableApps] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const [reportType, setReportType] = useState<ReportType>('strategic-summary');
  const [hasRunReport, setHasRunReport] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({
    report_window: '90days',
    app_id: undefined,
    quarter: undefined,
    year: undefined,
    readiness: undefined,
    planning_stage: undefined,
    ticket_status: undefined,
    story_completion: 'all',
  });

  // Available quarters and years from calendar
  const [availableQuarters] = useState<string[]>(['Q1', 'Q2', 'Q3', 'Q4']);
  const [availableYears] = useState<number[]>([2025, 2026, 2027]);

  // Load available apps on mount
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

  // Memoize options to prevent infinite re-renders
  const overviewOptions = useMemo(() => ({
    report_window: filters.report_window,
    app_id: filters.app_id,
    quarter: filters.quarter,
    year: filters.year,
    readiness_filter: filters.readiness,
    enabled: false, // Disable auto-fetching
  }), [filters.report_window, filters.app_id, filters.quarter, filters.year, filters.readiness]);

  const executiveOptions = useMemo(() => ({
    reportWindow: filters.report_window,
    enabled: false, // Disable auto-fetching
  }), [filters.report_window]);

  // Use hooks for data fetching (disabled by default)
  const {
    data: reportData,
    isLoading: isLoadingOverview,
    error: overviewError,
    refetch: refetchOverview,
  } = useOverviewReport(overviewOptions);

  const {
    data: initiativeDetail,
    isLoading: isLoadingInitiative,
  } = useInitiativeDetailReport(selectedInitiativeId);

  const {
    data: executiveSummary,
    isLoading: isLoadingExecutive,
    error: executiveError,
    refetch: refetchExecutive,
  } = useExecutiveSummary(executiveOptions);

  const showToast = (message: string) => {
    setToastMessage(message);
    setIsToastVisible(true);
  };

  // Manual report execution
  const handleRunReport = useCallback(async () => {
    setHasRunReport(true);
    
    // Run only the selected report type
    if (reportType === 'initiative-overview') {
      await refetchOverview();
    } else if (reportType === 'strategic-summary') {
      await refetchExecutive();
    }
  }, [reportType, refetchOverview, refetchExecutive]);

  // Get current loading state and error
  const isLoading = reportType === 'initiative-overview' ? isLoadingOverview : isLoadingExecutive;
  const reportError = reportType === 'initiative-overview' ? overviewError : executiveError;
  const currentReportData = reportType === 'initiative-overview' ? reportData : executiveSummary;

  // Filter apps based on selected app filter
  const filteredApps = useMemo(() => {
    if (!reportData) return [];
    if (filters.app_id) {
      return reportData.apps.filter((app) => app.app_id === filters.app_id);
    }
    return reportData.apps;
  }, [reportData, filters.app_id]);

  // Generate report summary text for export
  const reportSummaryText = useMemo(() => {
    if (!reportData) return '';

    const lines: string[] = [
      `Strategic Initiative Report - ${filters.report_window.replace(/(\d+)/, ' $1 ').toUpperCase()}`,
      `Generated: ${new Date(reportData.generated_at).toLocaleDateString()}`,
      '',
      `Initiative Summary:`,
      `- Total Initiatives: ${reportData.total_initiatives}`,
      `- Active Initiatives: ${reportData.total_active_initiatives}`,
      `- Planned Initiatives: ${reportData.total_planned_initiatives}`,
      `- At Risk: ${reportData.total_at_risk}`,
      `- Total User Stories: ${reportData.total_user_stories}`,
      `- Incomplete Stories: ${reportData.total_incomplete_stories}`,
      `- Total Tickets: ${reportData.total_tickets}`,
      `- Outstanding Tickets: ${reportData.total_outstanding_tickets}`,
      '',
      'By App:',
    ];

    reportData.apps.forEach((app) => {
      lines.push(`\n${app.app_name}:`);
      lines.push(`  - Initiatives: ${app.initiative_count} (${app.active_initiative_count} active)`);
      lines.push(`  - User Stories: ${app.total_user_stories} (${app.incomplete_user_stories} incomplete)`);
      lines.push(`  - Tickets: ${app.total_tickets} (${app.outstanding_tickets} outstanding)`);
      if (app.at_risk_count > 0) {
        lines.push(`  - ⚠️ At Risk: ${app.at_risk_count}`);
      }
    });

    return lines.join('\n');
  }, [reportData, filters.report_window]);

  const handleInitiativeClick = (initiativeId: string) => {
    setSelectedInitiativeId(initiativeId);
  };

  const handleReleaseClick = (releaseId: string) => {
    setSelectedReleaseId(releaseId);
  };
  useEffect(() => {
    if (reportError) {
      showToast(reportError);
    }
  }, [reportError]);

  // Render initiative list for an app
  const renderInitiativeList = (initiatives: InitiativeInfo[]) => {
    return (
      <div className="space-y-3">
        {initiatives.map((initiative) => (
          <div
            key={initiative.id}
            onClick={() => handleInitiativeClick(initiative.id)}
            className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border p-4 cursor-pointer hover:border-boh-primary dark:hover:border-boh-primary transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-boh-text-light dark:text-boh-text truncate">
                  {initiative.title}
                </h4>
                <div className="mt-1 flex items-center gap-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  <span>{initiative.planning_stage_label}</span>
                  {initiative.target_quarter && initiative.target_year && (
                    <>
                      <span className="text-boh-border-light dark:text-boh-border">•</span>
                      <span>
                        {initiative.target_quarter} {initiative.target_year}
                      </span>
                    </>
                  )}
                  {initiative.major_release && (
                    <>
                      <span className="text-boh-border-light dark:text-boh-border">•</span>
                      <span className="font-medium">{initiative.major_release.version_label}</span>
                    </>
                  )}
                </div>
              </div>
              <ReadinessBadge readiness={initiative.readiness} size="sm" />
            </div>

            {/* Progress metrics */}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>
                  {initiative.incomplete_user_story_count}/{initiative.user_story_count} stories
                </span>
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                <span>
                  {initiative.outstanding_ticket_count}/{initiative.ticket_count} tickets
                </span>
              </div>
              {initiative.high_priority_ticket_count > 0 && (
                <div className="flex items-center gap-1 text-boh-primary dark:text-boh-primary">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{initiative.high_priority_ticket_count} high priority</span>
                </div>
              )}
            </div>

            {/* Linked minor releases */}
            {initiative.linked_minor_releases.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {initiative.linked_minor_releases.map((release) => (
                  <span
                    key={release.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReleaseClick(release.id);
                    }}
                    className="inline-flex items-center px-2 py-0.5 text-xs rounded-md bg-boh-bg-light dark:bg-boh-bg border border-boh-border-light dark:border-boh-border hover:border-boh-primary dark:hover:border-boh-primary cursor-pointer transition-colors"
                  >
                    {release.version_label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render overview view
  const renderOverview = () => {
    if (!reportData) return null;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <ReportSummaryCards
          totalInitiatives={reportData.total_initiatives}
          activeInitiatives={reportData.total_active_initiatives}
          plannedInitiatives={reportData.total_planned_initiatives}
          atRiskCount={reportData.total_at_risk}
          totalStories={reportData.total_user_stories}
          incompleteStories={reportData.total_incomplete_stories}
          totalTickets={reportData.total_tickets}
          outstandingTickets={reportData.total_outstanding_tickets}
          highPriorityTickets={reportData.total_high_priority_tickets}
        />

        {/* Apps with initiatives */}
        <div className="space-y-6">
          {filteredApps.map((app) => (
            <div
              key={app.app_id}
              className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border"
            >
              <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
                      {app.app_name}
                    </h3>
                    <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-0.5">
                      {app.initiative_count} initiative{app.initiative_count !== 1 ? 's' : ''} •{' '}
                      {app.active_initiative_count} active • {app.planned_initiative_count} planned
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {app.at_risk_count > 0 && (
                      <span className="px-3 py-1 text-sm font-medium rounded-full bg-boh-primary-tint dark:bg-boh-primary/20 text-boh-primary dark:text-boh-primary">
                        {app.at_risk_count} at risk
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6">
                {renderInitiativeList(app.initiatives)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Page Header */}
      <div className="border-b border-boh-border-light dark:border-boh-border flex-shrink-0 px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm mb-1">
              <span className="text-boh-text-light dark:text-boh-text font-medium">Menu</span>
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">/</span>
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Reports</span>
            </nav>
            <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
              Strategic Initiative Reports
            </h1>
          </div>
          {hasRunReport && reportData && (
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
            {/* Report Results */}
            {hasRunReport && !isLoading && reportType === 'initiative-overview' && reportData && renderOverview()}

            {hasRunReport && !isLoading && reportType === 'strategic-summary' && executiveSummary && (
              <ExecutiveSummaryPanel report={executiveSummary} reportWindow={filters.report_window} />
            )}

            {/* Loading State */}
            {hasRunReport && isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3 text-boh-text-sub-light dark:text-boh-text-sub">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Running {reportType === 'strategic-summary' ? 'Strategic Summary' : 'Initiative Overview'}...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {hasRunReport && !isLoading && reportError && (
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
                  {reportError || 'Unable to generate report. Please try again.'}
                </p>
                <button
                  onClick={handleRunReport}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-boh-primary text-white font-medium rounded-lg hover:bg-boh-primary/90 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                  </svg>
                  Try Again
                </button>
              </div>
            )}

            {/* Initial Empty State */}
            {!hasRunReport && !isLoading && (
              <div className="rounded-2xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-8 lg:p-10 shadow-sm">
                <div className="max-w-4xl">
                  <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">
                    Strategic Initiative Reports
                  </h3>
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-6">
                    Focus on initiative planning, strategic alignment, and readiness for execution.
                  </p>
                  
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <button
                      onClick={() => {
                        setFilters({ ...filters, report_window: '90days' });
                        setReportType('strategic-summary');
                        setTimeout(() => handleRunReport(), 100);
                      }}
                      className="group rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4 text-left hover:border-boh-primary hover:shadow-sm transition-all"
                    >
                      <p className="text-sm font-medium text-boh-text-light dark:text-boh-text group-hover:text-boh-primary">This quarter</p>
                      <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        Current quarter initiatives and planning
                      </p>
                    </button>

                    <button
                      onClick={() => {
                        setFilters({ ...filters, report_window: 'next_quarter' });
                        setReportType('strategic-summary');
                        setTimeout(() => handleRunReport(), 100);
                      }}
                      className="group rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4 text-left hover:border-boh-primary hover:shadow-sm transition-all"
                    >
                      <p className="text-sm font-medium text-boh-text-light dark:text-boh-text group-hover:text-boh-primary">Next quarter</p>
                      <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        Upcoming quarter strategic planning
                      </p>
                    </button>

                    <button
                      onClick={() => {
                        setFilters({ ...filters, report_window: '6months' });
                        setReportType('initiative-overview');
                        setTimeout(() => handleRunReport(), 100);
                      }}
                      className="group rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4 text-left hover:border-boh-primary hover:shadow-sm transition-all"
                    >
                      <p className="text-sm font-medium text-boh-text-light dark:text-boh-text group-hover:text-boh-primary">Next 6 months</p>
                      <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        Medium-term initiative roadmap
                      </p>
                    </button>

                    <button
                      onClick={() => {
                        setFilters({ ...filters, report_window: '12months' });
                        setReportType('strategic-summary');
                        setTimeout(() => handleRunReport(), 100);
                      }}
                      className="group rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4 text-left hover:border-boh-primary hover:shadow-sm transition-all"
                    >
                      <p className="text-sm font-medium text-boh-text-light dark:text-boh-text group-hover:text-boh-primary">Next 12 months</p>
                      <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        Annual strategic initiative overview
                      </p>
                    </button>
                  </div>

                  <div className="mt-6 pt-6 border-t border-boh-border-light dark:border-boh-border">
                    <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                      Or customize your report using the controls on the right
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
                  displayValue={reportType === 'initiative-overview' ? 'Initiative Overview' : 'Strategic Summary'}
                  options={[
                    { value: 'strategic-summary', label: 'Strategic Summary' },
                    { value: 'initiative-overview', label: 'Initiative Overview' },
                  ]}
                  onSelect={(value) => setReportType(value as ReportType)}
                />
              </div>

              {/* Run Report Button */}
              <div>
                <button
                  onClick={handleRunReport}
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-boh-primary text-white font-semibold rounded-lg hover:bg-boh-primary/90 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
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
              {hasRunReport && !isLoading && reportData && (
                <div className="pt-6 border-t border-boh-border-light dark:border-boh-border">
                  <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-3 uppercase tracking-wide">
                    Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-boh-text-sub-light dark:text-boh-text-sub">Total Initiatives</span>
                      <span className="font-medium text-boh-text-light dark:text-boh-text">{reportData.total_initiatives}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-boh-text-sub-light dark:text-boh-text-sub">Active</span>
                      <span className="font-medium text-boh-text-light dark:text-boh-text">{reportData.total_active_initiatives}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-boh-text-sub-light dark:text-boh-text-sub">At Risk</span>
                      <span className="font-medium text-boh-primary dark:text-boh-primary">{reportData.total_at_risk}</span>
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

export default MenuReportsPage;

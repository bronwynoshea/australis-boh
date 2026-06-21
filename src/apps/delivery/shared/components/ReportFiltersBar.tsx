import React, { useState, useMemo } from 'react';
import type {
  ReportFilters,
  ReportWindow,
  InitiativeReadiness,
} from '../types/reporting';
import FilterDropdown from './FilterDropdown';

interface ReportFiltersBarProps {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  availableApps: { id: string; name: string; slug: string }[];
  availableQuarters: string[];
  availableYears: number[];
  className?: string;
}

const ReportFiltersBar: React.FC<ReportFiltersBarProps> = ({
  filters,
  onChange,
  availableApps,
  availableQuarters,
  availableYears,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const readinessOptions: { value: InitiativeReadiness; label: string }[] = [
    { value: 'on_track', label: 'On Track' },
    { value: 'needs_attention', label: 'Needs Attention' },
    { value: 'at_risk', label: 'At Risk' },
    { value: 'parked', label: 'Parked' },
    { value: 'no_coding_planned', label: 'No Coding' },
    { value: 'complete', label: 'Complete' },
  ];

  const windowOptions: { value: ReportWindow; label: string }[] = [
    { value: '90days', label: 'Next 90 Days' },
    { value: 'next_quarter', label: 'Next Quarter' },
    { value: '6months', label: 'Next 6 Months' },
    { value: '12months', label: 'Next 12 Months' },
  ];

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.app_id) count++;
    if (filters.quarter) count++;
    if (filters.year) count++;
    if (filters.readiness) count++;
    if (filters.planning_stage) count++;
    if (filters.ticket_status) count++;
    if (filters.story_completion && filters.story_completion !== 'all') count++;
    return count;
  }, [filters]);

  const handleClearFilters = () => {
    onChange({
      report_window: filters.report_window,
      app_id: undefined,
      quarter: undefined,
      year: undefined,
      readiness: undefined,
      planning_stage: undefined,
      ticket_status: undefined,
      story_completion: 'all',
    });
  };

  const updateFilter = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className={`bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border min-h-[600px] ${className}`}>
      {/* Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-boh-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span className="font-medium text-boh-text-light dark:text-boh-text">Report Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-boh-primary text-white rounded-full">
              {activeFilterCount} active
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-boh-text-sub-light dark:text-boh-text-sub transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Filters Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-boh-border-light dark:border-boh-border">
          <div className="space-y-4 pt-4">
            {/* Reporting Window */}
            <FilterDropdown
              label="Reporting Window"
              displayValue={windowOptions.find(opt => opt.value === filters.report_window)?.label}
              options={windowOptions}
              onSelect={(value) => updateFilter('report_window', value as ReportWindow)}
            />

            {/* App Filter */}
            <FilterDropdown
              label="App"
              displayValue={availableApps.find(app => app.id === filters.app_id)?.name}
              options={[
                { label: 'All Apps', value: undefined },
                ...availableApps.map(app => ({ label: app.name, value: app.id }))
              ]}
              onSelect={(value) => updateFilter('app_id', value as string | undefined)}
            />

            {/* Quarter Filter */}
            <FilterDropdown
              label="Quarter"
              displayValue={filters.quarter}
              options={[
                { label: 'All Quarters', value: undefined },
                ...availableQuarters.map(q => ({ label: q, value: q }))
              ]}
              onSelect={(value) => updateFilter('quarter', value as string | undefined)}
            />

            {/* Year Filter */}
            <FilterDropdown
              label="Year"
              displayValue={filters.year?.toString()}
              options={[
                { label: 'All Years', value: undefined },
                ...availableYears.map(y => ({ label: y.toString(), value: y }))
              ]}
              onSelect={(value) => updateFilter('year', value as number | undefined)}
            />

            {/* Readiness Filter */}
            <FilterDropdown
              label="Readiness"
              displayValue={readinessOptions.find(opt => opt.value === filters.readiness)?.label}
              options={readinessOptions}
              onSelect={(value) => updateFilter('readiness', value as InitiativeReadiness | undefined)}
            />

            {/* Story Completion */}
            <FilterDropdown
              label="Stories"
              displayValue={
                filters.story_completion === 'complete' ? 'Complete Only' :
                filters.story_completion === 'incomplete' ? 'Incomplete Only' : 
                'All Stories'
              }
              options={[
                { label: 'All Stories', value: 'all' as const },
                { label: 'Complete Only', value: 'complete' as const },
                { label: 'Incomplete Only', value: 'incomplete' as const }
              ]}
              onSelect={(value) => updateFilter('story_completion', value as 'complete' | 'incomplete' | 'all')}
            />
          </div>

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <div className="mt-6 pt-4 border-t border-boh-border-light dark:border-boh-border flex justify-end">
              <button
                onClick={handleClearFilters}
                className="text-sm text-boh-primary hover:text-boh-primary/80 font-medium transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportFiltersBar;

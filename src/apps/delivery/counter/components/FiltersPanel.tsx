import React, { useEffect } from 'react';
import type { TicketFilterState, Agent, AppKey, ReleaseVersion, CounterAppOption } from '../types';
import { TicketSeverity } from '../types';
import { APP_OPTIONS, SEVERITY_OPTIONS } from '../constants';
import PillGroup from './PillGroup';

interface FiltersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: TicketFilterState;
  agents: Agent[];
  appOptions: CounterAppOption[];
  statusOptions: Array<{ value: string; label: string }>;
  priorityOptions: Array<{ value: string; label: string }>;
  releaseOptions: ReleaseVersion[];
  onFilterChange: (category: keyof TicketFilterState, value: TicketSeverity | AppKey | string) => void;
  onApply: () => void;
  onReset: () => void;
  metricView: 'severity' | 'priority';
}

const formatReleaseOption = (version: ReleaseVersion): string => {
  const year = typeof version.release_year === 'number' ? String(version.release_year) : '';
  const cycle = typeof version.release_cycle === 'string' ? version.release_cycle : '';
  const number = typeof version.version_number === 'string' && version.version_number.trim()
    ? `v${version.version_number.trim().replace(/^v\s*/i, '')}`
    : '';
  const prefix = [year, cycle, number].filter(Boolean).join(' · ');
  return prefix ? `${prefix} · ${version.version_label}` : version.version_label;
};

const FiltersPanel: React.FC<FiltersPanelProps> = ({ isOpen, onClose, filters, agents, appOptions, statusOptions, priorityOptions, releaseOptions, onFilterChange, onApply, onReset, metricView }) => {
  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const severityOptions = SEVERITY_OPTIONS.map(opt => ({ value: opt.key, label: opt.label }));
  const assigneeOptions = [
    { value: 'Unassigned', label: 'Unassigned' },
    ...agents.map(agent => ({ value: agent.name, label: agent.name }))
  ];
  const resolvedAppOptions = appOptions.length > 0
    ? appOptions.map((app) => ({
        value: app.id,
        label: app.name || app.slug || 'Unnamed app',
      }))
    : APP_OPTIONS.map(app => ({ value: app.key, label: app.label }));
  const releaseFilterOptions = [
    { value: 'none', label: 'Needs release' },
    ...releaseOptions.map((version) => ({ value: version.id, label: formatReleaseOption(version) })),
  ];

  // Helper to handle filter changes with Set toggle
  const handleFilterToggle = (category: keyof TicketFilterState, value: string) => {
    onFilterChange(category, value as any);
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={onClose}
      />
      
      {/* Panel - Mobile bottom sheet, Desktop side panel */}
      <div 
        className="fixed bottom-0 left-0 right-0 lg:left-auto lg:right-0 lg:top-0 lg:bottom-auto lg:w-80 bg-boh-surface-light dark:bg-boh-surface border-t lg:border-t-0 lg:border-l border-boh-border-light dark:border-boh-border shadow-lg max-h-[80vh] lg:max-h-screen flex flex-col z-40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border flex-shrink-0 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Filters</h2>
          <button 
            type="button" 
            className="p-2 text-boh-text-sub-light dark:text-boh-text-sub hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 rounded-lg transition-colors" 
            onClick={onClose} 
            title="Close filters"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto boh-hide-scrollbars px-6 py-4 space-y-6">
          {/* Status Section */}
          <section>
            <h3 className="text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">Status</h3>
            <PillGroup
              name="status"
              options={statusOptions}
              value={filters.statuses}
              onChange={(value) => handleFilterToggle('statuses', value)}
              ariaLabel="Filter by status"
              multiSelect={true}
            />
          </section>

          {/* Dynamic Severity/Priority Section */}
          {metricView === 'severity' ? (
            <section>
              <h3 className="text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">Severity</h3>
              <PillGroup
                name="severity"
                options={severityOptions}
                value={filters.severities}
                onChange={(value) => handleFilterToggle('severities', value)}
                ariaLabel="Filter by severity"
                multiSelect={true}
              />
            </section>
          ) : (
            <section>
              <h3 className="text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">Priority</h3>
              <PillGroup
                name="priority"
                options={priorityOptions}
                value={filters.priorities}
                onChange={(value) => handleFilterToggle('priorities', value)}
                ariaLabel="Filter by priority"
                multiSelect={true}
              />
            </section>
          )}

          {/* Assignee Section */}
          <section>
            <h3 className="text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">Assigned to</h3>
            <PillGroup
              name="assignee"
              options={assigneeOptions}
              value={filters.assignees}
              onChange={(value) => handleFilterToggle('assignees', value)}
              ariaLabel="Filter by assignee"
              multiSelect={true}
            />
          </section>
          
          {/* App Section */}
          <section>
            <h3 className="text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">App</h3>
            <PillGroup
              name="app"
              options={resolvedAppOptions}
              value={filters.apps}
              onChange={(value) => handleFilterToggle('apps', value)}
              ariaLabel="Filter by app"
              multiSelect={true}
            />
          </section>

          <section>
            <h3 className="text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">Release</h3>
            <PillGroup
              name="release"
              options={releaseFilterOptions}
              value={filters.releases}
              onChange={(value) => handleFilterToggle('releases', value)}
              ariaLabel="Filter by release"
              multiSelect={true}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-boh-border-light dark:border-boh-border flex-shrink-0 flex gap-3">
          <button 
            type="button" 
            className="flex-1 px-4 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-md shadow-sm hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 transition-colors" 
            onClick={onReset}
          >
            Reset
          </button>
          <button 
            type="button" 
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-boh-primary border border-transparent rounded-md shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2" 
            onClick={onApply}
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
};

export default FiltersPanel;

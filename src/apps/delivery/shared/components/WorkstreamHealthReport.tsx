import React, { useState, useMemo } from 'react';
import FilterDropdown from './FilterDropdown';
import ReportExportActions from './ReportExportActions';
import type { WorkstreamHealth } from '../hooks/useWorkstreamReports';

interface WorkstreamHealthReportProps {
  workstreams: WorkstreamHealth[];
  isLoading: boolean;
  quarter?: string;
  year?: number;
  onFilterChange: (filters: { app_id?: string; status?: string; risk_level?: string }) => void;
}

const WorkstreamHealthReport: React.FC<WorkstreamHealthReportProps> = ({
  workstreams,
  isLoading,
  quarter,
  year,
  onFilterChange,
}) => {
  const [groupBy, setGroupBy] = useState<'app' | 'status' | 'risk'>('app');
  const [selectedApp, setSelectedApp] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [selectedRisk, setSelectedRisk] = useState<string | undefined>();

  // Extract unique apps for filter
  const availableApps = useMemo(() => {
    const apps = new Map<string, string>();
    workstreams?.forEach(ws => {
      if (ws.app_id && ws.app_name) {
        apps.set(ws.app_id, ws.app_name);
      }
    });
    return Array.from(apps.entries()).map(([id, name]) => ({ value: id, label: name }));
  }, [workstreams]);

  // Group workstreams
  const groupedWorkstreams = useMemo(() => {
    if (!workstreams) return {};

    const groups: Record<string, WorkstreamHealth[]> = {};

    workstreams.forEach(ws => {
      let key: string;
      switch (groupBy) {
        case 'app':
          key = ws.app_name || 'Unknown App';
          break;
        case 'status':
          key = ws.status || 'Unknown';
          break;
        case 'risk':
          key = ws.risk_level;
          break;
        default:
          key = 'All';
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(ws);
    });

    return groups;
  }, [workstreams, groupBy]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!workstreams || workstreams.length === 0) {
      return {
        total: 0,
        avgProgress: 0,
        totalStories: 0,
        totalTasks: 0,
        highRisk: 0,
        withOwner: 0,
      };
    }

    const total = workstreams.length;
    const avgProgress = Math.round(
      workstreams.reduce((sum, ws) => sum + ws.progress, 0) / total
    );
    const totalStories = workstreams.reduce((sum, ws) => sum + ws.story_count, 0);
    const totalTasks = workstreams.reduce((sum, ws) => sum + ws.task_count, 0);
    const highRisk = workstreams.filter(ws => ws.risk_level === 'high').length;
    const withOwner = workstreams.filter(ws => ws.owner_name).length;

    return { total, avgProgress, totalStories, totalTasks, highRisk, withOwner };
  }, [workstreams]);

  // Generate export text
  const exportText = useMemo(() => {
    const lines = [
      `Workstream Health Report${quarter && year ? ` - ${quarter} ${year}` : ''}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      '',
      'Summary:',
      `- Total Workstreams: ${summaryStats.total}`,
      `- Average Progress: ${summaryStats.avgProgress}%`,
      `- Total Stories: ${summaryStats.totalStories}`,
      `- Total Tasks: ${summaryStats.totalTasks}`,
      `- High Risk: ${summaryStats.highRisk}`,
      `- With Owner: ${summaryStats.withOwner}`,
      '',
      'Workstream Details:',
    ];

    Object.entries(groupedWorkstreams).forEach(([group, itemsUntyped]) => {
      const items = itemsUntyped as WorkstreamHealth[];
      lines.push(`\n${group} (${items.length} workstreams):`);
      items.forEach(ws => {
        lines.push(`  - ${ws.workstream_title}`);
        lines.push(`    App: ${ws.app_name}`);
        lines.push(`    Owner: ${ws.owner_name || 'None'}`);
        lines.push(`    Progress: ${ws.progress}%`);
        lines.push(`    Stories: ${ws.completed_story_count}/${ws.story_count}`);
        lines.push(`    Tasks: ${ws.completed_task_count}/${ws.task_count}`);
        lines.push(`    Releases: ${ws.linked_releases_count}`);
        lines.push(`    Risk: ${ws.risk_level}${ws.risk_factors.length > 0 ? ` (${ws.risk_factors.join(', ')})` : ''}`);
        lines.push('');
      });
    });

    return lines.join('\n');
  }, [groupedWorkstreams, summaryStats, quarter, year]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-boh-skeleton animate-pulse rounded" />
        <div className="grid grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-boh-skeleton animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-boh-skeleton animate-pulse rounded-xl" />
      </div>
    );
  }

  const handleAppFilter = (value: string) => {
    setSelectedApp(value);
    onFilterChange({ app_id: value, status: selectedStatus, risk_level: selectedRisk });
  };

  const handleStatusFilter = (value: string) => {
    setSelectedStatus(value);
    onFilterChange({ app_id: selectedApp, status: value, risk_level: selectedRisk });
  };

  const handleRiskFilter = (value: string) => {
    setSelectedRisk(value);
    onFilterChange({ app_id: selectedApp, status: selectedStatus, risk_level: value });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-boh-text-light dark:text-boh-text">
          Workstream Health Report
        </h2>
        <ReportExportActions
          reportTitle={`Workstream Health${quarter && year ? ` - ${quarter} ${year}` : ''}`}
          reportContent={exportText}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
          <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
            {summaryStats.total}
          </div>
          <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            Total Workstreams
          </div>
        </div>

        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
          <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
            {summaryStats.avgProgress}%
          </div>
          <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            Avg Progress
          </div>
        </div>

        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
          <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
            {summaryStats.totalStories}
          </div>
          <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            Total Stories
          </div>
        </div>

        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
          <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
            {summaryStats.totalTasks}
          </div>
          <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            Total Tasks
          </div>
        </div>

        <div className={`rounded-xl border p-4 ${
          summaryStats.highRisk > 0
            ? 'bg-boh-primary/10 dark:bg-boh-primary/10 border-boh-primary/20 dark:border-boh-primary/20'
            : 'bg-boh-surface-light dark:bg-boh-surface border-boh-border-light dark:border-boh-border'
        }`}>
          <div className={`text-2xl font-bold ${
            summaryStats.highRisk > 0 ? 'text-boh-primary dark:text-boh-primary' : 'text-boh-text-light dark:text-boh-text'
          }`}>
            {summaryStats.highRisk}
          </div>
          <div className={`text-xs mt-1 ${
            summaryStats.highRisk > 0 ? 'text-boh-primary dark:text-boh-primary' : 'text-boh-text-sub-light dark:text-boh-text-sub'
          }`}>
            High Risk
          </div>
        </div>

        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
          <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
            {summaryStats.withOwner}
          </div>
          <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            With Owner
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Group by:</span>
            <FilterDropdown
              label="Grouping"
              displayValue={groupBy === 'app' ? 'App' : groupBy === 'status' ? 'Status' : 'Risk'}
              options={[
                { value: 'app', label: 'App' },
                { value: 'status', label: 'Status' },
                { value: 'risk', label: 'Risk Level' },
              ]}
              onSelect={(value) => setGroupBy(value as 'app' | 'status' | 'risk')}
            />
          </div>

          {availableApps.length > 0 && (
            <FilterDropdown
              label="App"
              displayValue={selectedApp ? availableApps.find(a => a.value === selectedApp)?.label || 'All' : 'All Apps'}
              options={[{ value: '', label: 'All Apps' }, ...availableApps]}
              onSelect={handleAppFilter}
            />
          )}

          <FilterDropdown
            label="Status"
            displayValue={selectedStatus || 'All Status'}
            options={[
              { value: '', label: 'All Status' },
              { value: 'planned', label: 'Planned' },
              { value: 'in progress', label: 'In Progress' },
              { value: 'blocked', label: 'Blocked' },
              { value: 'done', label: 'Done' },
            ]}
            onSelect={handleStatusFilter}
          />

          <FilterDropdown
            label="Risk"
            displayValue={selectedRisk || 'All Risk'}
            options={[
              { value: '', label: 'All Risk' },
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
            onSelect={handleRiskFilter}
          />
        </div>
      </div>

      {/* Workstream List */}
      <div className="space-y-4">
        {Object.entries(groupedWorkstreams).map(([group, itemsUntyped]) => {
          const items = itemsUntyped as WorkstreamHealth[];
          return (
            <div key={group} className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border">
              <div className="px-4 py-3 border-b border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg/50 rounded-t-xl">
                <h3 className="font-semibold text-boh-text-light dark:text-boh-text">
                  {group} <span className="text-boh-text-sub-light dark:text-boh-text-sub">({items.length})</span>
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {items.map((ws) => (
                <div
                  key={ws.workstream_id}
                  className="flex flex-col gap-3 p-4 bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border hover:border-boh-primary dark:hover:border-boh-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-boh-text-light dark:text-boh-text truncate">
                        {ws.workstream_title}
                      </h4>
                      <div className="mt-1 flex items-center gap-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                        <span>{ws.app_name}</span>
                        {ws.owner_name && (
                          <>
                            <span>•</span>
                            <span>Owner: {ws.owner_name}</span>
                          </>
                        )}
                        {ws.target_quarter && ws.target_year && (
                          <>
                            <span>•</span>
                            <span>{ws.target_quarter} {ws.target_year}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        ws.risk_level === 'high'
                          ? 'bg-boh-primary/10 text-boh-primary dark:bg-boh-primary/10 dark:text-boh-primary'
                          : ws.risk_level === 'medium'
                          ? 'bg-boh-primary/10 text-boh-primary dark:bg-boh-primary/10 dark:text-boh-primary'
                          : 'bg-boh-surface-light text-boh-text-sub-light dark:bg-boh-surface dark:text-boh-text-sub'
                      }`}>
                        {ws.risk_level} risk
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-boh-text-sub-light dark:text-boh-text-sub text-xs">Progress</div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 bg-boh-surface-light dark:bg-boh-surface rounded-full h-2">
                          <div
                            className="bg-boh-primary h-2 rounded-full"
                            style={{ width: `${ws.progress}%` }}
                          />
                        </div>
                        <span className="font-medium text-boh-text-light dark:text-boh-text">{ws.progress}%</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-boh-text-sub-light dark:text-boh-text-sub text-xs">Stories</div>
                      <div className="mt-1 font-medium text-boh-text-light dark:text-boh-text">
                        {ws.completed_story_count}/{ws.story_count}
                      </div>
                    </div>

                    <div>
                      <div className="text-boh-text-sub-light dark:text-boh-text-sub text-xs">Tasks</div>
                      <div className="mt-1 font-medium text-boh-text-light dark:text-boh-text">
                        {ws.completed_task_count}/{ws.task_count}
                      </div>
                    </div>

                    <div>
                      <div className="text-boh-text-sub-light dark:text-boh-text-sub text-xs">Releases</div>
                      <div className="mt-1 font-medium text-boh-text-light dark:text-boh-text">
                        {ws.linked_releases_count}
                      </div>
                    </div>
                  </div>

                  {ws.risk_factors.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ws.risk_factors.map((factor, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs rounded bg-boh-primary/10 dark:bg-boh-primary/10 text-boh-primary dark:text-boh-primary"
                        >
                          {factor}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>
          );
        })}

        {workstreams?.length === 0 && (
          <div className="text-center py-12 bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border">
            <p className="text-boh-text-sub-light dark:text-boh-text-sub">
              No workstreams found matching the current filters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkstreamHealthReport;

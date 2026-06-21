import React from 'react';
import ReadinessBadge from './ReadinessBadge';
import ReportExportActions from './ReportExportActions';
import type { ExecutiveSummaryReport } from '../types/reporting';

interface ExecutiveSummaryPanelProps {
  report: ExecutiveSummaryReport;
  reportWindow: string;
}

const ExecutiveSummaryPanel: React.FC<ExecutiveSummaryPanelProps> = ({
  report,
  reportWindow,
}) => {
  const { metrics, at_risk_initiatives, releases_needing_attention, summary_paragraph } = report;

  // Generate summary text for export
  const summaryText = [
    `Executive Summary - ${reportWindow.replace(/(\d+)/, ' $1 ').toUpperCase()}`,
    `Generated: ${new Date(report.generated_at).toLocaleDateString()}`,
    '',
    summary_paragraph,
    '',
    'Key Metrics:',
    `- Apps with active initiatives: ${metrics.total_apps_with_active_initiatives}`,
    `- Initiatives at risk: ${metrics.initiatives_at_risk}`,
    `- Initiatives without major release: ${metrics.initiatives_without_major_release}`,
    `- Initiatives without user stories: ${metrics.initiatives_without_user_stories}`,
    `- Incomplete user stories: ${metrics.total_incomplete_stories}`,
    `- Open tickets: ${metrics.total_open_tickets}`,
    `- High priority open tickets: ${metrics.total_high_priority_open_tickets}`,
    `- Releases with unresolved work: ${metrics.releases_with_unresolved_work}`,
    '',
    at_risk_initiatives.length > 0 ? 'Initiatives Requiring Attention:' : '',
    ...at_risk_initiatives.map((i) => `- ${i.initiative_title} (${i.app_name}): ${i.risk_reason}`),
    '',
    releases_needing_attention.length > 0 ? 'Releases Needing Attention:' : '',
    ...releases_needing_attention.map((r) =>
      `- ${r.version_label}: ${r.unresolved_ticket_count} unresolved tickets, ${r.incomplete_story_count} incomplete stories`
    ),
  ].join('\n');

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-boh-text-light dark:text-boh-text">
          Executive Summary
        </h2>
        <ReportExportActions
          reportTitle={`Executive Summary - ${reportWindow}`}
          reportContent={summaryText}
        />
      </div>

      {/* Key Actionable Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="bg-boh-success-tint dark:bg-boh-success/20 rounded-xl border border-boh-success/30 dark:border-boh-success/30 p-4">
          <div className="text-3xl font-bold text-boh-success dark:text-boh-success">
            {metrics.total_apps_with_active_initiatives}
          </div>
          <div className="text-sm text-boh-success dark:text-boh-success mt-1">
            Apps with Active Initiatives
          </div>
        </div>

        <div className={`rounded-xl border p-4 ${
          metrics.initiatives_at_risk > 0
            ? 'bg-boh-primary-tint dark:bg-boh-surface border-boh-border-light dark:border-boh-border'
            : 'bg-boh-surface-light dark:bg-boh-surface border-boh-border-light dark:border-boh-border'
        }`}>
          <div className={`text-3xl font-bold ${
            metrics.initiatives_at_risk > 0
              ? 'text-boh-primary dark:text-boh-primary'
              : 'text-boh-text-light dark:text-boh-text'
          }`}>
            {metrics.initiatives_at_risk}
          </div>
          <div className={`text-sm mt-1 ${
            metrics.initiatives_at_risk > 0
              ? 'text-boh-text-sub-light dark:text-boh-text-sub'
              : 'text-boh-text-sub-light dark:text-boh-text-sub'
          }`}>
            Initiatives At Risk
          </div>
        </div>

        {/* High Priority Tickets */}
        <div className={`rounded-xl border p-4 ${
          metrics.total_high_priority_open_tickets > 0
            ? 'bg-boh-primary-tint dark:bg-boh-surface border-boh-border-light dark:border-boh-border'
            : 'bg-boh-surface-light dark:bg-boh-surface border-boh-border-light dark:border-boh-border'
        }`}>
          <div className={`text-3xl font-bold ${
            metrics.total_high_priority_open_tickets > 0
              ? 'text-boh-primary dark:text-boh-primary'
              : 'text-boh-text-light dark:text-boh-text'
          }`}>
            {metrics.total_high_priority_open_tickets}
          </div>
          <div className={`text-sm mt-1 ${
            metrics.total_high_priority_open_tickets > 0
              ? 'text-boh-text-sub-light dark:text-boh-text-sub'
              : 'text-boh-text-sub-light dark:text-boh-text-sub'
          }`}>
            High Priority Tickets
          </div>
        </div>

        {/* Releases Needing Attention */}
        <div className={`rounded-xl border p-4 ${
          metrics.releases_with_unresolved_work > 0
            ? 'bg-boh-primary-tint dark:bg-boh-surface border-boh-border-light dark:border-boh-border'
            : 'bg-boh-surface-light dark:bg-boh-surface border-boh-border-light dark:border-boh-border'
        }`}>
          <div className={`text-3xl font-bold ${
            metrics.releases_with_unresolved_work > 0
              ? 'text-boh-primary dark:text-boh-primary'
              : 'text-boh-text-light dark:text-boh-text'
          }`}>
            {metrics.releases_with_unresolved_work}
          </div>
          <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            Releases Needing Attention
          </div>
        </div>
      </div>

      {/* Planning Hygiene Metrics (Lower Priority) */}
      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-4">
        <h4 className="text-sm font-semibold text-boh-text-sub-light dark:text-boh-text-sub mb-3 uppercase tracking-wide">
          Planning Hygiene
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-3">
            <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
              {metrics.initiatives_without_major_release}
            </div>
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
              Without Major Release
            </div>
          </div>
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-3">
            <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
              {metrics.initiatives_without_user_stories}
            </div>
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
              Without User Stories
            </div>
          </div>
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-3">
            <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
              {metrics.total_incomplete_stories.toLocaleString()}
            </div>
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
              Incomplete Stories
            </div>
          </div>
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-3">
            <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
              {metrics.total_open_tickets.toLocaleString()}
            </div>
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
              Total Open Tickets
            </div>
          </div>
        </div>
      </div>

      {/* At Risk Initiatives */}
      {at_risk_initiatives.length > 0 && (
        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border">
          <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
            <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
              Initiatives Requiring Attention
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {at_risk_initiatives.map((initiative) => (
                <div
                  key={initiative.initiative_id}
                  className="p-3 bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="font-medium text-boh-text-light dark:text-boh-text text-sm leading-tight line-clamp-2">
                      {initiative.initiative_title}
                    </h4>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded flex-shrink-0 ${
                      initiative.severity === 'high'
                        ? 'bg-boh-primary-tint dark:bg-boh-primary/20 text-boh-primary dark:text-boh-primary'
                        : 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text'
                    }`}>
                      {initiative.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mb-2">
                    {initiative.app_name}
                  </p>
                  <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub line-clamp-2">
                    {initiative.risk_reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Releases Needing Attention */}
      {releases_needing_attention.length > 0 && (
        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border">
          <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
            <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
              Releases Needing Attention
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {releases_needing_attention.map((release) => (
                <div
                  key={release.release_id}
                  className="p-3 bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border"
                >
                  <h4 className="font-medium text-boh-text-light dark:text-boh-text text-sm mb-2">
                    {release.version_label}
                  </h4>
                  <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                    {release.unresolved_ticket_count} unresolved tickets,{' '}
                    {release.incomplete_story_count} incomplete stories
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummaryPanel;

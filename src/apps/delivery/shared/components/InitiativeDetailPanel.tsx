import React from 'react';
import ReadinessBadge from './ReadinessBadge';
import ReportExportActions from './ReportExportActions';
import type { InitiativeDetailReport } from '../types/reporting';

interface InitiativeDetailPanelProps {
  report: InitiativeDetailReport;
  onBack: () => void;
}

const InitiativeDetailPanel: React.FC<InitiativeDetailPanelProps> = ({
  report,
  onBack,
}) => {
  const { initiative, user_stories, tickets, related_minor_releases } = report;

  const incompleteStories = user_stories.filter((s) => s.status !== 'done' && !s.is_archived);
  const outstandingTickets = tickets.filter((t) => t.is_outstanding);

  // Generate summary text
  const summaryText = [
    `Initiative: ${initiative.title}`,
    `App: ${initiative.app_name}`,
    `Status: ${initiative.planning_stage_label}`,
    `Readiness: ${initiative.readiness.replace(/_/g, ' ')}`,
    ``,
    `User Stories: ${initiative.user_story_count} total, ${initiative.incomplete_user_story_count} incomplete`,
    `Tickets: ${initiative.ticket_count} total, ${initiative.outstanding_ticket_count} outstanding`,
    ``,
    incompleteStories.length > 0 ? 'Incomplete Stories:' : '',
    ...incompleteStories.map((s) => `- ${s.title} (${s.status})`),
    ``,
    outstandingTickets.length > 0 ? 'Outstanding Tickets:' : '',
    ...outstandingTickets.map((t) => `- ${t.ticket_number || 'TICKET'}: ${t.subject}`),
  ].join('\n');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Overview
        </button>
      </div>

      {/* Initiative Header */}
      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
                {initiative.title}
              </h2>
              <ReadinessBadge readiness={initiative.readiness} />
            </div>
            <p className="text-boh-text-sub-light dark:text-boh-text-sub">
              {initiative.app_name} • {initiative.planning_stage_label}
            </p>
            {initiative.description && (
              <p className="mt-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                {initiative.description}
              </p>
            )}
          </div>
          <ReportExportActions
            reportTitle={`Initiative Report: ${initiative.title}`}
            reportContent={summaryText}
          />
        </div>

        {/* Key Metrics */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-boh-bg-light dark:bg-boh-bg rounded-lg p-3">
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub uppercase">Target</div>
            <div className="text-lg font-semibold">
              {initiative.target_quarter && initiative.target_year
                ? `${initiative.target_quarter} ${initiative.target_year}`
                : 'Not set'}
            </div>
          </div>
          <div className="bg-boh-bg-light dark:bg-boh-bg rounded-lg p-3">
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub uppercase">Progress</div>
            <div className="text-lg font-semibold">{initiative.progress}%</div>
          </div>
          <div className="bg-boh-bg-light dark:bg-boh-bg rounded-lg p-3">
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub uppercase">Stories</div>
            <div className="text-lg font-semibold">
              {initiative.incomplete_user_story_count}/{initiative.user_story_count}
            </div>
          </div>
          <div className="bg-boh-bg-light dark:bg-boh-bg rounded-lg p-3">
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub uppercase">Tickets</div>
            <div className="text-lg font-semibold">
              {initiative.outstanding_ticket_count}/{initiative.ticket_count}
            </div>
          </div>
        </div>

        {/* Major Release */}
        {initiative.major_release && (
          <div className="mt-4 p-4 bg-boh-primary-tint dark:bg-boh-primary/20 rounded-lg border border-boh-border-light dark:border-boh-border">
            <div className="text-sm text-boh-primary dark:text-boh-primary">
              <span className="font-medium">Major Release:</span>{' '}
              {initiative.major_release.version_label}
              {initiative.major_release.release_date && (
                <span className="ml-2 text-boh-text-sub-light dark:text-boh-text-sub">
                  ({new Date(initiative.major_release.release_date).toLocaleDateString()})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Governance Notes */}
        {initiative.governance_notes && (
          <div className="mt-4 p-4 bg-boh-primary-tint dark:bg-boh-primary/20 rounded-lg border border-boh-border-light dark:border-boh-border">
            <div className="text-sm font-medium text-boh-primary dark:text-boh-primary mb-1">
              Governance Notes
            </div>
            <div className="text-sm text-boh-text-light dark:text-boh-text">
              {initiative.governance_notes}
            </div>
          </div>
        )}
      </div>

      {/* User Stories Section */}
      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border">
        <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border">
          <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
            User Stories
            <span className="ml-2 text-sm font-normal text-boh-text-sub-light dark:text-boh-text-sub">
              ({incompleteStories.length} incomplete of {user_stories.length} total)
            </span>
          </h3>
        </div>
        <div className="p-6">
          {user_stories.length === 0 ? (
            <p className="text-boh-text-sub-light dark:text-boh-text-sub text-center py-4">
              No user stories linked to this initiative
            </p>
          ) : (
            <div className="space-y-3">
              {user_stories.map((story) => (
                <div
                  key={story.id}
                  className={`p-4 rounded-lg border ${
                    story.status === 'done'
                      ? 'bg-boh-surface-light dark:bg-boh-surface border-boh-border-light dark:border-boh-border'
                      : 'bg-boh-bg-light dark:bg-boh-bg border-boh-border-light dark:border-boh-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className={`font-medium ${
                        story.status === 'done'
                          ? 'text-boh-text-sub-light dark:text-boh-text-sub line-through opacity-75'
                          : 'text-boh-text-light dark:text-boh-text'
                      }`}>
                        {story.title}
                      </h4>
                      {story.description && (
                        <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          {story.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        <span className={`px-2 py-0.5 rounded ${
                          story.status === 'done'
                            ? 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text'
                            : 'bg-boh-border-light dark:bg-boh-border'
                        }`}>
                          {story.status}
                        </span>
                        {story.story_points && <span>{story.story_points} points</span>}
                        {story.estimated_hours && <span>{story.estimated_hours}h estimated</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tickets Section */}
      <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border">
        <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border">
          <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
            Linked Tickets
            <span className="ml-2 text-sm font-normal text-boh-text-sub-light dark:text-boh-text-sub">
              ({outstandingTickets.length} outstanding of {tickets.length} total)
            </span>
          </h3>
        </div>
        <div className="p-6">
          {tickets.length === 0 ? (
            <p className="text-boh-text-sub-light dark:text-boh-text-sub text-center py-4">
              No tickets linked to this initiative
            </p>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`p-4 rounded-lg border ${
                    !ticket.is_outstanding
                      ? 'bg-boh-surface-light dark:bg-boh-surface border-boh-border-light dark:border-boh-border'
                      : ticket.priority_weight >= 4
                      ? 'bg-boh-primary-tint dark:bg-boh-primary/20 border-boh-border-light dark:border-boh-border'
                      : 'bg-boh-bg-light dark:bg-boh-bg border-boh-border-light dark:border-boh-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-boh-text-sub-light dark:text-boh-text-sub">
                          {ticket.ticket_number || ticket.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          !ticket.is_outstanding
                            ? 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text'
                            : ticket.priority_weight >= 4
                            ? 'bg-boh-primary-tint dark:bg-boh-primary/20 text-boh-primary dark:text-boh-primary'
                            : 'bg-boh-border-light dark:bg-boh-border'
                        }`}>
                          {ticket.status_label}
                        </span>
                      </div>
                      <h4 className="mt-1 font-medium text-boh-text-light dark:text-boh-text">
                        {ticket.subject}
                      </h4>
                      <div className="mt-2 flex items-center gap-3 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        <span>{ticket.category}</span>
                        <span>•</span>
                        <span>{ticket.priority_label} priority</span>
                        {ticket.assigned_to_name && (
                          <>
                            <span>•</span>
                            <span>Assigned to {ticket.assigned_to_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Related Minor Releases */}
      {related_minor_releases.length > 0 && (
        <div className="bg-boh-surface-light dark:bg-boh-surface rounded-xl border border-boh-border-light dark:border-boh-border">
          <div className="px-6 py-4 border-b border-boh-border-light dark:border-boh-border">
            <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
              Linked Minor Releases
            </h3>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {related_minor_releases.map((release) => (
                <div
                  key={release.id}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-boh-primary-tint dark:bg-boh-primary/20 rounded-lg border border-boh-border-light dark:border-boh-border"
                >
                  <span className="font-medium text-boh-primary dark:text-boh-primary">
                    {release.version_label}
                  </span>
                  {release.release_date && (
                    <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                      {new Date(release.release_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InitiativeDetailPanel;

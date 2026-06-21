import React from 'react';
import { ReleaseVersionUsageRow } from './types';
import {
  formatVersionNumberForUi,
  formatReleaseDateForUi,
  isInProgressStatus,
  isReleasedStatus,
} from './utils';

interface ReleaseListProps {
  releases: ReleaseVersionUsageRow[];
  selectedReleaseId: string;
  onSelectRelease: (id: string) => void;
  isLoading: boolean;
  getInitiativeCount: (releaseId: string) => number;
  getChildReleaseCount: (releaseId: string) => number;
  emptyMessage?: string;
}

export const ReleaseList: React.FC<ReleaseListProps> = ({
  releases,
  selectedReleaseId,
  onSelectRelease,
  isLoading,
  getInitiativeCount,
  getChildReleaseCount,
  emptyMessage = 'No releases match the current filters.',
}) => {
  const getOperationalLabel = (release: ReleaseVersionUsageRow) => {
    if (release.release_tier === 'major') {
      return (release.active_task_count || 0) > 0
        ? 'Has tasks'
        : 'No active tasks';
    }

    return (release.active_ticket_count || 0) > 0 ? 'Has tickets' : 'No active tickets';
  };

  return (
    <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl h-full flex flex-col">
      <div className="p-4 border-b border-boh-border-light dark:border-boh-border flex-shrink-0">
        <h2 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Releases</h2>
      </div>
      <div className="p-4 overflow-y-auto flex-1 scrollbar-hide">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading releases...</div>
          </div>
        ) : releases.length > 0 ? (
          <div className="space-y-2">
            {releases.map((release) => (
              <button
                key={release.id}
                onClick={() => onSelectRelease(release.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  release.id === selectedReleaseId
                    ? 'border-primary bg-purple-50 shadow-sm dark:bg-boh-surface'
                    : 'border-boh-border-light dark:border-boh-border hover:bg-boh-bg-light dark:hover:bg-boh-bg'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-boh-text-light dark:text-boh-text truncate">
                      {release.version_label || 'Unnamed Release'}
                    </div>
                    <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                      {formatVersionNumberForUi(release.version_number)}
                    </div>
                    <div className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                      Release candidate: {formatReleaseDateForUi(release.release_candidate_date || release.release_date)}
                    </div>
                    <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                      Rollout: {formatReleaseDateForUi(release.rollout_date)}
                    </div>
                    {release.release_tier === 'major' && (
                      <div className="mt-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        {getChildReleaseCount(release.id)} linked minors
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`inline-flex min-w-[88px] items-center justify-center whitespace-nowrap rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium ${
                        isInProgressStatus(release.status)
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                          : isReleasedStatus(release.status)
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200'
                            : 'bg-boh-surface-light text-boh-text-light dark:bg-boh-surface dark:text-boh-text'
                      }`}
                    >
                      {release.status || 'unknown'}
                    </span>
                    {release.release_tier === 'major' ? (
                      <>
                        <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                          {release.initiative_count ?? getInitiativeCount(release.id)} initiatives
                        </span>
                        <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                          {release.active_task_count || 0} active tasks
                        </span>
                      </>
                    ) : (
                      typeof release.ticket_count === 'number' && (
                        <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                          {release.active_ticket_count || 0}/{release.ticket_count} active tickets
                        </span>
                      )
                    )}
                    <span className="text-xs font-medium text-boh-primary whitespace-nowrap">
                      {getOperationalLabel(release)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-boh-text-sub-light dark:text-boh-text-sub">{emptyMessage}</div>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { ReleaseVersionUsageRow, InitiativeRow } from './types';
import {
  formatVersionNumberForUi,
  formatReleaseDateForUi,
  isInProgressStatus,
  isReleasedStatus,
} from './utils';

interface MajorReleaseThirdColumnProps {
  selectedRelease: ReleaseVersionUsageRow | null;
  childReleases: ReleaseVersionUsageRow[];
  initiatives: InitiativeRow[];
  isLoadingInitiatives: boolean;
}

export const MajorReleaseThirdColumn: React.FC<MajorReleaseThirdColumnProps> = ({
  selectedRelease,
  childReleases,
  initiatives,
  isLoadingInitiatives,
}) => {
  if (!selectedRelease) {
    return (
      <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl h-full flex items-center justify-center">
        <div className="text-center text-boh-text-sub-light dark:text-boh-text-sub">
          <p className="text-sm">Select a major release to view initiatives</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl flex-shrink-0 max-h-[38%] flex flex-col">
        <div className="p-4 border-b border-boh-border-light dark:border-boh-border flex-shrink-0">
          <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
            Linked Minor Releases ({childReleases.length})
          </h3>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            Minor releases associated with this major release
          </p>
        </div>
        <div className="p-4 overflow-y-auto flex-1 scrollbar-hide">
          {childReleases.length > 0 ? (
            <div className="space-y-3">
              {childReleases.map((child) => (
                <div
                  key={child.id}
                  className="border border-boh-border-light dark:border-boh-border rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-boh-text-light dark:text-boh-text">
                        {child.version_label || 'Unnamed Release'}
                      </div>
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                        {formatVersionNumberForUi(child.version_number)}
                      </div>
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        Release candidate: {formatReleaseDateForUi(child.release_candidate_date || child.release_date)}
                      </div>
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        Rollout: {formatReleaseDateForUi(child.rollout_date)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex min-w-[88px] items-center justify-center whitespace-nowrap rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium ${
                          isInProgressStatus(child.status)
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                            : isReleasedStatus(child.status)
                              ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200'
                              : 'bg-boh-surface-light text-boh-text-light dark:bg-boh-surface dark:text-boh-text'
                        }`}
                      >
                        {child.status || 'unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-boh-text-sub-light dark:text-boh-text-sub">
                No minor releases linked to this major release yet
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-boh-border-light dark:border-boh-border flex-shrink-0">
          <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">
            Assigned Initiatives ({initiatives.length})
          </h3>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            Initiatives planned for this major release
          </p>
        </div>
        <div className="p-4 overflow-y-auto flex-1 scrollbar-hide">
          {isLoadingInitiatives ? (
            <div className="text-center py-8">
              <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading initiatives...</div>
            </div>
          ) : initiatives.length > 0 ? (
            <div className="space-y-3">
              {initiatives.map((initiative) => (
                <div
                  key={initiative.id}
                  className="border border-boh-border-light dark:border-boh-border rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-boh-text-light dark:text-boh-text">
                        {initiative.title || 'Untitled Initiative'}
                      </div>
                      {initiative.app_name && (
                        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                          App: {initiative.app_name}
                        </div>
                      )}
                      {initiative.owner_name && (
                        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                          Owner: {initiative.owner_name}
                        </div>
                      )}
                      {(initiative.target_quarter || initiative.target_year) && (
                        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                          Target: {initiative.target_quarter} {initiative.target_year}
                        </div>
                      )}
                      {typeof initiative.progress === 'number' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span>Progress</span>
                            <span>{initiative.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-boh-border-light dark:bg-boh-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-boh-primary rounded-full"
                              style={{ width: `${initiative.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {initiative.status && (
                        <span className="inline-flex items-center rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text">
                          {initiative.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-boh-text-sub-light dark:text-boh-text-sub">
                No initiatives assigned to this major release
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

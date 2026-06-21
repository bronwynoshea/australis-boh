import React from 'react';
import { ReleaseVersionUsageRow, InitiativeRow, TicketRow } from './types';
import { ReleaseList } from './ReleaseList';
import { ReleaseDetail } from './ReleaseDetail';
import { MajorReleaseThirdColumn } from './MajorReleaseThirdColumn';
import { MinorReleaseThirdColumn } from './MinorReleaseThirdColumn';

interface ReleasesLayoutProps {
  // Data
  releases: ReleaseVersionUsageRow[];
  allReleases: ReleaseVersionUsageRow[];
  selectedRelease: ReleaseVersionUsageRow | null;
  childReleases: ReleaseVersionUsageRow[];
  initiatives: InitiativeRow[];
  tickets: TicketRow[];
  initiativesByReleaseId: Record<string, InitiativeRow[]>;

  // Loading states
  isLoadingReleases: boolean;
  isLoadingInitiatives: boolean;
  isLoadingTickets: boolean;

  // Actions
  onSelectRelease: (id: string) => void;
  onUpdateStatus?: (releaseId: string, newStatus: string) => void;

  // Minor release specific
  releaseSummary: string;
  isTicketReleaseReady: (ticket: TicketRow) => boolean;

  // Config
  emptyMessage?: string;
}

export const ReleasesLayout: React.FC<ReleasesLayoutProps> = ({
  releases,
  allReleases,
  selectedRelease,
  childReleases,
  initiatives,
  tickets,
  initiativesByReleaseId,
  isLoadingReleases,
  isLoadingInitiatives,
  isLoadingTickets,
  onSelectRelease,
  onUpdateStatus,
  releaseSummary,
  isTicketReleaseReady,
  emptyMessage,
}) => {
  const getInitiativeCount = (releaseId: string) => {
    return initiativesByReleaseId[releaseId]?.length || 0;
  };

  const getChildReleaseCount = (releaseId: string) => {
    return allReleases.filter((release) => release.parent_major_release_id === releaseId).length;
  };

  const selectedReleaseId = selectedRelease?.id || '';
  const parentMajorRelease = selectedRelease?.parent_major_release_id
    ? allReleases.find((release) => release.id === selectedRelease.parent_major_release_id) || null
    : null;

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[560px] overflow-hidden">
      <div className="w-[28%] min-w-[260px]">
        <ReleaseList
          releases={releases}
          selectedReleaseId={selectedReleaseId}
          onSelectRelease={onSelectRelease}
          isLoading={isLoadingReleases}
          getInitiativeCount={getInitiativeCount}
          getChildReleaseCount={getChildReleaseCount}
          emptyMessage={emptyMessage}
        />
      </div>

      <div className="w-[32%] min-w-[340px]">
        <ReleaseDetail
          release={selectedRelease}
          parentMajorRelease={parentMajorRelease}
          childReleases={childReleases}
          initiatives={initiatives}
          tickets={tickets}
          releaseSummary={releaseSummary}
          isTicketReleaseReady={isTicketReleaseReady}
          getInitiativeCount={getInitiativeCount}
          getChildReleaseCount={getChildReleaseCount}
          onUpdateStatus={onUpdateStatus}
        />
      </div>

      <div className="w-[40%] min-w-[420px]">
        {selectedRelease?.release_tier === 'major' ? (
          <MajorReleaseThirdColumn
            selectedRelease={selectedRelease}
            childReleases={childReleases}
            initiatives={initiatives}
            isLoadingInitiatives={isLoadingInitiatives}
          />
        ) : (
          <MinorReleaseThirdColumn
            selectedRelease={selectedRelease}
            tickets={tickets}
            isLoadingTickets={isLoadingTickets}
            isTicketReleaseReady={isTicketReleaseReady}
          />
        )}
      </div>
    </div>
  );
};

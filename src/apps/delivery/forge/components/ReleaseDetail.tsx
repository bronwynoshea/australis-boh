import React, { useEffect, useMemo, useState } from 'react';
import { ReleaseVersionUsageRow, ReleaseStatus, InitiativeRow, TicketRow } from './types';
import {
  formatVersionNumberForUi,
  formatReleaseDateForUi,
  formatEnvironmentLabel,
  getEnvironmentGroup,
  isInProgressStatus,
  isReleasedStatus,
} from './utils';
import MenuFilterDropdown from '../../shared/components/FilterDropdown';

interface ReleaseDetailProps {
  release: ReleaseVersionUsageRow | null;
  parentMajorRelease: ReleaseVersionUsageRow | null;
  childReleases: ReleaseVersionUsageRow[];
  initiatives: InitiativeRow[];
  tickets: TicketRow[];
  releaseSummary: string;
  isTicketReleaseReady: (ticket: TicketRow) => boolean;
  getInitiativeCount: (releaseId: string) => number;
  getChildReleaseCount: (releaseId: string) => number;
  onUpdateStatus?: (releaseId: string, newStatus: string) => void;
}

const RELEASE_STATUS_OPTIONS: ReleaseStatus[] = ['planned', 'in progress', 'released', 'deprecated'];

const getStatusChipClasses = (status: string | null | undefined) => {
  if (isInProgressStatus(status || '')) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200';
  }
  if (isReleasedStatus(status || '')) {
    return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200';
  }
  return 'bg-boh-surface-light text-boh-text-light dark:bg-boh-surface dark:text-boh-text';
};

const formatChipLabel = (value: string | null | undefined, fallback = 'Unknown') => {
  const label = value?.trim();
  if (!label) return fallback;
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const ReleaseDetail: React.FC<ReleaseDetailProps> = ({
  release,
  parentMajorRelease,
  childReleases,
  initiatives,
  tickets,
  releaseSummary,
  isTicketReleaseReady,
  getInitiativeCount,
  getChildReleaseCount,
  onUpdateStatus,
}) => {
  const [isCopyingHandoff, setIsCopyingHandoff] = useState(false);
  const [handoffCopied, setHandoffCopied] = useState(false);
  const [quickNotesCopyState, setQuickNotesCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [quickNotesCopyError, setQuickNotesCopyError] = useState('');

  const sortedTickets = useMemo(() => [...tickets].sort((a, b) => {
    const aWeight = Number.isFinite(a.priority?.weight as number)
      ? (a.priority?.weight as number)
      : Number.MAX_SAFE_INTEGER;
    const bWeight = Number.isFinite(b.priority?.weight as number)
      ? (b.priority?.weight as number)
      : Number.MAX_SAFE_INTEGER;
    return aWeight - bWeight;
  }), [tickets]);

  useEffect(() => {
    setQuickNotesCopyState('idle');
    setQuickNotesCopyError('');
  }, [release?.id, releaseSummary]);

  if (!release) {
    return (
      <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-6 h-full flex items-center justify-center">
        <div className="text-center text-boh-text-sub-light dark:text-boh-text-sub">
          <p className="text-sm">Select a release to view command summary</p>
        </div>
      </div>
    );
  }

  const envGroup = getEnvironmentGroup(release.environment);
  const envLabel = formatEnvironmentLabel(release.environment);
  const envChipClasses =
    envGroup === 'external'
      ? 'bg-sky-100 text-sky-800 dark:bg-sky-800 dark:text-sky-200'
      : envGroup === 'internal'
        ? 'bg-violet-100 text-violet-800 dark:bg-violet-800 dark:text-violet-100'
        : 'bg-boh-surface-light text-boh-text-light dark:bg-boh-surface dark:text-boh-text';

  const statusOptions = RELEASE_STATUS_OPTIONS.map((status) => ({
    label: status.charAt(0).toUpperCase() + status.slice(1),
    value: status,
  }));

  const currentStatusLabel = release.status
    ? release.status.charAt(0).toUpperCase() + release.status.slice(1)
    : 'Unknown';
  const initiativeCount = release.initiative_count ?? getInitiativeCount(release.id);
  const childReleaseCount = getChildReleaseCount(release.id);
  const readyTickets = sortedTickets.filter(isTicketReleaseReady);
  const openTickets = sortedTickets.filter((ticket) => !isTicketReleaseReady(ticket));
  const activeTicketCount = release.active_ticket_count ?? openTickets.length;
  const ticketCount = release.ticket_count ?? tickets.length;
  const activeTaskCount = release.active_task_count || 0;
  const releaseName = release.version_label?.trim() || 'Selected release';
  const releaseVersion = release.version_number?.trim() || 'version TBD';
  const releaseCandidateDate = release.release_candidate_date || release.release_date;
  const isMajor = release.release_tier === 'major';
  const isReleased = isReleasedStatus(release.status);
  const operationalLabel = isReleased
    ? 'Released'
    : isMajor
    ? activeTaskCount > 0
      ? 'Has tasks'
      : 'No active tasks'
    : activeTicketCount > 0
      ? 'Has tickets'
      : 'No active tickets';

  const readinessChecks = isMajor
    ? [
        {
          label: 'Initiatives assigned',
          detail: isReleased
            ? 'Release completed'
            : initiativeCount > 0 ? `${initiativeCount} initiative${initiativeCount === 1 ? '' : 's'} attached` : 'No initiatives attached yet',
          isReady: isReleased || initiativeCount > 0,
        },
        {
          label: 'Agent tasks visible',
          detail: isReleased
            ? 'Release completed'
            : activeTaskCount > 0 ? `${activeTaskCount} active task${activeTaskCount === 1 ? '' : 's'}` : 'Waiting for initiative task/action-step scope',
          isReady: isReleased || activeTaskCount > 0,
        },
        {
          label: 'Minor releases linked',
          detail: isReleased
            ? 'Release completed'
            : childReleaseCount > 0 ? `${childReleaseCount} minor release${childReleaseCount === 1 ? '' : 's'} linked` : 'No linked minor releases yet',
          isReady: isReleased || childReleaseCount > 0,
        },
        {
          label: 'Central Command gate',
          detail: isReleased ? 'Release completed' : 'Human approval required before production promotion',
          isReady: isReleased,
        },
      ]
    : [
        {
          label: 'Parent major release',
          detail: isReleased ? 'Release completed' : parentMajorRelease?.version_label || 'Missing parent major release',
          isReady: isReleased || Boolean(parentMajorRelease),
        },
        {
          label: 'Counter tickets linked',
          detail: isReleased
            ? 'Release completed'
            : ticketCount > 0 ? `${ticketCount} ticket${ticketCount === 1 ? '' : 's'} attached` : 'No Counter tickets linked yet',
          isReady: isReleased || ticketCount > 0,
        },
        {
          label: 'Ticket fixes ready',
          detail: isReleased
            ? 'Release completed'
            : ticketCount > 0 ? `${readyTickets.length} completed, ${openTickets.length} open` : 'Waiting for ticket scope',
          isReady: isReleased || (ticketCount > 0 && openTickets.length === 0),
        },
        {
          label: 'Central Command gate',
          detail: isReleased ? 'Release completed' : 'Human approval required before production merge, SQL, deploy, or smoke test',
          isReady: isReleased,
        },
      ];

  const ticketLines = sortedTickets.length > 0
    ? sortedTickets.map((ticket) => {
        const identifier = ticket.ticket_number?.trim() || ticket.id.slice(0, 8).toUpperCase();
        const status = ticket.status?.label || ticket.status?.key || 'Status unknown';
        const priority = ticket.priority?.label || 'Priority unknown';
        return `- ${identifier}: ${ticket.subject || 'No subject'} [${status}, ${priority}]`;
      })
    : ['- No Counter tickets are linked yet. Link ticket scope before implementation.'];

  const initiativeLines = initiatives.length > 0
    ? initiatives.map((initiative) => {
        const owner = initiative.owner_name ? `, owner: ${initiative.owner_name}` : '';
        const app = initiative.app_name ? `, app: ${initiative.app_name}` : '';
        const status = initiative.status || 'Status unknown';
        return `- ${initiative.title || 'Untitled Initiative'} [${status}${app}${owner}]`;
      })
    : ['- No initiatives are linked yet. Link initiative scope before implementation.'];

  const agentHandoffText = [
    'Project: Australis BOH',
    'Repo: bronwynoshea/australis-boh',
    'Source branch: origin/staging',
    'Work branch: hermes-staging or a scoped feature branch from staging',
    `Release: ${releaseName} (${releaseVersion})`,
    `Release type: ${envLabel} ${release.release_tier}`,
    `Sprint starts: ${formatReleaseDateForUi(release.sprint_start_date)}`,
    `Sprint ends: ${formatReleaseDateForUi(release.sprint_end_date)}`,
    `Agent + human testing: ${formatReleaseDateForUi(release.testing_start_date)}`,
    `Release candidate: ${formatReleaseDateForUi(releaseCandidateDate)}`,
    `Rollout: ${formatReleaseDateForUi(release.rollout_date)}`,
    '',
    'Rules:',
    '- Do not touch production.',
    '- Do not print secrets.',
    '- Do not commit .env.',
    '- Keep BOH and external app backend changes separate.',
    '- Resolve auth users through public.boh_user.id for BOH app data.',
    '',
    isMajor ? 'Initiative work items:' : 'Counter tickets / work items:',
    ...(isMajor ? initiativeLines : ticketLines),
    '',
    'Expected flow:',
    '1. Work from staging into a scoped development branch.',
    '2. Run local or BOH dev verification and record exact checks.',
    '3. Update Documentation/Backend Change Ledger.md before handoff.',
    '4. Prepare Central Command release readiness notes, with production untouched unless a human explicitly approves promotion.',
  ].join('\n');

  const handleStatusChange = (newStatus: string) => {
    if (onUpdateStatus) {
      onUpdateStatus(release.id, newStatus);
    }
  };

  const handleCopyAgentHandoff = async () => {
    setIsCopyingHandoff(true);
    setHandoffCopied(false);
    try {
      await navigator.clipboard.writeText(agentHandoffText);
      setHandoffCopied(true);
    } catch (error) {
      console.error('[ReleaseDetail] Failed to copy agent handoff', error);
    } finally {
      setIsCopyingHandoff(false);
    }
  };

  const handleCopyQuickNotes = async () => {
    if (!releaseSummary.trim()) return;
    setQuickNotesCopyState('idle');
    setQuickNotesCopyError('');
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API is unavailable in this browser context.');
      }
      await navigator.clipboard.writeText(releaseSummary);
      setQuickNotesCopyState('copied');
    } catch (error) {
      console.error('[ReleaseDetail] Failed to copy quick release notes', error);
      const message = error instanceof Error
        ? `${error.name}: ${error.message}`
        : 'Unknown clipboard error.';
      setQuickNotesCopyError(message);
      setQuickNotesCopyState('failed');
    }
  };

  return (
    <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-boh-border-light dark:border-boh-border flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-boh-text-sub-light dark:text-boh-text-sub">Release Command</p>
            <h2 className="mt-1 truncate text-xl font-semibold text-boh-text-light dark:text-boh-text">
              {releaseName}
            </h2>
            <div className="mt-2 flex items-center gap-2 whitespace-nowrap">
              <span className={`inline-flex min-w-[72px] items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium leading-none ${envChipClasses}`}>
                {envLabel}
              </span>
              <span
                className={`inline-flex min-w-[64px] items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium leading-none ${
                  isMajor
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200'
                    : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200'
                }`}
              >
                {formatChipLabel(release.release_tier, 'Tier')}
              </span>
              <span className={`inline-flex min-w-[88px] items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium leading-none ${getStatusChipClasses(release.status)}`}>
                {formatChipLabel(release.status)}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              {formatVersionNumberForUi(release.version_number)}
            </div>
            <div className="mt-1 text-xs uppercase text-boh-text-sub-light dark:text-boh-text-sub">
              Release candidate
            </div>
            <div className="text-sm font-medium text-boh-text-light dark:text-boh-text">
              {formatReleaseDateForUi(releaseCandidateDate)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-3">
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
              {isMajor ? 'Initiatives' : 'Tickets'}
            </div>
            <div className="mt-1 text-2xl font-semibold text-boh-text-light dark:text-boh-text">
              {isMajor ? initiativeCount : ticketCount}
            </div>
          </div>
          <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-3">
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
              {isMajor ? 'Active tasks' : 'Open tickets'}
            </div>
            <div className="mt-1 text-2xl font-semibold text-boh-text-light dark:text-boh-text">
              {isMajor ? activeTaskCount : openTickets.length}
            </div>
          </div>
          <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-3">
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
              {isMajor ? 'Minor releases' : 'Completed tickets'}
            </div>
            <div className="mt-1 text-2xl font-semibold text-boh-text-light dark:text-boh-text">
              {isMajor ? childReleaseCount : readyTickets.length}
            </div>
          </div>
          <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-3">
            <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Queue</div>
            <div className="mt-2 text-sm font-semibold text-boh-primary">{operationalLabel}</div>
          </div>
        </div>

        <div className="rounded-lg border border-boh-border-light dark:border-boh-border p-3">
          <h3 className="mb-3 text-sm font-semibold text-boh-text-light dark:text-boh-text">Release schedule</h3>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {[
              { label: 'Sprint starts', value: release.sprint_start_date },
              { label: 'Sprint ends', value: release.sprint_end_date },
              { label: 'Agent + human testing', value: release.testing_start_date },
              { label: 'Release candidate', value: releaseCandidateDate },
              { label: 'Rollout', value: release.rollout_date },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3">
                <span className="text-boh-text-sub-light dark:text-boh-text-sub">{item.label}</span>
                <span className="text-right font-medium text-boh-text-light dark:text-boh-text">
                  {formatReleaseDateForUi(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-boh-border-light dark:border-boh-border p-3">
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Status</span>
              {onUpdateStatus ? (
                <MenuFilterDropdown
                  label="Status"
                  displayValue={currentStatusLabel}
                  options={statusOptions}
                  onSelect={handleStatusChange}
                  placeholder="Select status"
                />
              ) : (
                <span className="font-medium text-boh-text-light dark:text-boh-text">
                  {release.status || 'unknown'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-boh-text-sub-light dark:text-boh-text-sub">
                {isMajor ? 'Child releases' : 'Parent major'}
              </span>
              <span className="text-right font-medium text-boh-text-light dark:text-boh-text">
                {isMajor ? `${childReleases.length} linked` : parentMajorRelease?.version_label || 'Missing'}
              </span>
            </div>
          </div>
        </div>

        {release.notes && (
          <div className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-3">
            <h4 className="text-sm font-medium text-boh-text-light dark:text-boh-text">Notes</h4>
            <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">{release.notes}</p>
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Readiness</h3>
          {readinessChecks.map((check) => (
            <div key={check.label} className="flex items-start gap-3 rounded-lg border border-boh-border-light dark:border-boh-border p-3">
              <span
                className={`mt-0.5 inline-flex min-w-[46px] items-center justify-center rounded-full px-2 pt-0.5 pb-1.5 text-[11px] font-semibold ${
                  check.isReady
                    ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                    : 'bg-boh-bg-light text-boh-text-sub-light dark:bg-boh-bg dark:text-boh-text-sub'
                }`}
              >
                {check.isReady ? 'OK' : 'Needs'}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-boh-text-light dark:text-boh-text">{check.label}</div>
                <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{check.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={`grid gap-3 ${isMajor ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <button
            type="button"
            onClick={handleCopyAgentHandoff}
            disabled={isCopyingHandoff}
            className="inline-flex items-center justify-center rounded-md bg-boh-primary px-3 py-2 text-sm font-medium text-white hover:bg-boh-primary/80 disabled:opacity-50"
          >
            {isCopyingHandoff ? 'Copying...' : handoffCopied ? 'Copied' : 'Copy Handoff'}
          </button>
          {!isMajor && (
            <button
              type="button"
              onClick={handleCopyQuickNotes}
              disabled={!releaseSummary}
              className="inline-flex items-center justify-center rounded-md border border-boh-border-light dark:border-boh-border px-3 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg disabled:opacity-50"
            >
              {quickNotesCopyState === 'copied' ? 'Copied' : quickNotesCopyState === 'failed' ? 'Copy Failed' : 'Copy Quick Notes'}
            </button>
          )}
        </div>

        {!isMajor && quickNotesCopyError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100">
            Clipboard write failed: {quickNotesCopyError}
          </div>
        )}

        {!isMajor && (
          <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-3 font-mono text-xs text-boh-text-light dark:text-boh-text scrollbar-hide">
            {releaseSummary || 'Assign tickets to this minor release to generate quick release notes.'}
          </pre>
        )}
      </div>
    </div>
  );
};

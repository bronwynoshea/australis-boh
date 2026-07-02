import React, { useState, useEffect, useMemo } from 'react';

import { useSearchParams } from 'react-router-dom';

import type { Ticket, TicketFilterState, Agent, AppKey, ReleaseVersion, CounterAppOption } from '../types';

import { TicketSeverity } from '../types';
import { APP_OPTIONS, CAREER_MODULE_LABELS } from '../constants';
import BohSelect from '../../../../components/boh/BohSelect';
import BohSlideOver from '../../../../components/boh/BohSlideOver';

import { SearchIcon } from '../components/Icons';
import { StatusBadge, PriorityBadge, AssigneeBadge, AppBadge } from '../components/Badges';
import TicketDetailPage from './TicketDetailPage';

import FiltersPanel from '../components/FiltersPanel';
import { assignTicketsToRelease, assignTicketsToUser, fetchTicketsForView, fetchTicketLookups, fetchReleaseVersions } from '../api/counterTicketsApi';

interface AllTicketsPageProps {
  agents: Agent[];
  onTicketSelect: (ticket: Ticket) => void;
  onUpdateTicket: (updatedTicket: Ticket) => void;
}

const PAGE_SIZE = 10;

const deepCloneFilters = (filters: TicketFilterState): TicketFilterState => ({
  statuses: new Set(filters.statuses),
  severities: new Set(filters.severities),
  priorities: new Set(filters.priorities),
  apps: new Set(filters.apps),
  assignees: new Set(filters.assignees),
  releases: new Set(filters.releases),
  appAreas: new Set(filters.appAreas),
});

const createEmptyFilters = (): TicketFilterState => ({
  statuses: new Set<string>(),
  severities: new Set<TicketSeverity>(),
  priorities: new Set<string>(),
  apps: new Set<AppKey>(),
  assignees: new Set<string>(),
  releases: new Set<string>(),
  appAreas: new Set<string>(),
});

const buildSearchParamsFromFilters = (filters: TicketFilterState): URLSearchParams => {
  const params = new URLSearchParams();
  filters.statuses.forEach((v) => params.append('status', v));
  filters.severities.forEach((v) => params.append('severity', v));
  filters.priorities.forEach((v) => params.append('priority', v));
  filters.apps.forEach((v) => params.append('app', v));
  filters.assignees.forEach((v) => params.append('assignee', v));
  filters.releases.forEach((v) => params.append('release', v));
  filters.appAreas.forEach((v) => params.append('appArea', v));
  return params;
};

const parseFiltersFromSearchParams = (params: URLSearchParams): TicketFilterState => {
  const filters = createEmptyFilters();

  // Status/priority values are ids (UUIDs). We accept any non-empty string here.
  const validSeverities = new Set<string>(Object.values(TicketSeverity));
  params.getAll('status').forEach((value) => {
    if (typeof value === 'string' && value.length > 0) {
      filters.statuses.add(value);
    }
  });

  params.getAll('severity').forEach((value) => {
    if (validSeverities.has(value)) {
      filters.severities.add(value as TicketSeverity);
    }
  });

  params.getAll('priority').forEach((value) => {
    if (typeof value === 'string' && value.length > 0) {
      filters.priorities.add(value);
    }
  });

  params.getAll('app').forEach((value) => {
    if (typeof value === 'string' && value.length > 0) {
      filters.apps.add(value as AppKey);
    }
  });

  params.getAll('assignee').forEach((value) => {
    if (typeof value === 'string' && value.length > 0) {
      filters.assignees.add(value);
    }
  });

  params.getAll('release').forEach((value) => {
    if (typeof value === 'string' && value.length > 0) {
      filters.releases.add(value);
    }
  });

  params.getAll('appArea').forEach((value) => {
    if (typeof value === 'string' && value.length > 0) {
      filters.appAreas.add(value);
    }
  });

  return filters;
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
};

const getAppDisplay = (ticket: Ticket): string => {
  const appLabel = APP_OPTIONS.find(a => a.key === ticket.app)?.label || ticket.app;
  if (ticket.app === 'career_studio' && ticket.careerModule && ticket.careerModule !== 'none') {
    const moduleLabel = CAREER_MODULE_LABELS[ticket.careerModule];
    return `${appLabel} (${moduleLabel})`;
  }
  return appLabel;
};

type SortColumn = 'ticketNumber' | 'priority' | 'lastUpdated' | 'app' | 'status';
type SortDirection = 'asc' | 'desc';
type BulkOperation = 'release' | 'reassign' | 'archive';
type ReleaseScope = 'window' | 'future' | 'past';

const formatReleaseLabel = (version: ReleaseVersion): string => {
  const year = typeof version.release_year === 'number' ? String(version.release_year) : '';
  const cycle = typeof version.release_cycle === 'string' ? version.release_cycle : '';
  const number = typeof version.version_number === 'string' && version.version_number.trim()
    ? `v${version.version_number.trim().replace(/^v\s*/i, '')}`
    : '';
  const env = version.environment ? `[${version.environment}]` : '';
  return [env, year, cycle, number, version.version_label].filter(Boolean).join(' - ');
};

const formatReleaseDate = (value?: string | null): string => {
  if (!value) return 'No release date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const getReleaseTime = (version: ReleaseVersion): number => {
  const source = version.sort_date || version.release_date || version.created_at || '';
  const time = new Date(source).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const isClosedRelease = (version: ReleaseVersion): boolean => {
  const status = (version.status || '').toLowerCase();
  return ['closed', 'complete', 'completed', 'retired', 'archived'].includes(status);
};

const AllTicketsPage: React.FC<AllTicketsPageProps> = ({ agents, onUpdateTicket }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusOptions, setStatusOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [priorityOptions, setPriorityOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [releaseOptions, setReleaseOptions] = useState<ReleaseVersion[]>([]);
  const [appLookupOptions, setAppLookupOptions] = useState<CounterAppOption[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [bulkReleaseId, setBulkReleaseId] = useState('');
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  const [bulkOperation, setBulkOperation] = useState<BulkOperation>('release');
  const [releaseScope, setReleaseScope] = useState<ReleaseScope>('window');
  const [archiveConfirmText, setArchiveConfirmText] = useState('');
  const [isAssigningRelease, setIsAssigningRelease] = useState(false);
  const [isReassigningTickets, setIsReassigningTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    const loadTickets = async () => {
      try {
        setIsLoading(true);
        const { tickets: allTickets } = await fetchTicketsForView('all');
        setTickets(allTickets);
      } catch (error) {
        console.error('Error loading all tickets:', error);
        setTickets([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadTickets();
  }, []);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [lookups, releases] = await Promise.all([
          fetchTicketLookups(),
          fetchReleaseVersions(),
        ]);
        setStatusOptions(lookups.statuses.map((s) => ({ value: s.id, label: s.label })));
        setPriorityOptions(lookups.priorities.map((p) => ({ value: p.id, label: p.label })));
        setAppLookupOptions(lookups.apps);
        setReleaseOptions(releases);
      } catch (error) {
        console.error('Error loading ticket lookups:', error);
        setStatusOptions([]);
        setPriorityOptions([]);
        setAppLookupOptions([]);
        setReleaseOptions([]);
      }
    };
    loadLookups();
  }, []);

  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };

  const handleSelectedTicketUpdate = (updatedTicket: Ticket) => {
    setTickets((currentTickets) =>
      currentTickets.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket))
    );
    setSelectedTicket(updatedTicket);
    onUpdateTicket(updatedTicket);
  };

  const [metricView] = useState<'severity' | 'priority'>('priority');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: 'lastUpdated',
    direction: 'desc',
  });

  // The active filters applied to the list
  const [activeFilters, setActiveFilters] = useState<TicketFilterState>({
    statuses: new Set(),
    severities: new Set(),
    priorities: new Set(),
    apps: new Set(),
    assignees: new Set(),
    releases: new Set(),
    appAreas: new Set(),
  });

  // A temporary state for the filter panel, applied only on "Apply"
  const [tempFilters, setTempFilters] = useState<TicketFilterState>(activeFilters);

  useEffect(() => {
    const parsed = parseFiltersFromSearchParams(searchParams);
    setActiveFilters(parsed);
    setTempFilters(parsed);
  }, [searchParams, setTempFilters]);

  // Client-side filtering (can be moved to API params later)
  const filteredTickets = useMemo(() => {
    const safeTickets = Array.isArray(tickets) ? tickets : [];
    const applyFilters = safeTickets.filter(ticket => {
      const { statuses, severities, priorities, apps, assignees, releases, appAreas } = activeFilters;
      const statusKey = (ticket.statusKey || '').toLowerCase();
      const statusMatch = statuses.size === 0
        ? statusKey !== 'closed'
        : statuses.has(ticket.statusId);
      const severityMatch = severities.size === 0 || severities.has(ticket.severity);
      const priorityMatch = priorities.size === 0 || priorities.has(ticket.priorityId);

      const assigneeMatch = assignees.size === 0 || assignees.has(ticket.assignee);
      const appMatch = apps.size === 0 || apps.has(ticket.app_id || '') || apps.has(ticket.app);
      const appAreaMatch = appAreas.size === 0 || appAreas.has(ticket.app_area_id || '');
      const releaseMatch = releases.size === 0
        || (releases.has('none') && !ticket.release_version_id)
        || (ticket.release_version_id ? releases.has(ticket.release_version_id) : false);
      return statusMatch && severityMatch && appMatch && appAreaMatch && priorityMatch && assigneeMatch && releaseMatch;
    });

    const compareTickets = (a: Ticket, b: Ticket) => {
      const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;
      switch (sortConfig.column) {
        case 'ticketNumber': {
          const parseNumber = (ticketNumber?: string) => {
            if (!ticketNumber) return 0;
            const match = /(\d+)$/.exec(ticketNumber);
            return match ? Number(match[1]) : 0;
          };
          const diff = parseNumber(a.ticketNumber) - parseNumber(b.ticketNumber);
          if (diff !== 0) return diff * directionMultiplier;
          return (a.ticketNumber || '').localeCompare(b.ticketNumber || '') * directionMultiplier;
        }
        case 'priority': {
          const weightA = a.priorityWeight ?? -1;
          const weightB = b.priorityWeight ?? -1;
          if (weightA !== weightB) return (weightA - weightB) * directionMultiplier;
          return (a.priorityLabel || '').localeCompare(b.priorityLabel || '') * directionMultiplier;
        }
        case 'status': {
          return (a.statusLabel || '').localeCompare(b.statusLabel || '') * directionMultiplier;
        }
        case 'app': {
          return getAppDisplay(a).localeCompare(getAppDisplay(b)) * directionMultiplier;
        }
        case 'lastUpdated':
        default: {
          const diff = a.lastUpdatedAt.getTime() - b.lastUpdatedAt.getTime();
          if (diff !== 0) return diff * directionMultiplier;
          return (a.ticketNumber || '').localeCompare(b.ticketNumber || '') * directionMultiplier;
        }
      }
    };

    return [...applyFilters].sort(compareTickets);
  }, [tickets, activeFilters, metricView, sortConfig]);

  const releaseSelectOptions = useMemo(() => [
    { value: '', label: 'Select minor release' },
    ...releaseOptions.map((version) => {
      const year = typeof version.release_year === 'number' ? String(version.release_year) : '';
      const cycle = typeof version.release_cycle === 'string' ? version.release_cycle : '';
      const number = typeof version.version_number === 'string' && version.version_number.trim()
        ? `v${version.version_number.trim().replace(/^v\s*/i, '')}`
        : '';
      const env = version.environment ? `[${version.environment}]` : '';
      const label = [env, year, cycle, number, version.version_label].filter(Boolean).join(' · ');
      return { value: version.id, label };
    }),
  ], [releaseOptions]);

  const selectedTickets = useMemo(
    () => tickets.filter((ticket) => selectedTicketIds.has(ticket.id)),
    [selectedTicketIds, tickets],
  );

  const releaseTicketCounts = useMemo(() => {
    const counts = new Map<string, number>();
    tickets.forEach((ticket) => {
      if (!ticket.release_version_id) return;
      counts.set(ticket.release_version_id, (counts.get(ticket.release_version_id) || 0) + 1);
    });
    return counts;
  }, [tickets]);

  const releaseRows = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const sortedAscending = [...releaseOptions].sort((a, b) => getReleaseTime(a) - getReleaseTime(b));
    const firstCurrentOrFutureIndex = sortedAscending.findIndex((version) => {
      const releaseTime = getReleaseTime(version);
      return releaseTime >= todayTime && !isClosedRelease(version);
    });
    let latestOpenIndex = 0;
    sortedAscending.forEach((version, index) => {
      if (!isClosedRelease(version)) {
        latestOpenIndex = index;
      }
    });
    const currentIndex = firstCurrentOrFutureIndex >= 0 ? firstCurrentOrFutureIndex : latestOpenIndex;

    const visibleReleases = releaseScope === 'future'
      ? sortedAscending.filter((version) => getReleaseTime(version) >= todayTime && !isClosedRelease(version))
      : releaseScope === 'past'
        ? sortedAscending.filter((version) => getReleaseTime(version) < todayTime || isClosedRelease(version))
        : sortedAscending.slice(currentIndex, currentIndex + 3).filter((version) => !isClosedRelease(version));

    return [...visibleReleases]
      .sort((a, b) => getReleaseTime(b) - getReleaseTime(a))
      .map((version) => ({
        version,
        label: formatReleaseLabel(version),
        ticketCount: releaseTicketCounts.get(version.id) || 0,
        isPast: Boolean(version.release_date && new Date(version.release_date).getTime() < todayTime),
        isClosed: isClosedRelease(version),
      }));
  }, [releaseOptions, releaseTicketCounts, releaseScope]);

  const visibleTicketIds = useMemo(() => filteredTickets.map((ticket) => ticket.id), [filteredTickets]);
  const selectedVisibleCount = useMemo(
    () => visibleTicketIds.filter((id) => selectedTicketIds.has(id)).length,
    [selectedTicketIds, visibleTicketIds],
  );
  const isAllVisibleSelected = visibleTicketIds.length > 0 && selectedVisibleCount === visibleTicketIds.length;

  const toggleSort = (column: SortColumn) => {
    setSortConfig((prev) => {
      if (prev.column === column) {
        const nextDirection = prev.direction === 'asc' ? 'desc' : 'asc';
        return { column, direction: nextDirection };
      }
      return {
        column,
        direction: column === 'lastUpdated' ? 'desc' : 'asc',
      };
    });
  };

  const renderSortIndicator = (column: SortColumn) => (
    <span className="ml-1 inline-flex flex-col text-[10px] leading-none text-boh-text-sub">
      <span
        className={`-translate-y-[1px] ${sortConfig.column === column && sortConfig.direction === 'asc' ? 'text-boh-text-light dark:text-boh-text' : ''}`}
      >
        ▲
      </span>
      <span
        className={`translate-y-[1px] ${sortConfig.column === column && sortConfig.direction === 'desc' ? 'text-boh-text-light dark:text-boh-text' : ''}`}
      >
        ▼
      </span>
    </span>
  );

  const renderSortHeaderButton = (column: SortColumn, label: string) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left uppercase tracking-wider"
      onClick={() => toggleSort(column)}
    >
      <span>{label}</span>
      {renderSortIndicator(column)}
    </button>
  );

  const handleTakeTicket = async (ticketId: string) => {
    const ticketToUpdate = tickets.find(t => t.id === ticketId);
    if (ticketToUpdate) {
      // TODO: This will later trigger a Supabase update via API.
      const updatedTicket = {
        ...ticketToUpdate,
        assignee: 'You',
        lastUpdatedAt: new Date(), // Also update timestamp
      };
      onUpdateTicket(updatedTicket);
      // Refresh tickets after update
      try {
        const { tickets: allTickets } = await fetchTicketsForView('all');
        setTickets(allTickets);
      } catch (error) {
        console.error('Error refreshing tickets:', error);
      }
    }
  };

  const handleCloseFilters = () => {
    setIsFiltersOpen(false);
  };

  const handleFilterChange = (
    category: keyof TicketFilterState,
    value: TicketSeverity | AppKey | string,
  ) => {
    setTempFilters((prev) => {
      const newFilters = deepCloneFilters(prev);
      const set = newFilters[category] as Set<typeof value>;
      if (set.has(value)) {
        set.delete(value);
      } else {
        set.add(value);
      }
      return newFilters;
    });
  };

  const handleApplyFilters = () => {
    setActiveFilters(tempFilters);
    setSearchParams(buildSearchParamsFromFilters(tempFilters), { replace: true });
    handleCloseFilters();
  };

  const handleResetFilters = () => {
    const freshFilters: TicketFilterState = createEmptyFilters();
    setTempFilters(freshFilters);
    setActiveFilters(freshFilters);
    setSearchParams(new URLSearchParams(), { replace: true });
    handleCloseFilters();
  };

  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  };

  const toggleSelectVisible = () => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (isAllVisibleSelected) {
        visibleTicketIds.forEach((id) => next.delete(id));
      } else {
        visibleTicketIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedTicketIds(new Set());
    setBulkReleaseId('');
    setBulkAssigneeId('');
  };

  const openBulkOperation = (operation: BulkOperation) => {
    setBulkOperation(operation);
    setIsBulkActionsOpen(true);
  };

  const handleAssignSelectedToRelease = async () => {
    const ids: string[] = Array.from(selectedTicketIds.values());
    if (ids.length === 0 || !bulkReleaseId) return;

    setIsAssigningRelease(true);
    try {
      await assignTicketsToRelease(ids, bulkReleaseId);
      const { tickets: refreshedTickets } = await fetchTicketsForView('all');
      setTickets(refreshedTickets);
      refreshedTickets
        .filter((ticket) => selectedTicketIds.has(ticket.id))
        .forEach(onUpdateTicket);
      setIsBulkActionsOpen(false);
      clearSelection();
    } catch (error) {
      console.error('Error assigning selected tickets to release:', error);
    } finally {
      setIsAssigningRelease(false);
    }
  };

  const handleReassignSelectedTickets = async () => {
    const ids: string[] = Array.from(selectedTicketIds.values());
    if (ids.length === 0 || !bulkAssigneeId) return;

    setIsReassigningTickets(true);
    try {
      await assignTicketsToUser(ids, bulkAssigneeId === 'unassigned' ? null : bulkAssigneeId);
      const { tickets: refreshedTickets } = await fetchTicketsForView('all');
      setTickets(refreshedTickets);
      refreshedTickets
        .filter((ticket) => selectedTicketIds.has(ticket.id))
        .forEach(onUpdateTicket);
      setIsBulkActionsOpen(false);
      clearSelection();
    } catch (error) {
      console.error('Error reassigning selected tickets:', error);
    } finally {
      setIsReassigningTickets(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <div className="border-b border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text">All Tickets</h1>
            <p className="mt-1 text-md text-boh-text-sub-light dark:text-boh-text-sub">Loading Counter tickets.</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading tickets...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-0 min-w-0 flex-col overflow-hidden lg:h-[calc(100vh-9.5rem)]">
      <div className="shrink-0 border-b border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border">
        <div className="px-4 sm:px-6 lg:px-8 py-4 space-y-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-boh-text-light dark:text-boh-text">All Tickets</h1>
              <p className="mt-1 text-md text-boh-text-sub-light dark:text-boh-text-sub">
                {selectedTicketIds.size > 0
                  ? `${selectedTicketIds.size} selected - assign release, reassign, or archive without deleting records.`
                  : 'Open tickets across Australis apps. Use filters to include closed tickets.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-start overflow-hidden rounded-lg border border-boh-border-light bg-boh-surface-light dark:border-boh-border dark:bg-boh-surface xl:justify-end">
              <div className="flex h-10 items-center gap-2 border-r border-boh-border-light px-3 text-sm dark:border-boh-border">
                <span className="font-semibold text-boh-text-light dark:text-boh-text">{filteredTickets.length}</span>
                <span className="text-boh-text-sub-light dark:text-boh-text-sub">showing</span>
              </div>
              <div className="flex h-10 items-center gap-2 border-r border-boh-border-light px-3 text-sm dark:border-boh-border">
                <span className="font-semibold text-boh-text-light dark:text-boh-text">{tickets.length}</span>
                <span className="text-boh-text-sub-light dark:text-boh-text-sub">total</span>
              </div>
              <button
                type="button"
                disabled={selectedTicketIds.size === 0}
                onClick={() => openBulkOperation('release')}
                className="h-10 px-4 text-sm font-semibold text-boh-text-light transition-colors hover:text-boh-primary disabled:cursor-not-allowed disabled:opacity-50 dark:text-boh-text dark:hover:text-boh-primary-tint"
              >
                <span>Actions</span>
              </button>
              {selectedTicketIds.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="h-10 border-l border-boh-border-light px-4 text-sm font-medium text-boh-text-sub-light transition-colors hover:text-boh-text-light dark:border-boh-border dark:text-boh-text-sub dark:hover:text-boh-text"
                >
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(14rem,28rem)_auto] sm:items-center">
            <div className="relative min-w-0 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-boh-text-sub" />
              </div>
              <input
                type="text"
                placeholder="Search by subject or ID"
                className="w-full rounded-lg border border-boh-border-light bg-boh-bg-light py-2 pl-10 pr-4 text-boh-text-light outline-none focus:border-boh-primary focus:ring-2 focus:ring-boh-primary/30 dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
              />
            </div>
            <button
              type="button"
              className="filter-trigger-button h-10 w-10 flex-shrink-0 justify-center px-0"
              onClick={() => setIsFiltersOpen(true)}
              aria-label="Open filters"
              title="Filters"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 11h10M11 11v7" /></svg>
            </button>
          </div>

        </div>
      </div>

      <FiltersPanel
        isOpen={isFiltersOpen}
        onClose={handleCloseFilters}
        filters={tempFilters}
        agents={agents}
        appOptions={appLookupOptions}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        releaseOptions={releaseOptions}
        onFilterChange={handleFilterChange}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        metricView={metricView}
      />

      <BohSlideOver
        isOpen={isBulkActionsOpen}
        onClose={() => setIsBulkActionsOpen(false)}
        title="Bulk ticket actions"
        description={`${selectedTicketIds.size} selected ticket${selectedTicketIds.size === 1 ? '' : 's'}`}
        widthClassName="sm:max-w-2xl"
        headerAfter={
          <div className="mt-4 flex gap-5 overflow-x-auto boh-hide-scrollbar">
            {[
              { key: 'release', label: 'Release' },
              { key: 'reassign', label: 'Reassign' },
              { key: 'archive', label: 'Archive (keep records)' },
            ].map((operation) => (
              <button
                key={operation.key}
                type="button"
                onClick={() => setBulkOperation(operation.key as BulkOperation)}
                className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${
                  bulkOperation === operation.key
                    ? 'border-boh-primary text-boh-primary dark:text-boh-primary-tint'
                    : 'border-transparent text-boh-text-sub-light hover:text-boh-text-light dark:text-boh-text-sub dark:hover:text-boh-text'
                }`}
              >
                {operation.label}
              </button>
            ))}
          </div>
        }
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsBulkActionsOpen(false)}
              className="h-10 rounded-lg border border-boh-border-light px-4 text-sm font-medium text-boh-text-light hover:bg-boh-bg-light dark:border-boh-border dark:text-boh-text dark:hover:bg-boh-bg"
            >
              Close
            </button>
            {bulkOperation === 'release' && (
              <button
                type="button"
                disabled={!bulkReleaseId || selectedTicketIds.size === 0 || isAssigningRelease}
                onClick={handleAssignSelectedToRelease}
                className="h-10 rounded-lg bg-boh-primary px-4 text-sm font-semibold text-white hover:bg-boh-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAssigningRelease ? 'Assigning...' : 'Assign to release'}
              </button>
            )}
            {bulkOperation === 'archive' && (
              <button
                type="button"
                disabled
                className="h-10 rounded-lg bg-boh-primary px-4 text-sm font-semibold text-white opacity-50"
              >
                Archive selected
              </button>
            )}
            {bulkOperation === 'reassign' && (
              <button
                type="button"
                disabled={!bulkAssigneeId || selectedTicketIds.size === 0 || isReassigningTickets}
                onClick={handleReassignSelectedTickets}
                className="h-10 rounded-lg bg-boh-primary px-4 text-sm font-semibold text-white hover:bg-boh-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isReassigningTickets ? 'Reassigning...' : 'Reassign tickets'}
              </button>
            )}
          </div>
        }
      >
        {bulkOperation === 'release' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-boh-border-light bg-boh-bg-light/45 p-3 dark:border-boh-border dark:bg-boh-bg/40">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  Start with the current release plus the next two. Switch scope when tickets need to move further forward or into an old release during cleanup.
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { key: 'window', label: 'Current window' },
                    { key: 'future', label: 'All future' },
                    { key: 'past', label: 'Past/closed' },
                  ].map((scope) => (
                    <button
                      key={scope.key}
                      type="button"
                      onClick={() => setReleaseScope(scope.key as ReleaseScope)}
                      className={`h-9 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                        releaseScope === scope.key
                          ? 'border-boh-primary bg-boh-primary/10 text-boh-primary dark:text-boh-primary-tint'
                          : 'border-boh-border-light bg-boh-surface-light text-boh-text-sub-light hover:text-boh-text-light dark:border-boh-border dark:bg-boh-surface dark:text-boh-text-sub dark:hover:text-boh-text'
                      }`}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {releaseRows.map(({ version, label, ticketCount, isPast, isClosed }) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => setBulkReleaseId(version.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    bulkReleaseId === version.id
                      ? 'border-boh-primary bg-boh-primary/10'
                      : 'border-boh-border-light bg-boh-surface-light hover:border-boh-primary/50 dark:border-boh-border dark:bg-boh-surface'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-boh-text-light dark:text-boh-text">{label}</p>
                      <p className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        {formatReleaseDate(version.release_date)}
                        {version.status ? ` - ${version.status}` : ''}
                        {isPast ? ' - past release' : ''}
                        {isClosed ? ' - closed' : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold text-boh-text-light dark:text-boh-text">{ticketCount}</p>
                      <p className="text-[11px] uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">tickets</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {bulkOperation === 'reassign' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-boh-border-light bg-boh-bg-light/45 p-4 dark:border-boh-border dark:bg-boh-bg/40">
              <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Reassign selected tickets</h3>
              <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                Move ownership for all selected tickets. Ticket records and history stay intact.
              </p>
            </div>
            <BohSelect
              value={bulkAssigneeId}
              onChange={setBulkAssigneeId}
              options={[
                { value: 'unassigned', label: 'Unassigned' },
                ...agents
                  .filter((agent) => agent.canReceiveTickets)
                  .map((agent) => ({ value: agent.bohUserId || agent.id, label: agent.name })),
              ]}
              placeholder="Choose crew member"
            />
          </div>
        )}

        {bulkOperation === 'archive' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-boh-border-light bg-boh-bg-light/45 p-4 dark:border-boh-border dark:bg-boh-bg/40">
              <h3 className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Archive needs guardrails</h3>
              <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                Tickets should be archived, not deleted. Archive will keep every ticket record, comment, release assignment, and audit trail. The live action should require permission, a reason, typed confirmation, and an audit entry before records leave working views.
              </p>
            </div>
            <div className="rounded-lg border border-boh-border-light p-3 dark:border-boh-border">
              <label className="block text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                Archive reason
              </label>
              <textarea
                className="mt-2 w-full rounded-lg border border-boh-border-light bg-boh-bg-light px-3 py-2 text-sm text-boh-text-light outline-none focus:border-boh-primary focus:ring-2 focus:ring-boh-primary/30 dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                rows={3}
                placeholder="Required before archive is enabled"
                disabled
              />
            </div>
            <div className="rounded-lg border border-boh-border-light p-3 dark:border-boh-border">
              <label className="block text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                Typed confirmation
              </label>
              <input
                type="text"
                value={archiveConfirmText}
                onChange={(event) => setArchiveConfirmText(event.target.value)}
                className="mt-2 w-full rounded-lg border border-boh-border-light bg-boh-bg-light px-3 py-2 text-sm text-boh-text-light outline-none focus:border-boh-primary focus:ring-2 focus:ring-boh-primary/30 dark:border-boh-border dark:bg-boh-bg dark:text-boh-text"
                placeholder={`Type ARCHIVE ${selectedTicketIds.size} to confirm`}
                disabled
              />
              <p className="mt-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                Disabled until the archive backend policy exists.
              </p>
            </div>
            <div className="rounded-lg border border-boh-border-light p-3 dark:border-boh-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Selected sample</p>
              <div className="mt-3 space-y-2">
                {selectedTickets.slice(0, 5).map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-boh-text-light dark:text-boh-text">{ticket.subject}</span>
                    <span className="shrink-0 font-mono text-xs text-boh-text-sub-light dark:text-boh-text-sub">{ticket.ticketNumber}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </BohSlideOver>

      <div className="min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-8">
        <div className="hidden h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-boh-border-light bg-boh-surface-light shadow-sm dark:border-boh-border dark:bg-boh-surface lg:flex">
          <div className="shrink-0 grid grid-cols-[2rem_minmax(16rem,1fr)_minmax(7rem,0.24fr)_minmax(7rem,0.24fr)_minmax(7rem,0.24fr)_5.5rem] items-center gap-3 border-b border-boh-border-light bg-boh-bg-light px-4 py-3 text-xs font-medium uppercase tracking-wider text-boh-text-sub-light dark:border-boh-border dark:bg-boh-bg dark:text-boh-text-sub">
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={isAllVisibleSelected}
                onChange={toggleSelectVisible}
                className="rounded border-boh-border-light text-boh-primary focus:ring-boh-primary"
                aria-label="Select visible tickets"
              />
            </div>
            <div>{renderSortHeaderButton('ticketNumber', 'Ticket')}</div>
            <div>{renderSortHeaderButton('app', 'App')}</div>
            <div className="flex justify-center">{renderSortHeaderButton('status', 'Status')}</div>
            <div className="text-center">Priority</div>
            <div>{renderSortHeaderButton('lastUpdated', 'Updated')}</div>
          </div>

          <div className="boh-hide-scrollbar min-h-0 flex-1 overflow-y-auto divide-y divide-boh-border-light dark:divide-boh-border">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="group grid min-w-0 cursor-pointer grid-cols-[2rem_minmax(16rem,1fr)_minmax(7rem,0.24fr)_minmax(7rem,0.24fr)_minmax(7rem,0.24fr)_5.5rem] items-center gap-3 px-4 py-3 transition-colors hover:bg-boh-bg-light/70 dark:hover:bg-boh-bg/70"
                onClick={() => handleTicketSelect(ticket)}
              >
                <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedTicketIds.has(ticket.id)}
                    onChange={() => toggleTicketSelection(ticket.id)}
                    className="rounded border-boh-border-light text-boh-primary focus:ring-boh-primary"
                    aria-label={`Select ${ticket.ticketNumber || ticket.subject}`}
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 font-mono text-xs text-boh-text-sub-light dark:text-boh-text-sub">{ticket.ticketNumber || ''}</span>
                    <p className="min-w-0 truncate text-sm font-semibold text-boh-text-light dark:text-boh-text" title={ticket.subject}>
                      {ticket.subject}
                    </p>
                  </div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                    <span className="max-w-[12rem] truncate" title={ticket.requesterEmail}>{ticket.requesterName || 'Unknown requester'}</span>
                    <span>|</span>
                    <AssigneeBadge assignee={ticket.assignee} />
                    {ticket.assignee === 'Unassigned' && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleTakeTicket(ticket.id);
                        }}
                        className="font-medium text-boh-primary hover:underline"
                      >
                        Take
                      </button>
                    )}
                    <span>|</span>
                    <span className="max-w-[15rem] truncate" title={ticket.release_version_label || 'No release'}>
                      {ticket.release_version_label || 'No release'}
                    </span>
                  </div>
                </div>

                <div className="min-w-0 truncate text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  {getAppDisplay(ticket)}
                </div>
                <div className="flex min-w-0 items-center justify-center">
                  <StatusBadge statusLabel={ticket.statusLabel} statusKey={ticket.statusKey} />
                </div>
                <div className="flex min-w-0 items-center justify-center">
                  <PriorityBadge priorityLabel={ticket.priorityLabel} priorityKey={ticket.priorityKey} priorityWeight={ticket.priorityWeight} />
                </div>
                <div className="whitespace-nowrap text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  {formatTimeAgo(ticket.lastUpdatedAt)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="boh-hide-scrollbar h-full min-h-0 overflow-y-auto lg:hidden">
          <ul className="space-y-4">
            {filteredTickets.map((ticket) => (
              <li key={ticket.id} className="bg-boh-surface-light dark:bg-boh-surface rounded-2xl shadow py-4 px-5 cursor-pointer" onClick={() => handleTicketSelect(ticket)}>
                <div className="flex flex-col space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex min-w-0 items-start gap-3 pr-4">
                      <input
                        type="checkbox"
                        checked={selectedTicketIds.has(ticket.id)}
                        onChange={(event) => {
                          event.stopPropagation();
                          toggleTicketSelection(ticket.id);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1 rounded border-boh-border-light text-boh-primary focus:ring-boh-primary"
                        aria-label={`Select ${ticket.ticketNumber || ticket.subject}`}
                      />
                      <p className="text-md font-semibold text-boh-text-light dark:text-boh-text truncate" title={ticket.subject}>{ticket.subject}</p>
                    </div>
                    <div className="flex-shrink-0"><StatusBadge statusLabel={ticket.statusLabel} statusKey={ticket.statusKey} /></div>
                  </div>

                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="text-xs font-mono text-boh-text-sub-light dark:text-boh-text-sub">{ticket.ticketNumber || ''}</span>
                    <AppBadge app={ticket.app} />
                    <PriorityBadge priorityLabel={ticket.priorityLabel} priorityKey={ticket.priorityKey} priorityWeight={ticket.priorityWeight} />
                  </div>

                  <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub">
                    <p>Requester: {ticket.requesterName}</p>
                    <p>Assigned to: {ticket.assignee}</p>
                  </div>

                  <div className="flex items-center justify-end text-sm text-boh-text-sub-light dark:text-boh-text-sub pt-2">
                    <span>{formatTimeAgo(ticket.lastUpdatedAt)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <BohSlideOver
        isOpen={Boolean(selectedTicket)}
        title={selectedTicket?.ticketNumber || 'Ticket'}
        description={selectedTicket?.subject}
        onClose={() => setSelectedTicket(null)}
        closeLabel="Close ticket"
        widthClassName="md:max-w-3xl"
        contentClassName="p-0"
      >
        {selectedTicket && (
          <TicketDetailPage
            ticket={selectedTicket}
            agents={agents}
            onBack={() => setSelectedTicket(null)}
            onUpdateTicket={handleSelectedTicketUpdate}
            variant="drawer"
          />
        )}
      </BohSlideOver>
    </div>
  );
};

export default AllTicketsPage;

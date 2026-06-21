import React, { useMemo, useState } from 'react';

import type { Ticket, CounterAppArea, CounterAppOption, CounterTicketPriority } from '../types';
import { PriorityBadge } from '../components/Badges';
import BohSlideOver from '../../../../components/boh/BohSlideOver';

interface CounterDashboardPageProps {
  tickets: Ticket[];
  appAreas: CounterAppArea[];
  counterApps: CounterAppOption[];
  priorityOptions: CounterTicketPriority[];
  onTicketSelect: (ticket: Ticket) => void;
  navigateToAllTicketsWithFilter: (filterType: string, value: any) => void;
  isLoading?: boolean;
}

interface PriorityBucket {
  key: string;
  priorityKey: string;
  label: string;
  weight: number | null;
  count: number;
}

interface ReleaseBucket {
  key: string;
  label: string;
  count: number;
  filterValue: string;
  environmentLabel?: string;
}

interface StatusBucket {
  key: string;
  label: string;
  count: number;
  statusId: string;
}

interface AppAreaBucket {
  key: string;
  label: string;
  count: number;
  tickets: Ticket[];
  filterType: 'app' | 'appArea';
  filterValue: string;
  colorKey: string;
  group: AppBucketGroup;
}

interface AppSummaryBucket {
  key: string;
  label: string;
  count: number;
  group: AppBucketGroup;
}

interface AppModuleDetail {
  appKey: string;
  appLabel: string;
  total: number;
  modules: AppAreaBucket[];
}

type AppBucketGroup = 'external' | 'hybrid' | 'internal';

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

const normalizeStatus = (ticket: Ticket) => (ticket.statusKey || ticket.statusLabel || '').trim().toLowerCase();

const isClosedTicket = (ticket: Ticket) => normalizeStatus(ticket).includes('closed');

const groupLabel: Record<AppBucketGroup, string> = {
  external: 'External',
  hybrid: 'Hybrid',
  internal: 'Internal',
};

const releaseEnvironmentLabel = (ticket: Ticket, fallbackGroup: AppBucketGroup) => {
  const environment = (ticket.release_environment || '').trim().toLowerCase();
  if (environment === 'internal') return 'Internal';
  if (environment === 'external') return 'External';
  if (fallbackGroup === 'internal') return 'Internal';
  return 'External';
};

const dashboardGroups: AppBucketGroup[] = ['external', 'hybrid', 'internal'];

const hybridAppKeys = new Set(['chatz', 'counter', 'loft', 'slotz']);

const surfaceToGroup = (surface?: string | null, appKey?: string): AppBucketGroup => {
  if (appKey && hybridAppKeys.has(getCanonicalAppKey(appKey))) return 'hybrid';
  if (surface === 'external') return 'external';
  if (surface === 'hybrid') return 'hybrid';
  return 'internal';
};

const getAppBucketGroup = (
  ticket: Ticket,
  appRegistry: Map<string, CounterAppOption>,
  area?: CounterAppArea,
): AppBucketGroup => {
  const appKey = getCanonicalAppKey(ticket.app);
  if (hybridAppKeys.has(appKey)) return 'hybrid';

  if (area?.audience === 'external') return 'external';
  if (area?.audience === 'internal') return 'internal';

  const appRecord = appRegistry.get(appKey);
  return surfaceToGroup(appRecord?.surface, appKey);
};

const getCanonicalAppKey = (appKey: string) =>
  appKey === 'career_studio' ? 'studio' : appKey;

const getAppFilterValue = (appKey: string) =>
  appKey === 'studio' ? ['studio', 'career_studio'] : appKey;

const parseTicketNumber = (ticketNumber?: string) => {
  const match = ticketNumber?.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
};

const panelClass = 'min-w-0 overflow-hidden rounded-lg border border-boh-border-light bg-boh-surface-light shadow-sm dark:border-boh-border dark:bg-boh-surface';
const panelHeaderClass = 'flex shrink-0 items-center justify-between gap-3 border-b border-boh-border-light px-4 py-3 dark:border-boh-border';
const metricCardClass = 'relative min-h-[90px] min-w-0 cursor-pointer rounded-lg border border-boh-border-light bg-boh-surface-light px-4 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-boh-border dark:bg-boh-surface';

const CounterDashboardPage: React.FC<CounterDashboardPageProps> = ({ tickets, appAreas, counterApps, priorityOptions, onTicketSelect, navigateToAllTicketsWithFilter, isLoading = false }) => {
  const [selectedAppGroup, setSelectedAppGroup] = useState<AppBucketGroup | null>(null);
  const [isReleaseBacklogOpen, setIsReleaseBacklogOpen] = useState(false);

  const handleTicketSelect = (ticket: Ticket) => {
    onTicketSelect(ticket);
  };
  const openTickets = useMemo(() => tickets.filter(t => !isClosedTicket(t)), [tickets]);
  const needsReleaseTickets = useMemo(() => {
    return openTickets
      .filter(t => !t.release_version_id)
      .sort((a, b) => {
        const ticketNumberDiff = parseTicketNumber(b.ticketNumber) - parseTicketNumber(a.ticketNumber);
        if (ticketNumberDiff !== 0) return ticketNumberDiff;
        return b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime();
      });
  }, [openTickets]);
  const highPriorityTickets = useMemo(() => openTickets.filter(t => {
    const key = (t.priorityKey || t.priorityLabel || '').toLowerCase();
    return key.includes('high') || key.includes('urgent') || (t.priorityWeight ?? 0) >= 80;
  }), [openTickets]);
  const waitingTickets = useMemo(() => openTickets.filter(t => normalizeStatus(t).includes('waiting')), [openTickets]);
  const appRegistry = useMemo(() => {
    const registry = new Map<string, CounterAppOption>();

    counterApps.forEach(app => {
      const appKey = getCanonicalAppKey(app.slug || app.app_context || '');
      if (!appKey) return;

      const existing = registry.get(appKey);
      if (!existing || app.slug === appKey) {
        registry.set(appKey, app);
      }
    });

    return registry;
  }, [counterApps]);

  const appSummaryBucketsByGroup = useMemo(() => {
    const ticketCounts = new Map<string, number>();
    openTickets.forEach(ticket => {
      const appKey = getCanonicalAppKey(ticket.app);
      ticketCounts.set(appKey, (ticketCounts.get(appKey) || 0) + 1);
    });

    const grouped = dashboardGroups.reduce<Record<AppBucketGroup, AppSummaryBucket[]>>((acc, group) => {
      const knownKeys = new Set<string>(
        counterApps
          .filter(app => {
            const appKey = getCanonicalAppKey(app.slug || app.app_context || '');
            if (!appKey) return false;
            return surfaceToGroup(app.surface, appKey) === group;
          })
          .map(app => getCanonicalAppKey(app.slug || app.app_context || ''))
      );

      openTickets.forEach(ticket => {
        const ticketGroup = getAppBucketGroup(ticket, appRegistry);
        if (ticketGroup === group) {
          knownKeys.add(getCanonicalAppKey(ticket.app));
        }
      });

      acc[group] = Array.from(knownKeys)
        .map((appKey): AppSummaryBucket => ({
          key: appKey,
          label: appRegistry.get(appKey)?.name || appKey,
          count: ticketCounts.get(appKey) || 0,
          group,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

      return acc;
  }, { external: [], hybrid: [], internal: [] });

    return grouped;
  }, [appRegistry, openTickets]);

  const selectedGroupDetails = useMemo<AppModuleDetail[]>(() => {
    if (!selectedAppGroup) return [];

    return appSummaryBucketsByGroup[selectedAppGroup].map(app => {
      const moduleBuckets = new Map<string, AppAreaBucket>();
      openTickets
        .filter(ticket => getCanonicalAppKey(ticket.app) === app.key)
        .forEach(ticket => {
          const area = appAreas.find(candidate => candidate.id === ticket.app_area_id);
          const key = area ? `area:${area.id}` : `app:${ticket.app}:general`;
          const label = area?.label || 'General';
          const existing = moduleBuckets.get(key);

          if (existing) {
            existing.count += 1;
            existing.tickets.push(ticket);
          } else {
            moduleBuckets.set(key, {
              key,
              label,
              count: 1,
              tickets: [ticket],
              filterType: area ? 'appArea' : 'app',
              filterValue: area ? area.id : ticket.app,
              colorKey: ticket.app,
              group: selectedAppGroup,
            });
          }
        });

      return {
        appKey: app.key,
        appLabel: app.label,
        total: app.count,
        modules: Array.from(moduleBuckets.values())
          .map(module => ({
            ...module,
            tickets: module.tickets.sort((a, b) => parseTicketNumber(b.ticketNumber) - parseTicketNumber(a.ticketNumber)),
          }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
      };
    }).filter(app => app.total > 0);
  }, [appAreas, appSummaryBucketsByGroup, openTickets, selectedAppGroup]);

  const ticketsByPriority = useMemo<PriorityBucket[]>(() => {
    const counts = openTickets.reduce<Map<string, number>>((acc, ticket) => {
      if (!ticket.priorityId) return acc;
      acc.set(ticket.priorityId, (acc.get(ticket.priorityId) || 0) + 1);
      return acc;
    }, new Map<string, number>());

    return priorityOptions.map(priority => ({
      key: priority.id,
      priorityKey: priority.key,
      label: priority.label,
      weight: priority.weight ?? null,
      count: counts.get(priority.id) || 0,
    }));
  }, [openTickets, priorityOptions]);

  const releaseBuckets = useMemo<ReleaseBucket[]>(() => {
    const buckets = openTickets.reduce<Map<string, ReleaseBucket>>((acc, ticket) => {
      const key = ticket.release_version_id || 'none';
      const label = ticket.release_version_label || 'Needs release';
      const ticketGroup = getAppBucketGroup(ticket, appRegistry);
      const environmentLabel = releaseEnvironmentLabel(ticket, ticketGroup);
      const existing = acc.get(key);
      if (existing) {
        existing.count += 1;
        if (existing.environmentLabel && existing.environmentLabel !== environmentLabel) {
          existing.environmentLabel = 'External';
        }
      } else {
        acc.set(key, {
          key,
          label,
          count: 1,
          filterValue: ticket.release_version_id || 'none',
          environmentLabel,
        });
      }
      return acc;
    }, new Map<string, ReleaseBucket>());

    const values = Array.from(buckets.values()) as ReleaseBucket[];
    return values.sort((a, b) => {
      if (a.key === 'none') return -1;
      if (b.key === 'none') return 1;
      return b.count - a.count || a.label.localeCompare(b.label);
    });
  }, [appRegistry, openTickets]);

  const needsReleaseByGroup = useMemo<ReleaseBucket[]>(() => {
    const counts = needsReleaseTickets.reduce<Record<AppBucketGroup, number>>((acc, ticket) => {
      const group = getAppBucketGroup(ticket, appRegistry);
      const releaseGroup = group === 'external' ? 'external' : 'internal';
      acc[releaseGroup] += 1;
      return acc;
    }, { external: 0, internal: 0 });

    return (['external', 'internal'] as const)
      .map(group => ({
        key: `needs-release-${group}`,
        label: groupLabel[group],
        count: counts[group],
        filterValue: 'none',
        group,
      }));
  }, [appRegistry, needsReleaseTickets]);

  const statusBuckets = useMemo<StatusBucket[]>(() => {
    const buckets = openTickets.reduce<Map<string, StatusBucket>>((acc, ticket) => {
      const key = ticket.statusKey || ticket.statusLabel || ticket.statusId || 'unknown';
      const existing = acc.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        acc.set(key, {
          key,
          label: ticket.statusLabel || ticket.statusKey || 'Unknown',
          count: 1,
          statusId: ticket.statusId,
        });
      }
      return acc;
    }, new Map<string, StatusBucket>());

    const values = Array.from(buckets.values()) as StatusBucket[];
    return values.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [openTickets]);

  return (
    <div className="overflow-x-hidden bg-boh-bg-light dark:bg-boh-bg lg:h-[calc(100vh-10.75rem)] lg:min-h-[590px] lg:overflow-hidden">
      <div className="flex min-h-0 w-full flex-col gap-3 px-1 py-1 pb-24 sm:px-2 lg:h-full lg:px-0 lg:py-0">
        <div className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
          <div
            className={metricCardClass}
            onClick={() => navigateToAllTicketsWithFilter('', '')}
          >
            <p className="mb-1 whitespace-nowrap text-xs font-medium uppercase text-boh-text-sub-light dark:text-boh-text-sub">Open tickets</p>
            <p className="text-3xl font-bold leading-none text-boh-text-light dark:text-boh-text">{openTickets.length}</p>
            <span className="absolute bottom-3 right-4 text-right text-xs font-medium text-boh-primary">{tickets.length} total tracked</span>
          </div>
          <div
            className={metricCardClass}
            onClick={() => {
              const firstHigh = highPriorityTickets[0];
              navigateToAllTicketsWithFilter('priority', firstHigh?.priorityId || '');
            }}
          >
            <p className="mb-1 whitespace-nowrap text-xs font-medium uppercase text-boh-text-sub-light dark:text-boh-text-sub">High priority</p>
            <p className="text-3xl font-bold leading-none text-boh-text-light dark:text-boh-text">{highPriorityTickets.length}</p>
            <span className="absolute bottom-3 right-4 text-right text-xs font-medium text-boh-primary">Open high-impact</span>
          </div>
          <div
            className={metricCardClass}
            onClick={() => navigateToAllTicketsWithFilter('release', 'none')}
          >
            <p className="mb-1 whitespace-nowrap text-xs font-medium uppercase text-boh-text-sub-light dark:text-boh-text-sub">Needs release</p>
            <p className="text-3xl font-bold leading-none text-boh-text-light dark:text-boh-text">{needsReleaseTickets.length}</p>
            <span className="absolute bottom-3 right-4 text-right text-xs font-medium text-boh-primary">
              {needsReleaseTickets.length > 0
                ? needsReleaseByGroup.map(bucket => `${bucket.label} ${bucket.count}`).join(' - ')
                : 'All allocated'}
            </span>
          </div>
          <div
            className={metricCardClass}
            onClick={() => {
              const firstWaiting = waitingTickets[0];
              navigateToAllTicketsWithFilter('status', firstWaiting?.statusId || '');
            }}
          >
            <p className="mb-1 whitespace-nowrap text-xs font-medium uppercase text-boh-text-sub-light dark:text-boh-text-sub">Waiting</p>
            <p className="text-3xl font-bold leading-none text-boh-text-light dark:text-boh-text">{waitingTickets.length}</p>
            <span className="absolute bottom-3 right-4 text-right text-xs font-medium text-boh-primary">Pending checks</span>
          </div>
        </div>

        <div className="shrink-0 px-1 text-[11px] text-boh-text-sub-light dark:text-boh-text-sub">
          <span className="font-medium text-boh-text-light dark:text-boh-text">Release names:</span>
          <span className="ml-2">tea = external</span>
          <span className="mx-2">|</span>
          <span>cat = internal</span>
          <span className="mx-2">|</span>
          <span>Needs release = intake work not ready to start</span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.65fr)]">
          <section className={`${panelClass} flex min-h-[440px] flex-col lg:min-h-0`}>
            <div className={panelHeaderClass}>
              <div>
                <h2 className="text-sm font-semibold uppercase text-boh-text-light dark:text-boh-text">Tickets by audience</h2>
                <p className="mt-0.5 text-xs text-boh-text-sub-light dark:text-boh-text-sub">Open ticket ownership by audience</p>
              </div>
              <span className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">{openTickets.length} open</span>
            </div>
            <div className="grid min-h-0 flex-1 gap-3 p-3 md:grid-cols-3">
              {dashboardGroups.map(group => {
                const buckets = appSummaryBucketsByGroup[group];
                const groupTotal = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

                return (
                  <div key={group} className="flex min-h-[220px] min-w-0 flex-col rounded-md border border-[#d8d3ea66] bg-boh-bg-light/15 dark:border-[#ffffff1a] dark:bg-boh-bg/15">
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#d8d3ea4d] px-3 py-2 dark:border-[#ffffff14]">
                      <button
                        type="button"
                        className="min-w-0 truncate text-left text-xs font-semibold uppercase text-boh-primary hover:text-boh-primary-dark"
                        onClick={() => setSelectedAppGroup(group)}
                      >
                        View {groupLabel[group]}
                      </button>
                      <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-boh-text-light dark:text-boh-text">
                        {groupTotal}
                      </span>
                    </div>
                    <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto boh-hide-scrollbar p-2">
                      {buckets.map((bucket) => (
                        <li key={bucket.key} className="min-w-0">
                          <button
                            type="button"
                            className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-boh-bg-light/60 dark:hover:bg-boh-bg/60"
                            onClick={() => navigateToAllTicketsWithFilter('app', getAppFilterValue(bucket.key))}
                          >
                            <span className="truncate text-sm text-boh-text-light dark:text-boh-text">{bucket.label}</span>
                            <span className="text-right text-xs font-semibold tabular-nums text-boh-text-light dark:text-boh-text">{bucket.count}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid min-h-0 min-w-0 gap-3 lg:grid-rows-[minmax(150px,0.68fr)_minmax(205px,1.08fr)_minmax(190px,1fr)]">
            <section className={`${panelClass} flex max-h-[320px] flex-col lg:max-h-none lg:min-h-0`}>
              <div className={panelHeaderClass}>
                <h2 className="text-sm font-semibold uppercase text-boh-text-light dark:text-boh-text">Release Allocation</h2>
                {needsReleaseTickets.length > 0 ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-boh-primary hover:text-boh-primary-dark"
                    onClick={() => setIsReleaseBacklogOpen(true)}
                  >
                    Review backlog
                  </button>
                ) : (
                  <span className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">All allocated</span>
                )}
              </div>
              <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto boh-hide-scrollbar px-4 py-2">
                {releaseBuckets.filter(bucket => bucket.key !== 'none').map((bucket) => (
                  <li key={bucket.key}>
                    <button
                      type="button"
                      className="grid w-full grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-boh-bg-light/60 dark:hover:bg-boh-bg/60"
                      onClick={() => navigateToAllTicketsWithFilter('release', bucket.filterValue)}
                    >
                      <span className="truncate text-sm text-boh-text-light dark:text-boh-text">
                        {bucket.environmentLabel ? `${bucket.label} - ${bucket.environmentLabel}` : bucket.label}
                      </span>
                      <span className="text-right text-xs font-semibold tabular-nums text-boh-text-light dark:text-boh-text">{bucket.count}</span>
                    </button>
                  </li>
                ))}
                {releaseBuckets.filter(bucket => bucket.key !== 'none').length === 0 && (
                  <li className="px-2 py-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    No tickets are allocated to releases yet.
                  </li>
                )}
              </ul>
            </section>

            <section className={`${panelClass} flex max-h-[320px] flex-col lg:max-h-none lg:min-h-0`}>
              <div className={panelHeaderClass}>
                <h2 className="text-sm font-semibold uppercase text-boh-text-light dark:text-boh-text">Status Mix</h2>
              </div>
              <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto boh-hide-scrollbar px-4 py-2">
                {statusBuckets.map(({ key, label, count, statusId }) => (
                  <li key={key} className="min-w-0">
                    <button
                      type="button"
                      className="grid min-h-7 w-full grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 rounded-md px-2 py-0.5 text-left transition-colors hover:bg-boh-bg-light/60 dark:hover:bg-boh-bg/60"
                      onClick={() => navigateToAllTicketsWithFilter('status', statusId)}
                    >
                      <span className="truncate text-sm text-boh-text-light dark:text-boh-text">{label}</span>
                      <span className="text-right text-xs font-semibold tabular-nums text-boh-text-light dark:text-boh-text">{count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className={`${panelClass} flex max-h-[320px] flex-col lg:max-h-none lg:min-h-0`}>
              <div className={panelHeaderClass}>
                <h2 className="text-sm font-semibold uppercase text-boh-text-light dark:text-boh-text">Priority</h2>
              </div>
              {ticketsByPriority.length > 0 ? (
                <ul className="grid min-h-0 flex-1 auto-rows-fr gap-1 px-4 py-2">
                  {ticketsByPriority.map(({ key, priorityKey, label, weight, count }) => (
                    <li key={key} className="min-h-0">
                      <button
                        type="button"
                        className="grid h-full min-h-8 w-full grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-boh-bg-light/60 dark:hover:bg-boh-bg/60"
                        onClick={() => navigateToAllTicketsWithFilter('priority', key)}
                      >
                        <PriorityBadge priorityLabel={label} priorityKey={priorityKey} priorityWeight={weight} />
                        <span className="text-right text-xs font-semibold tabular-nums text-boh-text-light dark:text-boh-text">{count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-sm text-boh-text-sub-light dark:text-boh-text-sub">No tickets yet.</p>
              )}
            </section>
          </div>
        </div>
      </div>
      <BohSlideOver
        isOpen={Boolean(selectedAppGroup)}
        title={selectedAppGroup ? `${groupLabel[selectedAppGroup]} ticket detail` : 'Ticket detail'}
        description="Dashboard totals stay on the page. This view shows the tickets behind the selected audience."
        onClose={() => setSelectedAppGroup(null)}
        closeLabel="Close ticket detail"
      >
        {selectedGroupDetails.length === 0 ? (
          <p className="rounded-md border border-boh-border-light p-4 text-sm text-boh-text-sub-light dark:border-boh-border dark:text-boh-text-sub">
            No open tickets in this audience.
          </p>
        ) : (
        <div className="space-y-4">
          {selectedGroupDetails.map(app => (
            <section key={app.appKey} className="overflow-hidden rounded-md border border-boh-border-light dark:border-boh-border">
              <div className="flex items-center justify-between gap-3 border-b border-boh-border-light px-3 py-2 dark:border-boh-border">
                <div className="flex min-w-0 items-center">
                  <h3 className="truncate text-sm font-semibold text-boh-text-light dark:text-boh-text">{app.appLabel}</h3>
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-boh-text-light dark:text-boh-text">
                  {app.total}
                </span>
              </div>
              <div className="divide-y divide-boh-border-light dark:divide-boh-border">
                {app.modules.map(module => (
                  <div key={module.key}>
                    <div className="flex items-center justify-between gap-2 bg-boh-bg-light/45 px-3 py-2 dark:bg-boh-bg/45">
                      <button
                        type="button"
                        className="min-w-0 truncate text-left text-xs font-semibold uppercase text-boh-primary hover:text-boh-primary-dark"
                        onClick={() => navigateToAllTicketsWithFilter(module.filterType, module.filterValue)}
                      >
                        {module.label}
                      </button>
                      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-boh-text-light dark:text-boh-text">{module.count}</span>
                    </div>
                    <ul className="space-y-1 p-2">
                      {module.tickets.map(ticket => (
                        <li key={ticket.id}>
                          <button
                            type="button"
                            className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-boh-bg-light/60 dark:hover:bg-boh-bg/60"
                            onClick={() => {
                              setSelectedAppGroup(null);
                              handleTicketSelect(ticket);
                            }}
                          >
                            <p className="truncate text-sm font-medium text-boh-text-light dark:text-boh-text">{ticket.subject}</p>
                            <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                              <span className="shrink-0 font-mono">{ticket.ticketNumber || ''}</span>
                              <span className="min-w-0 truncate">{ticket.statusLabel}</span>
                              <span className="shrink-0">{formatTimeAgo(ticket.lastUpdatedAt)}</span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        )}
      </BohSlideOver>
      {needsReleaseTickets.length > 0 && (
        <BohSlideOver
          isOpen={isReleaseBacklogOpen}
          title="Release backlog"
          description={`${needsReleaseTickets.length} open tickets need a release allocation.`}
          onClose={() => setIsReleaseBacklogOpen(false)}
          closeLabel="Close release backlog"
          footer={(
            <button
              type="button"
              className="h-10 min-w-36 rounded-md bg-boh-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-boh-primary/90"
              onClick={() => navigateToAllTicketsWithFilter('release', 'none')}
            >
              Open All Tickets
            </button>
          )}
        >
          <ul className="space-y-2">
            {needsReleaseTickets.map(ticket => (
              <li key={ticket.id}>
                <button
                  type="button"
                  className="w-full rounded-md border border-boh-border-light p-3 text-left transition-colors hover:bg-boh-bg-light/60 dark:border-boh-border dark:hover:bg-boh-bg/60"
                  onClick={() => {
                    setIsReleaseBacklogOpen(false);
                    handleTicketSelect(ticket);
                  }}
                >
                  <p className="mb-1 line-clamp-2 text-sm font-semibold text-boh-text-light dark:text-boh-text">{ticket.subject}</p>
                  <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                    <span className="shrink-0 font-mono">{ticket.ticketNumber || ''}</span>
                    <span className="min-w-0 truncate">{ticket.app}</span>
                    <span className="shrink-0">{formatTimeAgo(ticket.lastUpdatedAt)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </BohSlideOver>
      )}
    </div>
  );
};

export default CounterDashboardPage;

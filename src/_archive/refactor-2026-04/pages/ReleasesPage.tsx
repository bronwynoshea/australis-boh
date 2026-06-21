import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Toast from '../components/Toast';

type ReleaseTier = 'major' | 'minor';

type ReleaseStatus = 'planned' | 'in progress' | 'released' | 'deprecated';

type ReleaseVersionUsageRow = {
  id: string;
  version_label: string | null;
  release_tier: ReleaseTier;
  version_number: string | null;
  release_year: number | null;
  release_cycle: string | null;
  release_date: string | null;
  status: string;
  is_active: boolean;
  ticket_count?: number | null;
  is_used?: boolean | null;
  notes: string | null;
  sort_date?: string | null;
  created_at: string | null;
  updated_at?: string | null;
  parent_major_release_id?: string | null;
};

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      {children}
    </div>
  );
};

type TicketRow = {
  id: string;
  ticket_number: string | null;
  subject: string | null;
  requester_name: string | null;
  requester_email: string | null;
  created_at: string;
  updated_at: string;
  status: { key: string; label: string } | null;
  priority: { key: string; label: string; weight: number | null } | null;
};

const ReleasesPage: React.FC = () => {
  const location = useLocation();
  const scope = useMemo<'internal' | 'external'>(() => {
    const params = new URLSearchParams(location.search);
    const raw = (params.get('scope') || 'external').toLowerCase();
    return raw === 'internal' ? 'internal' : 'external';
  }, [location.search]);

  const [releases, setReleases] = useState<ReleaseVersionUsageRow[]>([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string>('');
  const [tickets, setTickets] = useState<TicketRow[]>([]);

  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);

  // Filters
  const [activeOnly, setActiveOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | ReleaseStatus>('all');
  const [showReleased, setShowReleased] = useState(false);
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [quarterTab, setQuarterTab] = useState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('all');
  const [hasInitQuarterTab, setHasInitQuarterTab] = useState(false);

  const MINOR_PAGE_SIZE = 5;
  const [minorPage, setMinorPage] = useState(1);

  // Responsive
  const [isMobile, setIsMobile] = useState(false);
  const [activeTierTab, setActiveTierTab] = useState<ReleaseTier>('major');
  const [isDetailOpenMobile, setIsDetailOpenMobile] = useState(false);

  // Edit form state
  const [editTier, setEditTier] = useState<ReleaseTier>('major');
  const [editStatus, setEditStatus] = useState('');
  const [editReleaseYear, setEditReleaseYear] = useState<string>('');
  const [editReleaseCycle, setEditReleaseCycle] = useState<string>('');
  const [editReleaseDate, setEditReleaseDate] = useState('');
  const [editVersionNumber, setEditVersionNumber] = useState('');
  const [isEditVersionEnabled, setIsEditVersionEnabled] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isNewReleaseOpen, setIsNewReleaseOpen] = useState(false);
  const [createTier, setCreateTier] = useState<ReleaseTier | null>(null);
  const [createReleaseDate, setCreateReleaseDate] = useState<string>('');
  const [createNotes, setCreateNotes] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [isCopyingSummary, setIsCopyingSummary] = useState(false);

  const normalizeReleaseStatus = (status: string | null | undefined) => (status || '').trim().toLowerCase();

  const isInProgressStatus = (status: string | null | undefined) => {
    return normalizeReleaseStatus(status) === 'in progress';
  };

  const isPlannedStatus = (status: string | null | undefined) => {
    return normalizeReleaseStatus(status) === 'planned';
  };

  const isReleasedStatus = (status: string | null | undefined) => {
    return normalizeReleaseStatus(status) === 'released';
  };

  const isDeprecatedStatus = (status: string | null | undefined) => {
    return normalizeReleaseStatus(status) === 'deprecated';
  };

  const parseIsoDate = (iso: string): Date | null => {
    const v = (iso || '').trim();
    if (!v) return null;
    const [y, m, d] = v.split('-').map((p) => Number(p));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m - 1, d);
  };

  const deriveYearCycleFromIso = (iso: string): { year: number; cycle: 'Q1' | 'Q2' | 'Q3' | 'Q4' } => {
    const d = parseIsoDate(iso);
    const fallback = new Date();
    const dt = d || fallback;
    const cycle = (`Q${Math.floor(dt.getMonth() / 3) + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4');
    return { year: dt.getFullYear(), cycle };
  };

  const openNewRelease = () => {
    setCreateTier(null);
    setCreateReleaseDate('');
    setCreateNotes('');
    setIsNewReleaseOpen(true);
  };

  const handleCreateRelease = async () => {
    if (!createTier) return;

    const dateIso = (createReleaseDate || '').trim();
    if (!dateIso) return;

    const { year, cycle } = deriveYearCycleFromIso(dateIso);
    const versionLabel = `${createTier.toUpperCase()} ${dateIso}`;

    setIsCreating(true);
    try {
      const insert: any = {
        version_label: versionLabel,
        release_tier: createTier,
        status: 'planned',
        release_year: year,
        release_cycle: cycle,
        release_date: dateIso,
        is_active: true,
        notes: createNotes.trim() || null,
        environment: scope === 'internal' ? 'internal' : 'external',
      };

      const { data, error } = await supabase.from('boh_release_version').insert(insert).select('id').maybeSingle();
      if (error) {
        console.error('[ReleasesPage] Failed to create release', error);
        return;
      }

      const createdId = (data as any)?.id as string | undefined;
      setIsNewReleaseOpen(false);
      await loadReleases();
      if (createdId) {
        setSelectedReleaseId(createdId);
        if (isMobile) setIsDetailOpenMobile(true);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const releaseHeaderString = (r: Pick<ReleaseVersionUsageRow, 'release_year' | 'release_cycle' | 'version_number'>) => {
    const year = typeof r.release_year === 'number' ? String(r.release_year) : '—';
    const cycle = (r.release_cycle || '').trim() || '—';
    const ver = formatVersionNumberForUi(r.version_number) || 'No version';
    return `${year} · ${cycle} · ${ver}`;
  };

  const yearCycleKey = (r: Pick<ReleaseVersionUsageRow, 'release_year' | 'release_cycle'>) => {
    const year = typeof r.release_year === 'number' ? String(r.release_year) : '—';
    const cycle = (r.release_cycle || '').trim() || '—';
    return `${year} · ${cycle}`;
  };

  const compareReleaseDateAscNullsLast = (a: ReleaseVersionUsageRow, b: ReleaseVersionUsageRow) => {
    const ad = a.release_date;
    const bd = b.release_date;
    if (ad && bd) {
      if (ad !== bd) return ad.localeCompare(bd);
    } else if (ad && !bd) {
      return -1;
    } else if (!ad && bd) {
      return 1;
    }
    return (a.version_label || '').localeCompare(b.version_label || '');
  };

  const normalizeVersionNumberForDb = (raw: string | null | undefined): string | null => {
    const v = (raw || '').trim();
    if (!v) return null;
    return v.replace(/^v\s*/i, '');
  };

  const formatVersionNumberForUi = (raw: string | null | undefined): string | null => {
    const normalized = normalizeVersionNumberForDb(raw);
    if (!normalized) return null;
    return `v${normalized}`;
  };

  const formatReleaseDateForUi = (iso: string | null | undefined): string => {
    const parsed = iso ? parseIsoDate((iso || '').slice(0, 10)) : null;
    if (!parsed) return '—';
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsed);
  };

  const hydrateTicketCounts = async (rows: ReleaseVersionUsageRow[]): Promise<ReleaseVersionUsageRow[]> => {
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (ids.length === 0) return rows;

    const { data, error } = await supabase
      .from('counter_ticket')
      .select('release_version_id')
      .in('release_version_id', ids)
      .limit(10000);

    if (error) {
      console.error('[ReleasesPage] Failed to hydrate ticket counts', error);
      return rows.map((r) => ({ ...r, ticket_count: 0 }));
    }

    const counts = new Map<string, number>();
    for (const row of (data || []) as any[]) {
      const id = row.release_version_id as string | null;
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    return rows.map((r) => ({ ...r, ticket_count: counts.get(r.id) ?? 0 }));
  };

  const loadReleases = async () => {
    setIsLoadingReleases(true);
    try {
      let query = supabase
        .from('boh_release_version')
        .select('id, environment, version_label, release_tier, status, release_year, release_cycle, release_date, version_number, is_active, notes, sort_date, created_at, updated_at, parent_major_release_id')
        .order('release_date', { ascending: true, nullsFirst: false })
        .order('release_year', { ascending: true, nullsFirst: false })
        .order('release_cycle', { ascending: true, nullsFirst: false })
        .order('version_label', { ascending: true, nullsFirst: true });

      query = scope === 'internal' ? query.eq('environment', 'internal') : query.eq('environment', 'external');

      const { data, error } = await query;

      if (error) {
        console.error('[ReleasesPage] Error loading releases', error);
        setReleases([]);
        setSelectedReleaseId('');
        setTickets([]);
        return;
      }

      const baseRows = (((data || []) as unknown as any[]) || []).filter(
        (r) => r.release_tier === 'major' || r.release_tier === 'minor',
      ) as ReleaseVersionUsageRow[];

      const rows = await hydrateTicketCounts(baseRows);
      setReleases(rows);

      if (!hasInitQuarterTab) {
        const now = new Date();
        const q = (`Q${Math.floor(now.getMonth() / 3) + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4');
        const hasQ = rows.some((r) => (r.release_cycle || '').trim().toUpperCase() === q);
        setQuarterTab(hasQ ? q : 'all');
        setHasInitQuarterTab(true);
      }

      if (rows.length === 0) {
        setSelectedReleaseId('');
        setTickets([]);
        return;
      }

      const stillExists = selectedReleaseId && rows.some((r) => r.id === selectedReleaseId);
      if (!stillExists) {
        const today = new Date().toISOString().slice(0, 10);
        const nowTs = Date.now();

        const inProgress = rows.filter((r) => isInProgressStatus(r.status));
        const pickCurrent = (() => {
          if (inProgress.length === 0) return null;
          const withDates = inProgress.filter((r) => !!r.release_date);
          if (withDates.length === 0) {
            return [...inProgress].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
          }
          return [...withDates].sort((a, b) => {
            const at = parseIsoDate((a.release_date || '').slice(0, 10))?.getTime() ?? 0;
            const bt = parseIsoDate((b.release_date || '').slice(0, 10))?.getTime() ?? 0;
            return Math.abs(at - nowTs) - Math.abs(bt - nowTs);
          })[0];
        })();

        const nextMinor = [...rows]
          .filter(
            (r) =>
              r.release_tier === 'minor' &&
              isPlannedStatus(r.status) &&
              !!r.release_date &&
              (r.release_date || '').slice(0, 10) >= today,
          )
          .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))[0];

        const nextMajor = [...rows]
          .filter(
            (r) =>
              r.release_tier === 'major' &&
              isPlannedStatus(r.status) &&
              !!r.release_date &&
              (r.release_date || '').slice(0, 10) >= today,
          )
          .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))[0];

        setSelectedReleaseId((pickCurrent || nextMinor || nextMajor).id);
      }
    } finally {
      setIsLoadingReleases(false);
    }
  };

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsMobile(mql.matches);
    apply();

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', apply);
      return () => mql.removeEventListener('change', apply);
    }

    // Fallback (older browsers)
    mql.addListener(apply);
    return () => mql.removeListener(apply);
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadReleases();
    };

    void run();
    return () => {
      // no-op
    };
  }, [scope]);

  useEffect(() => {
    if (activeOnly) {
      if (statusFilter !== 'all') setStatusFilter('all');
      if (showReleased) setShowReleased(false);
      if (showDeprecated) setShowDeprecated(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    if (statusFilter === 'all') {
      if (activeOnly) setActiveOnly(false);
      if (!showReleased) setShowReleased(true);
      if (!showDeprecated) setShowDeprecated(true);
    }
  }, [statusFilter]);

  useEffect(() => {
    if ((showReleased || showDeprecated) && activeOnly) {
      setActiveOnly(false);
    }
  }, [showReleased, showDeprecated]);

  useEffect(() => {
    if (statusFilter !== 'all' && activeOnly) {
      setActiveOnly(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    let mounted = true;

    const loadTickets = async () => {
      if (!selectedReleaseId) {
        setTickets([]);
        return;
      }

      setIsLoadingTickets(true);
      try {
        const { data, error } = await supabase
          .from('counter_ticket')
          .select(`
            id,
            ticket_number,
            subject,
            requester_name,
            requester_email,
            created_at,
            updated_at,
            status:counter_ticket_status!counter_ticket_status_id_fkey(key, label),
            priority:counter_ticket_priority!counter_ticket_priority_id_fkey(key, label, weight)
          `)
          .eq('release_version_id', selectedReleaseId)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('[ReleasesPage] Error loading tickets for release', error);
          if (mounted) setTickets([]);
          return;
        }

        if (!mounted) return;
        setTickets((data || []) as unknown as TicketRow[]);
      } finally {
        if (mounted) setIsLoadingTickets(false);
      }
    };

    void loadTickets();

    return () => {
      mounted = false;
    };
  }, [selectedReleaseId]);

  const selectedRelease = useMemo(() => {
    return releases.find((r) => r.id === selectedReleaseId) || null;
  }, [releases, selectedReleaseId]);

  const filteredReleases = useMemo(() => {
    const base = releases;

    if (activeOnly) {
      return base.filter((r) => {
        const s = normalizeReleaseStatus(r.status);
        return s === 'planned' || s === 'in progress';
      });
    }

    if (statusFilter !== 'all') {
      return base.filter((r) => normalizeReleaseStatus(r.status) === statusFilter);
    }

    // All means truly all statuses, regardless of toggles.
    return base;
  }, [releases, activeOnly, showReleased, showDeprecated, statusFilter]);

  useEffect(() => {
    // Reset pagination when the visible dataset changes
    setMinorPage(1);
  }, [activeOnly, statusFilter, showReleased, showDeprecated, quarterTab]);

  const quarterFilteredReleases = useMemo(() => {
    if (quarterTab === 'all') return filteredReleases;
    const target = quarterTab.toUpperCase();
    return filteredReleases.filter((r) => (r.release_cycle || '').trim().toUpperCase() === target);
  }, [filteredReleases, quarterTab]);

  const releasesMajor = useMemo(() => {
    const base = [...quarterFilteredReleases].filter((r) => r.release_tier === 'major');
    return base.sort(compareReleaseDateAscNullsLast);
  }, [quarterFilteredReleases]);

  const releasesMinor = useMemo(() => {
    const base = [...quarterFilteredReleases].filter((r) => r.release_tier === 'minor');
    return base.sort(compareReleaseDateAscNullsLast);
  }, [quarterFilteredReleases]);

  const pagedMinor = useMemo(() => {
    const start = (minorPage - 1) * MINOR_PAGE_SIZE;
    return releasesMinor.slice(start, start + MINOR_PAGE_SIZE);
  }, [releasesMinor, minorPage]);

  const minorTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(releasesMinor.length / MINOR_PAGE_SIZE));
  }, [releasesMinor.length]);

  useEffect(() => {
    if (minorPage > minorTotalPages) {
      setMinorPage(minorTotalPages);
    }
  }, [minorPage, minorTotalPages]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const currentRelease = useMemo(() => {
    const inProgress = releases.filter((r) => isInProgressStatus(r.status));
    if (inProgress.length === 0) return null;

    const dated = inProgress.filter((r) => !!r.release_date && r.release_date <= todayIso);
    if (dated.length > 0) {
      return [...dated].sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))[0];
    }

    // Fallback: if in-progress releases don't have dates, pick newest by created_at
    return [...inProgress].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
  }, [releases, todayIso]);

  const sortedTicketsByPriority = useMemo(() => {
    if (!tickets.length) return [];
    return [...tickets].sort((a, b) => {
      const aWeight = Number.isFinite(a.priority?.weight as number) ? (a.priority?.weight as number) : Number.MAX_SAFE_INTEGER;
      const bWeight = Number.isFinite(b.priority?.weight as number) ? (b.priority?.weight as number) : Number.MAX_SAFE_INTEGER;
      if (aWeight !== bWeight) {
        return aWeight - bWeight;
      }
      const aTicket = (a.ticket_number || '').toString();
      const bTicket = (b.ticket_number || '').toString();
      if (aTicket && bTicket && aTicket !== bTicket) {
        return aTicket.localeCompare(bTicket, undefined, { numeric: true, sensitivity: 'base' });
      }
      return (a.id || '').localeCompare(b.id || '');
    });
  }, [tickets]);

  const formatFullDate = (iso?: string | null) => {
    const parsed = iso ? parseIsoDate((iso || '').slice(0, 10)) : null;
    if (!parsed) return 'Date not set';
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(parsed);
  };

  const CLOSED_STATUS_KEYWORDS = ['closed', 'resolved', 'done', 'complete', 'fixed', 'released'];

  const isTicketReleaseReady = (ticket: TicketRow) => {
    const key = (ticket.status?.key || '').toLowerCase();
    const label = (ticket.status?.label || '').toLowerCase();
    return CLOSED_STATUS_KEYWORDS.some((keyword) => key.includes(keyword) || label.includes(keyword));
  };

  const getTicketStatusDescriptor = (ticket: TicketRow) => {
    const descriptor = ticket.status?.label?.trim() || ticket.status?.key?.trim() || '';
    return descriptor || 'Status unknown';
  };

  const normalizeTicketSummary = (rawText: string) => {
    const trimmed = (rawText || '').trim();
    if (!trimmed) return 'Issue resolved.';
    const sentence = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
  };

  const buildTicketReleaseLine = (ticket: TicketRow) => {
    const identifier = ticket.ticket_number?.trim() || `Ticket ${ticket.id.slice(0, 8).toUpperCase()}`;
    const summarySource = ticket.subject?.trim() || 'Issue resolved';
    const normalized = normalizeTicketSummary(summarySource);
    return `${identifier} — Resolved: ${normalized}`;
  };

  const buildTicketOutstandingLine = (ticket: TicketRow) => {
    const identifier = ticket.ticket_number?.trim() || `Ticket ${ticket.id.slice(0, 8).toUpperCase()}`;
    const summarySource = ticket.subject?.trim() || 'Work in progress';
    const normalized = normalizeTicketSummary(summarySource);
    const descriptor = getTicketStatusDescriptor(ticket);
    return `${identifier} — Open (${descriptor}): ${normalized}`;
  };

  const releaseSummary = useMemo(() => {
    if (!selectedRelease || selectedRelease.release_tier !== 'minor') return '';

    const releaseName = selectedRelease.version_label?.trim() || 'Minor Release';
    const minorVersion = formatVersionNumberForUi(selectedRelease.version_number) || 'v?.?.?';

    const parentMajorId = selectedRelease.parent_major_release_id;
    const parentMajor = parentMajorId ? releases.find((r) => r.id === parentMajorId) || null : null;

    const majorName = parentMajor?.version_label?.trim() || 'Major Release';
    const majorVersion = formatVersionNumberForUi(parentMajor?.version_number) || 'v?.?.?';
    const majorReleaseDate = parentMajor?.release_date ? formatFullDate(parentMajor.release_date) : 'date TBD';

    const ticketSortKey = (ticket: TicketRow) => {
      const raw = (ticket.ticket_number || '').trim().toUpperCase();
      const numeric = Number.parseInt(raw.replace(/[^\d]/g, ''), 10);
      return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
    };

    const sortedClosedTickets = sortedTicketsByPriority
      .filter(isTicketReleaseReady)
      .sort((a, b) => ticketSortKey(a) - ticketSortKey(b));

    const sortedOutstandingTickets = sortedTicketsByPriority
      .filter((ticket) => !isTicketReleaseReady(ticket))
      .sort((a, b) => ticketSortKey(a) - ticketSortKey(b));

    const isMinorReleased = isReleasedStatus(selectedRelease.status);
    const isMajorReleased = parentMajor ? isReleasedStatus(parentMajor.status) : false;

    const minorDateLine = isMinorReleased
      ? `Released on ${formatFullDate(selectedRelease.release_date)}`
      : `Target release: ${formatFullDate(selectedRelease.release_date)}`;

    const majorDateLine = isMajorReleased
      ? `Culminating in ${majorName} (Major Release ${majorVersion} — released ${majorReleaseDate})`
      : `Leading into ${majorName} (Major Release ${majorVersion} — releasing ${majorReleaseDate})`;

    const updatesHeading = isMinorReleased ? '**Release notes**' : '**Release summary**';

    const lines = [
      `${releaseName} (Minor Release ${minorVersion})`,
      minorDateLine,
      majorDateLine,
      '',
      ...(sortedOutstandingTickets.length > 0
        ? [
            '**Outstanding / In Flight**',
            ...sortedOutstandingTickets.map((ticket) => buildTicketOutstandingLine(ticket)),
            '',
          ]
        : []),
      updatesHeading,
      ...(sortedClosedTickets.length > 0
        ? sortedClosedTickets.map((ticket) => buildTicketReleaseLine(ticket))
        : ['No closed tickets are ready for public release notes yet.']),
    ];

    return lines.join('\n');
  }, [selectedRelease, releases, sortedTicketsByPriority]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setIsToastVisible(true);
  };

  const handleCopyReleaseSummary = async () => {
    if (!releaseSummary.trim()) return;
    setIsCopyingSummary(true);
    try {
      await navigator.clipboard.writeText(releaseSummary);
      showToast('Release summary copied to clipboard.');
    } catch (error) {
      console.error('[ReleasesPage] Failed to copy release summary', error);
      showToast('Unable to copy release summary.');
    } finally {
      setIsCopyingSummary(false);
    }
  };

  const getNextPlannedByTier = (tier: ReleaseTier): ReleaseVersionUsageRow | null => {
    const candidates = releases.filter((r) => {
      if (r.release_tier !== tier) return false;
      return (r.status || '').toLowerCase() === 'planned' && !!r.release_date && r.release_date > todayIso;
    });
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))[0];
  };

  const nextMajorRelease = useMemo(() => getNextPlannedByTier('major'), [releases, todayIso]);
  const nextMinorRelease = useMemo(() => getNextPlannedByTier('minor'), [releases, todayIso]);

  useEffect(() => {
    if (!selectedRelease) return;
    setEditTier(selectedRelease.release_tier);
    setEditStatus(selectedRelease.status || '');
    setEditReleaseYear(
      typeof selectedRelease.release_year === 'number' ? String(selectedRelease.release_year) : '',
    );
    setEditReleaseCycle((selectedRelease.release_cycle || '').trim());
    setEditReleaseDate(selectedRelease.release_date ? selectedRelease.release_date.slice(0, 10) : '');
    setEditVersionNumber(selectedRelease.version_number || '');
    setEditIsActive(Boolean(selectedRelease.is_active));
    setIsEditVersionEnabled(false);
  }, [selectedReleaseId]);

  const handleSelectRelease = (id: string) => {
    setSelectedReleaseId(id);
    if (isMobile) {
      setIsDetailOpenMobile(true);
    }
  };

  const handleSaveRelease = async () => {
    if (!selectedRelease) return;
    setIsSaving(true);
    try {
      const patch: any = {
        release_tier: editTier,
        status: editStatus,
        release_year: editReleaseYear ? Number(editReleaseYear) : null,
        release_cycle: editReleaseCycle.trim() || null,
        release_date: editReleaseDate || null,
        is_active: editIsActive,
      };

      if (isEditVersionEnabled) {
        patch.version_number = normalizeVersionNumberForDb(editVersionNumber);
      }

      const { error } = await supabase.from('boh_release_version').update(patch).eq('id', selectedRelease.id);
      if (error) {
        console.error('[ReleasesPage] Failed to update release', error);
        showToast(error.message || 'Failed to update release.');
        return;
      }

      await loadReleases();
    } finally {
      setIsSaving(false);
    }
  };

  const setReleaseStatus = async (status: ReleaseStatus) => {
    if (!selectedRelease) return;
    setIsSaving(true);
    try {
      const patch: any = { status };
      const { error } = await supabase.from('boh_release_version').update(patch).eq('id', selectedRelease.id);
      if (error) {
        console.error('[ReleasesPage] Failed to update release status', error);
        return;
      }
      await loadReleases();
    } finally {
      setIsSaving(false);
    }
  };

  const StatusBadge = ({ value }: { value: string }) => {
    const label = value || 'unknown';
    return (
      <span className="inline-flex items-center rounded-full bg-boh-surface-light dark:bg-boh-surface px-2 py-0.5 text-xs font-medium text-boh-text-light dark:text-boh-text dark:bg-boh-surface dark:text-boh-text-sub">
        {label}
      </span>
    );
  };

  const ReleaseCard = ({ r }: { r: ReleaseVersionUsageRow }) => {
    const selected = r.id === selectedReleaseId;
    const ticketCount = typeof r.ticket_count === 'number' ? r.ticket_count : 0;
    const isLive = isInProgressStatus(r.status);
    const isReleased = isReleasedStatus(r.status);
    const isDeprecated = isDeprecatedStatus(r.status);
    const yearCycle = yearCycleKey(r);
    const dateString = formatReleaseDateForUi(r.release_date);
    const versionString = formatVersionNumberForUi(r.version_number);

    return (
      <button
        type="button"
        onClick={() => handleSelectRelease(r.id)}
        className={`w-full text-left rounded-xl border p-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-boh-bg ${
          selected
            ? 'border-primary bg-purple-50 dark:bg-boh-surface'
            : isLive
              ? 'border-primary bg-purple-50/60 dark:bg-boh-surface/60 hover:bg-purple-50 dark:hover:bg-boh-bg'
              : isReleased
                ? 'border-green-300 dark:border-boh-border bg-green-50/50 dark:bg-green-900/10 hover:bg-green-50 dark:hover:bg-green-900/15'
                : isDeprecated
                  ? 'border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg/30 hover:bg-boh-bg-light dark:hover:bg-boh-bg dark:bg-boh-bg/40'
                  : 'border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface hover:bg-boh-bg-light dark:hover:bg-boh-bg'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-boh-text-light dark:text-boh-text truncate">{r.version_label}</div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub whitespace-nowrap">{dateString}</span>
              <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub whitespace-nowrap">{yearCycle}</span>
              <StatusBadge value={r.status} />
              {versionString && (
                <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub whitespace-nowrap font-mono">{versionString}</span>
              )}
              <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{ticketCount} tickets</span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  const DetailPanel = ({ isMobilePanel }: { isMobilePanel: boolean }) => {
    return (
      <div
        className={`${
          isMobilePanel
            ? ''
            : 'sticky top-4'
        } rounded-2xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface p-4`}
      >
        {!selectedRelease ? (
          <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Select a release to view details.</div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold text-boh-text-light dark:text-boh-text">{selectedRelease.version_label}</div>
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{releaseHeaderString(selectedRelease)}</div>
            </div>

            {selectedRelease.release_tier === 'minor' && (
              <div className="rounded-xl border border-dashed border-primary/30 bg-boh-surface-light dark:bg-boh-surface/80 dark:bg-boh-surface/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Release summary</div>
                    <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                      Plain-text changelog for email, announcements, or status updates.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyReleaseSummary()}
                    disabled={!releaseSummary || isCopyingSummary}
                    className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/80 disabled:opacity-50"
                  >
                    {isCopyingSummary ? 'Copying…' : 'Copy Release Notes'}
                  </button>
                </div>
                <pre className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-primary/20 bg-boh-surface-light dark:bg-boh-surface/70 dark:bg-boh-bg/70 p-3 text-xs font-mono text-boh-text-light dark:text-boh-text whitespace-pre-wrap">
                  {releaseSummary || 'Assign tickets to this release to generate a summary.'}
                </pre>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="mt-1 w-full rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg px-3 py-2 text-sm text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  {(['planned', 'in progress', 'released', 'deprecated'] as const).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Year</label>
                  <input
                    type="number"
                    value={editReleaseYear}
                    onChange={(e) => setEditReleaseYear(e.target.value)}
                    className="mt-1 w-full rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg px-3 py-2 text-sm text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Cycle</label>
                  <input
                    value={editReleaseCycle}
                    onChange={(e) => setEditReleaseCycle(e.target.value)}
                    className="mt-1 w-full rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg px-3 py-2 text-sm text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Version number</label>
                <div className="mt-1 flex items-center justify-between">
                  <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                    {isEditVersionEnabled ? 'Editing enabled' : 'Read-only'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditVersionEnabled((v) => !v)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {isEditVersionEnabled ? 'Cancel edit' : 'Edit version'}
                  </button>
                </div>
                <input
                  value={editVersionNumber}
                  readOnly={!isEditVersionEnabled}
                  onChange={(e) => setEditVersionNumber(e.target.value)}
                  className={`mt-1 w-full rounded-md border border-boh-border-light dark:border-boh-border px-3 py-2 text-sm text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                    isEditVersionEnabled ? 'bg-boh-surface-light dark:bg-boh-bg' : 'bg-boh-bg-light dark:bg-boh-bg'
                  }`}
                />
                <div className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                  Displayed as <span className="font-mono">{formatVersionNumberForUi(editVersionNumber) || '—'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void handleSaveRelease()}
                disabled={isSaving}
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/80 disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void setReleaseStatus('in progress')}
                  disabled={isSaving}
                  className="inline-flex items-center rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg px-3 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text disabled:opacity-50"
                >
                  Mark In Progress
                </button>
                <button
                  type="button"
                  onClick={() => void setReleaseStatus('released')}
                  disabled={isSaving}
                  className="inline-flex items-center rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg px-3 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text disabled:opacity-50"
                >
                  Mark Released
                </button>
                <button
                  type="button"
                  onClick={() => void setReleaseStatus('deprecated')}
                  disabled={isSaving}
                  className="inline-flex items-center rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg px-3 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text disabled:opacity-50"
                >
                  Deprecate
                </button>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Tickets</div>
              {isLoadingTickets ? (
                <div className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading…</div>
              ) : tickets.length === 0 ? (
                <div className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">No tickets assigned.</div>
              ) : (
                <div className="mt-2 space-y-2">
                  {tickets.map((t) => (
                    <Link
                      key={t.id}
                      to={`/counter/tickets/${t.id}`}
                      className="block rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/60 dark:bg-boh-bg/40 px-3 py-2 hover:bg-boh-surface-light dark:hover:bg-boh-surface dark:hover:bg-boh-bg"
                    >
                      <div className="text-sm font-medium text-boh-text-light dark:text-boh-text truncate">
                        {t.ticket_number || 'Ticket'}{t.subject ? ` · ${t.subject}` : ''}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {t.status?.label && <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{t.status.label}</span>}
                        {t.priority?.label && <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">{t.priority.label}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="px-4 py-6 md:px-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pr-14 md:pr-0">
        <div>
          <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Release Command Center</div>
          <div className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">Plan, manage, and ship platform releases.</div>
        </div>
        <div className="flex md:justify-end">
          <button
            type="button"
            onClick={() => openNewRelease()}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            New Release
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/60 dark:bg-boh-bg/40 p-4">
              <div className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Current</div>
              {currentRelease ? (
                <button type="button" onClick={() => handleSelectRelease(currentRelease.id)} className="mt-2 w-full text-left">
                  <div className="text-lg font-semibold text-boh-text-light dark:text-boh-text truncate">{currentRelease.version_label}</div>
                  <div className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{releaseHeaderString(currentRelease)}</div>
                </button>
              ) : (
                <div className="mt-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">No release in progress.</div>
              )}
            </div>

            <div className="rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/60 dark:bg-boh-bg/40 p-4">
              <div className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Next Major</div>
              {nextMajorRelease ? (
                <button type="button" onClick={() => handleSelectRelease(nextMajorRelease.id)} className="mt-2 w-full text-left">
                  <div className="text-lg font-semibold text-boh-text-light dark:text-boh-text truncate">{nextMajorRelease.version_label}</div>
                  <div className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{releaseHeaderString(nextMajorRelease)}</div>
                </button>
              ) : (
                <div className="mt-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">No planned release.</div>
              )}
            </div>

            <div className="rounded-xl border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface/60 dark:bg-boh-bg/40 p-4">
              <div className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Next Minor</div>
              {nextMinorRelease ? (
                <button type="button" onClick={() => handleSelectRelease(nextMinorRelease.id)} className="mt-2 w-full text-left">
                  <div className="text-lg font-semibold text-boh-text-light dark:text-boh-text truncate">{nextMinorRelease.version_label}</div>
                  <div className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">{releaseHeaderString(nextMinorRelease)}</div>
                </button>
              ) : (
                <div className="mt-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">No planned release.</div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-boh-text-light dark:text-boh-text">Release Board</div>
            </div>

            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div className="inline-flex flex-wrap gap-2">
                {(['all', 'Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuarterTab(q)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      quarterTab === q
                        ? 'bg-primary text-white border-primary'
                        : 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text border-boh-border-light dark:border-boh-border'
                    }`}
                  >
                    {q === 'all' ? 'All' : q}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px]">
                  <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStatusFilter(value);
                      if (value === 'all') {
                        setActiveOnly(false);
                        setShowReleased(true);
                        setShowDeprecated(true);
                      }
                    }}
                    className="mt-1 w-full rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg px-3 py-2 text-sm text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="all">All</option>
                    <option value="planned">planned</option>
                    <option value="in progress">in progress</option>
                    <option value="released">released</option>
                    <option value="deprecated">deprecated</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-boh-text-light dark:text-boh-text">
                    <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
                    Active only
                  </label>
                </div>

                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-boh-text-light dark:text-boh-text">
                    <input
                      type="checkbox"
                      checked={showReleased}
                      disabled={statusFilter === 'all'}
                      onChange={(e) => setShowReleased(e.target.checked)}
                    />
                    Show released
                  </label>
                </div>

                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-boh-text-light dark:text-boh-text">
                    <input
                      type="checkbox"
                      checked={showDeprecated}
                      disabled={statusFilter === 'all'}
                      onChange={(e) => setShowDeprecated(e.target.checked)}
                    />
                    Show deprecated
                  </label>
                </div>
              </div>
            </div>

            <div className="hidden md:grid grid-cols-2 gap-4">
              <div>
                <div className="mb-2 text-sm font-semibold text-boh-text-light dark:text-boh-text">Major Releases</div>
                {isLoadingReleases ? (
                  <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading…</div>
                ) : releasesMajor.length === 0 ? (
                  <div className="text-boh-text-sub-light dark:text-boh-text-sub">No major releases found.</div>
                ) : (
                  <div className="space-y-2">
                    {releasesMajor.map((r) => (
                      <div key={r.id}>
                        <ReleaseCard r={r} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold text-boh-text-light dark:text-boh-text">Minor Releases</div>
                {isLoadingReleases ? (
                  <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading…</div>
                ) : releasesMinor.length === 0 ? (
                  <div className="text-boh-text-sub-light dark:text-boh-text-sub">No minor releases found.</div>
                ) : (
                  <div className="space-y-2">
                    {pagedMinor.map((r) => (
                      <div key={r.id}>
                        <ReleaseCard r={r} />
                      </div>
                    ))}
                    <div className="pt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setMinorPage((p) => Math.max(1, p - 1))}
                        disabled={minorPage <= 1}
                        className="inline-flex items-center rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg px-3 py-1.5 text-xs font-medium text-boh-text-light dark:text-boh-text disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        Page {minorPage} / {minorTotalPages}
                      </div>
                      <button
                        type="button"
                        onClick={() => setMinorPage((p) => Math.min(minorTotalPages, p + 1))}
                        disabled={minorPage >= minorTotalPages}
                        className="inline-flex items-center rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg px-3 py-1.5 text-xs font-medium text-boh-text-light dark:text-boh-text disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="md:hidden">
              <div className="mb-3 inline-flex w-full rounded-lg bg-boh-surface-light dark:bg-boh-surface p-1">
                <button
                  type="button"
                  onClick={() => setActiveTierTab('major')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    activeTierTab === 'major'
                      ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub'
                  }`}
                >
                  Major
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTierTab('minor')}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    activeTierTab === 'minor'
                      ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub'
                  }`}
                >
                  Minor
                </button>
              </div>
              {(activeTierTab === 'major' ? releasesMajor : releasesMinor).map((r) => (
                <div key={r.id} className="mb-2">
                  <ReleaseCard r={r} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          <DetailPanel isMobilePanel={false} />
        </div>
      </div>

      {isMobile && isDetailOpenMobile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-boh-surface-light dark:bg-boh-surface p-4 shadow-xl">
            <DetailPanel isMobilePanel={true} />
          </div>
        </div>
      )}

      <Dialog open={isNewReleaseOpen} onOpenChange={setIsNewReleaseOpen}>
        <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-boh-surface-light dark:bg-boh-surface p-4 shadow-xl border border-boh-border-light dark:border-boh-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Add Ad-hoc Release</div>
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Create a future planned release.</div>
            </div>
            <button
              type="button"
              onClick={() => setIsNewReleaseOpen(false)}
              className="inline-flex items-center justify-center rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg h-9 w-9 text-boh-text-light dark:text-boh-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 5L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Tier (required)</div>
              <div className="mt-2 inline-flex w-full rounded-lg bg-boh-surface-light dark:bg-boh-surface p-1">
                <button
                  type="button"
                  onClick={() => setCreateTier('major')}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    createTier === 'major'
                      ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub'
                  }`}
                >
                  Major
                </button>
                <button
                  type="button"
                  onClick={() => setCreateTier('minor')}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    createTier === 'minor'
                      ? 'bg-boh-surface-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text shadow-sm'
                      : 'text-boh-text-sub-light dark:text-boh-text-sub'
                  }`}
                >
                  Minor
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Release date (required)</label>
              <input
                type="date"
                value={createReleaseDate}
                onChange={(e) => setCreateReleaseDate(e.target.value)}
                disabled={!createTier}
                className={`mt-1 w-full rounded-md border border-boh-border-light dark:border-boh-border px-3 py-2 text-sm text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                  createTier ? 'bg-boh-surface-light dark:bg-boh-bg' : 'bg-boh-bg-light dark:bg-boh-bg'
                }`}
              />
              {!createTier && (
                <div className="mt-1 text-xs text-boh-text-sub-light dark:text-boh-text-sub">Select a tier to enable date selection.</div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub">Notes (optional)</label>
              <textarea
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg px-3 py-2 text-sm text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsNewReleaseOpen(false)}
              className="inline-flex items-center rounded-md border border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-bg px-3 py-2 text-sm font-medium text-boh-text-light dark:text-boh-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleCreateRelease()}
              disabled={isCreating || !createTier || !createReleaseDate.trim()}
              className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/80 disabled:opacity-50"
            >
              {isCreating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  );
};

export default ReleasesPage;


import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useProductData } from '../../../../hooks/useProductData';
import { useBohAccess } from '../../../../shared/hooks/useBohAccess';
import { supabase } from '../../../../lib/supabase';
import Toast from '../../../../components/Toast';
import MenuFilterDropdown from '../../shared/components/FilterDropdown';
import {
  ReleasesLayout,
  ReleaseTier,
  ReleaseQuarterFilter,
  ReleaseVersionUsageRow,
  TicketRow,
  InitiativeRow,
  InitiativesByReleaseId,
  QUARTER_FILTERS,
  QUARTER_LABELS,
  parseIsoDate,
  formatReleaseDateForUi,
  formatVersionNumberForUi,
  formatEnvironmentLabel,
  getEnvironmentGroup,
  isInProgressStatus,
  isReleasedStatus,
  normalizeReleaseStatus,
} from '../components';

type ReleaseScopeFilter = {
  includePast: boolean;
  includeFuture: boolean;
};

const getCurrentQuarterFilter = (): ReleaseQuarterFilter => {
  const month = new Date().getMonth();
  if (month < 3) return 'Q1';
  if (month < 6) return 'Q2';
  if (month < 9) return 'Q3';
  return 'Q4';
};

const getCurrentReleaseYear = () => new Date().getFullYear();

const ForgeManagement: React.FC = () => {
  const navigate = useNavigate();
  const access = useBohAccess();
  const tenantId = access.bohUser?.tenant_id ?? null;
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'overview' | 'workstreams' | 'internal-releases' | 'external-releases'>('overview');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');

  // Sync activeTab with URL path for sidebar navigation
  useEffect(() => {
    const path = location.pathname;
    if (path === '/forge' || path === '/forge/' || path === '/forge/overview') {
      setActiveTab('overview');
    } else if (path === '/forge/workstreams' || path.startsWith('/forge/workstreams/')) {
      setActiveTab('workstreams');
    } else if (path === '/forge/internal-releases') {
      setActiveTab('internal-releases');
    } else if (path === '/forge/external-releases') {
      setActiveTab('external-releases');
    }
  }, [location.pathname]);

  // ReleasesPage state
  const [releasesData, setReleasesData] = useState<ReleaseVersionUsageRow[]>([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string>('');
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [initiativesByReleaseId, setInitiativesByReleaseId] = useState<InitiativesByReleaseId>({});
  const [isLoadingInitiatives, setIsLoadingInitiatives] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [activeReleaseTier, setActiveReleaseTier] = useState<{ internal: ReleaseTier; external: ReleaseTier }>({
    internal: 'major',
    external: 'major',
  });
  const [releaseQuarterFilter, setReleaseQuarterFilter] = useState<{ internal: ReleaseQuarterFilter; external: ReleaseQuarterFilter }>({
    internal: getCurrentQuarterFilter(),
    external: getCurrentQuarterFilter(),
  });
  const [releaseScopeFilter, setReleaseScopeFilter] = useState<{ internal: ReleaseScopeFilter; external: ReleaseScopeFilter }>({
    internal: { includePast: false, includeFuture: false },
    external: { includePast: false, includeFuture: false },
  });

  // Workstream-specific state
  const [selectedWorkstream, setSelectedWorkstream] = useState<any>(null);
  const [workstreamDetails, setWorkstreamDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [workstreams, setWorkstreams] = useState<any[]>([]);
  const [isLoadingWorkstreams, setIsLoadingWorkstreams] = useState(false);

  // Workstream-specific helper function - must be defined before use
  const calculateRiskLevel = (workstream: any, linkedReleases: any[]) => {
    let riskScore = 0;
    
    // Check for assignment
    if (!workstream.assigned_to && !workstream.assigned_user) riskScore += 2;
    
    // Check for releases
    if (linkedReleases.length === 0) riskScore += 2;
    
    // Check status
    if (workstream.status === 'blocked') riskScore += 3;
    
    // Check scheduling
    const hasQuarter = workstream.target_quarter || workstream.initiative?.target_quarter;
    const hasYear = workstream.target_year || workstream.initiative?.target_year;
    if (!hasQuarter || !hasYear) riskScore += 1;
    
    // Check progress
    if (workstream.progress < 25) riskScore += 1;
    
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  };

  const { 
    overview, 
    initiatives, 
    releases, 
    isLoading: isLoadingData, 
    overviewError 
  } = useProductData();

  const filteredInitiatives = (initiatives?.data || []).filter(initiative => 
    initiative && 
    initiative.target_quarter === selectedQuarter && 
    initiative.target_year === selectedYear
  );

  // Enhanced workstream data with release and ownership information
  const enrichedWorkstreams = useMemo(() => {
    if (!workstreams || workstreams.length === 0) return [];
    
    return workstreams.map(workstream => {
      const linkedReleases = releases?.data?.filter((release: any) => 
        release.major_release_id === workstream.initiative_id || 
        release.initiative_id === workstream.initiative_id
      ) || [];
      
      return {
        ...workstream,
        title: workstream.title || workstream.initiative?.title || 'Untitled Workstream',
        app_id: workstream.app_id || workstream.initiative?.app_id,
        boh_app: workstream.boh_app || workstream.initiative?.boh_app,
        target_quarter: workstream.target_quarter || workstream.initiative?.target_quarter,
        target_year: workstream.target_year || workstream.initiative?.target_year,
        linkedReleases,
        linkedReleaseCount: linkedReleases.length,
        hasMajorRelease: linkedReleases.some((r: any) => r.release_tier === 'major'),
        hasOwner: !!workstream.assigned_to || !!workstream.assigned_user,
        isBlocked: workstream.status === 'blocked',
        isUnscheduled: !workstream.target_quarter && !workstream.initiative?.target_quarter,
        riskLevel: calculateRiskLevel(workstream, linkedReleases)
      };
    });
  }, [workstreams, releases]);

  const normalizeReleaseTier = (tier?: string | null): ReleaseTier =>
    (tier || '').trim().toLowerCase() === 'minor' ? 'minor' : 'major';

  const sortReleasesChronologically = (a: ReleaseVersionUsageRow, b: ReleaseVersionUsageRow) => {
    const aIso = (a.release_date || a.sort_date || '').slice(0, 10);
    const bIso = (b.release_date || b.sort_date || '').slice(0, 10);
    const aDate = aIso ? parseIsoDate(aIso) : null;
    const bDate = bIso ? parseIsoDate(bIso) : null;
    if (aDate && bDate) return aDate.getTime() - bDate.getTime();
    if (aDate) return -1;
    if (bDate) return 1;
    return (a.version_label || '').localeCompare(b.version_label || '');
  };

  const deriveReleaseQuarter = (release: ReleaseVersionUsageRow): ReleaseQuarterFilter => {
    const explicit = (release.release_cycle || '').trim().toUpperCase();
    if (QUARTER_FILTERS.includes(explicit as ReleaseQuarterFilter)) {
      return explicit as ReleaseQuarterFilter;
    }

    const iso = (release.release_date || '').slice(0, 10);
    if (iso) {
      const parsed = parseIsoDate(iso);
      if (parsed) {
        const month = parsed.getMonth();
        const quarterIndex = Math.floor(month / 3);
        return (['Q1', 'Q2', 'Q3', 'Q4'][quarterIndex] || 'all') as ReleaseQuarterFilter;
      }
    }

    return 'all';
  };

  const deriveReleaseYear = (release: ReleaseVersionUsageRow): number | null => {
    if (Number.isFinite(release.release_year as number)) {
      return release.release_year as number;
    }

    const iso = (release.release_date || '').slice(0, 10);
    if (iso) {
      const parsed = parseIsoDate(iso);
      if (parsed) return parsed.getFullYear();
    }

    return null;
  };

  const currentReleaseContext = useMemo(() => {
    const resolveContext = (env: 'internal' | 'external') => {
      const majorReleases = releasesData
        .filter((release) => getEnvironmentGroup(release.environment) === env && normalizeReleaseTier(release.release_tier) === 'major')
        .sort(sortReleasesChronologically);

      const activeMajor = majorReleases.find((release) => isInProgressStatus(release.status))
        || majorReleases.find((release) => !isReleasedStatus(release.status))
        || null;

      if (!activeMajor) {
        return {
          quarter: getCurrentQuarterFilter(),
          year: getCurrentReleaseYear(),
        };
      }

      return {
        quarter: deriveReleaseQuarter(activeMajor),
        year: deriveReleaseYear(activeMajor) ?? getCurrentReleaseYear(),
      };
    };

    return {
      internal: resolveContext('internal'),
      external: resolveContext('external'),
    };
  }, [releasesData]);

  useEffect(() => {
    setReleaseQuarterFilter((prev) => {
      let next = prev;

      (['internal', 'external'] as const).forEach((env) => {
        const scope = releaseScopeFilter[env];
        const currentQuarter = currentReleaseContext[env].quarter;
        if (!scope.includePast && !scope.includeFuture && prev[env] !== currentQuarter) {
          next = next === prev ? { ...prev } : next;
          next[env] = currentQuarter;
        }
      });

      return next;
    });
  }, [currentReleaseContext, releaseScopeFilter]);

  const loadWorkstreams = async () => {
    if (!tenantId) {
      console.warn('[loadWorkstreams] Missing BOH tenant; skipping load.');
      return;
    }
    setIsLoadingWorkstreams(true);
    try {
      const { data, error } = await supabase
        .from('boh_workstream')
        .select(`
          *,
          initiative:boh_initiative(
            id,
            title,
            description,
            target_quarter,
            target_year,
            app_id,
            boh_app(id, name, slug)
          ),
          assigned_user:boh_user!boh_workstream_assigned_to_fkey(
            id,
            full_name,
            email
          ),
          created_by_user:boh_user!boh_workstream_created_by_fkey(
            id,
            full_name
          ),
          workstream_approval:boh_workstream_approval(
            id,
            status,
            requested_by,
            reviewed_by,
            requested_at,
            reviewed_at,
            review_notes
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ForgeManagement] Error loading workstreams:', error);
        setWorkstreams([]);
        return;
      }

      const validData = (data || []).filter(workstream => {
        // Basic validation
        if (!workstream || typeof workstream !== 'object') return false;
        
        // Filter by quarter/year using initiative data (workstream doesn't have these fields)
        const initiative = workstream.initiative;
        if (!initiative) {
          return false;
        }
        
        const quarter = initiative.target_quarter;
        const year = initiative.target_year;
        return quarter === selectedQuarter && year === selectedYear;
      });

      setWorkstreams(validData);
    } catch (err) {
      console.error('[ForgeManagement] Network error loading workstreams:', err);
      setWorkstreams([]);
    } finally {
      setIsLoadingWorkstreams(false);
    }
  };

  const loadWorkstreamDetails = async (workstream: any) => {
    setSelectedWorkstream(workstream);
    setIsLoadingDetails(true);
    
    try {
      // Get additional details for the selected workstream
      const { data: details, error } = await supabase
        .from('boh_workstream')
        .select(`
          *,
          initiative:boh_initiative!initiative_id(
            id,
            title,
            description,
            target_quarter,
            target_year,
            app_id,
            boh_app(id, name, slug),
            owner_user:boh_user(id, full_name, email),
            status_info:boh_initiative_status(id, key, label, color_token),
            planning_stage_info:boh_initiative_planning_stage(id, key, label, color_token)
          ),
          assigned_user:boh_user!boh_workstream_assigned_to_fkey(id, full_name, email),
          created_by_user:boh_user!boh_workstream_created_by_fkey(id, full_name),
          workstream_approval:boh_workstream_approval(
            id,
            status,
            requested_by,
            reviewed_by,
            requested_at,
            reviewed_at,
            review_notes
          ),
          boh_user_story(count),
          counter_ticket(count)
        `)
        .eq('id', workstream.id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('[ForgeManagement] Error loading workstream details:', error);
        setWorkstreamDetails(null);
      } else {
        setWorkstreamDetails(details);
      }
    } catch (err) {
      console.error('[ForgeManagement] Network error loading workstream details:', err);
      setWorkstreamDetails(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Load workstreams when quarter/year changes
  useEffect(() => {
    loadWorkstreams();
  }, [selectedQuarter, selectedYear, tenantId]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setIsToastVisible(true);
  };

  const updateReleaseStatus = async (releaseId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('boh_release_version')
        .update({ status: newStatus })
        .eq('id', releaseId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('[ForgeManagement] Error updating release status:', error);
        showToast('Failed to update release status');
        return false;
      }

      setReleasesData((prev) => prev.map((r) => (r.id === releaseId ? { ...r, status: newStatus } : r)));
      showToast('Release status updated');
      return true;
    } catch (err) {
      console.error('[ForgeManagement] Network error updating release status:', err);
      showToast('Failed to update release status');
      return false;
    }
  };

  const CLOSED_WORK_STATUS_KEYWORDS = ['done', 'complete', 'completed', 'cancelled', 'released'];

  const isActiveWorkStatus = (status?: string | null) => {
    const value = (status || '').trim().toLowerCase();
    if (!value) return true;
    return !CLOSED_WORK_STATUS_KEYWORDS.some((keyword) => value.includes(keyword));
  };

  const hydrateTicketCounts = async (rows: ReleaseVersionUsageRow[]): Promise<ReleaseVersionUsageRow[]> => {
    const ids = rows.map((r) => r.id).filter(Boolean);
    if (ids.length === 0) return rows;

    const { data, error } = await supabase
      .from('counter_ticket')
      .select(`
        release_version_id,
        status:counter_ticket_status!counter_ticket_status_id_fkey(key, label)
      `)
      .in('release_version_id', ids)
      .limit(10000);

    if (error) {
      console.error('[ForgeManagement] Failed to hydrate ticket counts', error);
      return rows.map((r) => ({ ...r, ticket_count: 0, active_ticket_count: 0 }));
    }

    const counts = new Map<string, number>();
    const activeCounts = new Map<string, number>();
    for (const row of data || []) {
      if (row.release_version_id) {
        counts.set(row.release_version_id, (counts.get(row.release_version_id) ?? 0) + 1);
        const status = Array.isArray(row.status) ? row.status[0] : row.status;
        if (isActiveWorkStatus(status?.key || status?.label)) {
          activeCounts.set(row.release_version_id, (activeCounts.get(row.release_version_id) ?? 0) + 1);
        }
      }
    }

    return rows.map((r) => ({
      ...r,
      ticket_count: counts.get(r.id) ?? 0,
      active_ticket_count: activeCounts.get(r.id) ?? 0,
    }));
  };

  const hydrateMajorTaskCounts = async (initiativesByRelease: InitiativesByReleaseId): Promise<Record<string, number>> => {
    const initiativeToRelease = new Map<string, string>();
    Object.entries(initiativesByRelease).forEach(([releaseId, initiatives]) => {
      initiatives.forEach((initiative) => initiativeToRelease.set(initiative.id, releaseId));
    });

    const initiativeIds = Array.from(initiativeToRelease.keys());
    if (initiativeIds.length === 0) return {};

    const { data: stories, error: storiesError } = await supabase
      .from('boh_user_story')
      .select('id, initiative_id')
      .in('initiative_id', initiativeIds)
      .limit(10000);

    if (storiesError || !stories?.length) {
      if (storiesError) console.warn('[ForgeManagement] Error loading stories for release task counts', storiesError);
      return {};
    }

    const storyToRelease = new Map<string, string>();
    stories.forEach((story) => {
      const releaseId = initiativeToRelease.get(story.initiative_id);
      if (releaseId) storyToRelease.set(story.id, releaseId);
    });

    const storyIds = Array.from(storyToRelease.keys());
    if (storyIds.length === 0) return {};

    const { data: tasks, error: tasksError } = await supabase
      .from('boh_task')
      .select('user_story_id, status')
      .eq('tenant_id', tenantId)
      .in('user_story_id', storyIds)
      .limit(10000);

    if (tasksError) {
      console.warn('[ForgeManagement] Error loading tasks for release task counts', tasksError);
      return {};
    }

    return (tasks || []).reduce((acc, task) => {
      const releaseId = storyToRelease.get(task.user_story_id);
      if (releaseId && isActiveWorkStatus(task.status)) {
        acc[releaseId] = (acc[releaseId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  };

  const hydrateInitiatives = async (rows: ReleaseVersionUsageRow[]): Promise<InitiativesByReleaseId> => {
    const majorReleaseIds = rows.filter((r) => r.release_tier === 'major').map((r) => r.id).filter(Boolean);
    if (majorReleaseIds.length === 0) return {};

    setIsLoadingInitiatives(true);
    try {
      const { data, error } = await supabase
        .from('boh_initiative')
        .select(`id, title, description, status, target_quarter, target_year, progress, major_release_id, app_id, owner:boh_user!owner_user_id(id, full_name, email), app:boh_app(id, name), created_at, updated_at`)
        .eq('tenant_id', tenantId)
        .in('major_release_id', majorReleaseIds)
        .limit(10000);

      if (error) {
        console.error('[ForgeManagement] Error fetching initiatives:', error);
        return {};
      }

      const grouped: InitiativesByReleaseId = {};
      for (const initiative of (data || []) as any) {
        const releaseId = initiative.major_release_id;
        if (releaseId) {
          if (!grouped[releaseId]) {
            grouped[releaseId] = [];
          }
          const ownerData = initiative.owner;
          const appData = initiative.app;
          grouped[releaseId].push({
            ...initiative,
            owner_name: ownerData?.full_name || null,
            owner_email: ownerData?.email || null,
            app_name: appData?.name || null,
          });
        }
      }

      return grouped;
    } finally {
      setIsLoadingInitiatives(false);
    }
  };

  const loadReleases = async () => {
    if (!tenantId) {
      console.warn('[loadReleases] Missing BOH tenant; skipping load.');
      return;
    }
    setIsLoadingReleases(true);
    try {
      // Fetch releases grouped by tier/environment so numbers are always accurate
      const { data, error } = await supabase
        .from('boh_release_version')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('sort_date', { ascending: false });

      if (error) {
        console.error('[ForgeManagement] Error loading releases', error);
        setReleasesData([]);
        setSelectedReleaseId('');
        setTickets([]);
        return;
      }

      const rows = await hydrateTicketCounts((data || []) as ReleaseVersionUsageRow[]);

      // Fetch initiatives and task activity for major releases
      const initiatives = await hydrateInitiatives(rows);
      const activeTaskCounts = await hydrateMajorTaskCounts(initiatives);

      const rowsWithActivity = rows.map((release) => {
        const releaseInitiatives = initiatives[release.id] || [];
        return {
          ...release,
          initiative_count: releaseInitiatives.length,
          active_task_count: activeTaskCounts[release.id] || 0,
        };
      });

      setReleasesData(rowsWithActivity);
      setInitiativesByReleaseId(initiatives);

      if (rows.length === 0) {
        setSelectedReleaseId('');
        setTickets([]);
      }
    } finally {
      setIsLoadingReleases(false);
    }
  };

  const loadTickets = async () => {
    if (!tenantId) {
      console.warn('[loadTickets] Missing BOH tenant; skipping load.');
      return;
    }
    if (!selectedReleaseId) {
      setTickets([]);
      return;
    }

    const release = releasesData.find((r) => r.id === selectedReleaseId);
    if (release && release.release_tier === 'major') {
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
        .eq('tenant_id', tenantId)
        .eq('release_version_id', selectedReleaseId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[ForgeManagement] Error loading tickets for release', error);
        setTickets([]);
        return;
      }

      setTickets((data || []) as unknown as TicketRow[]);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const isFutureRelease = (release: ReleaseVersionUsageRow) => {
    const iso = (release.release_date || release.sort_date || '').slice(0, 10);
    if (!iso) return false;
    const releaseDate = parseIsoDate(iso);
    if (!releaseDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return releaseDate.getTime() > today.getTime();
  };

  const shouldShowReleaseForScope = (
    release: ReleaseVersionUsageRow,
    scope: ReleaseScopeFilter,
    quarterFilter: ReleaseQuarterFilter,
    releaseCycle: ReleaseQuarterFilter,
    releaseYear: number | null,
    currentContext: { quarter: ReleaseQuarterFilter; year: number },
  ) => {
    if (isReleasedStatus(release.status)) {
      return scope.includePast;
    }

    if (
      quarterFilter === currentContext.quarter
      && releaseCycle === quarterFilter
      && releaseYear === currentContext.year
    ) {
      return true;
    }

    if (isFutureRelease(release)) {
      return scope.includeFuture;
    }

    return true;
  };

  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'internal-releases' || activeTab === 'external-releases') {
      loadReleases();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'internal-releases' || activeTab === 'external-releases') {
      loadTickets();
    }
  }, [selectedReleaseId, activeTab]);

  const groupedReleases = useMemo(() => {
    const initial = {
      internal: {
        major: [] as ReleaseVersionUsageRow[],
        minor: [] as ReleaseVersionUsageRow[],
      },
      external: {
        major: [] as ReleaseVersionUsageRow[],
        minor: [] as ReleaseVersionUsageRow[],
      },
    };

    for (const release of releasesData) {
      const envGroup = getEnvironmentGroup(release.environment);
      if (envGroup === 'internal' || envGroup === 'external') {
        const quarterFilter = releaseQuarterFilter[envGroup];
        const releaseCycle = deriveReleaseQuarter(release);
        if (quarterFilter !== 'all' && releaseCycle !== quarterFilter) continue;
        const releaseYear = deriveReleaseYear(release);

        const scopeFilter = releaseScopeFilter[envGroup];
        if (!shouldShowReleaseForScope(release, scopeFilter, quarterFilter, releaseCycle, releaseYear, currentReleaseContext[envGroup])) {
          continue;
        }

        const tier = normalizeReleaseTier(release.release_tier);
        initial[envGroup][tier].push(release);
      }
    }

    (['internal', 'external'] as const).forEach((env) => {
      (['major', 'minor'] as ReleaseTier[]).forEach((tier) => {
        initial[env][tier] = initial[env][tier].sort(sortReleasesChronologically);
      });
    });

    return initial;
  }, [releasesData, releaseQuarterFilter, releaseScopeFilter, currentReleaseContext]);

  const getReleasesForView = (env: 'internal' | 'external') =>
    groupedReleases[env][activeReleaseTier[env]];

  useEffect(() => {
    if (activeTab !== 'internal-releases' && activeTab !== 'external-releases') return;

    const env = activeTab === 'internal-releases' ? 'internal' : 'external';
    const tier = activeReleaseTier[env];
    const releasesForTab = groupedReleases[env][tier];

    if (releasesForTab.length === 0) {
      setSelectedReleaseId('');
      return;
    }

    if (!selectedReleaseId || !releasesForTab.some((release) => release.id === selectedReleaseId)) {
      setSelectedReleaseId(releasesForTab[0].id);
    }
  }, [activeTab, activeReleaseTier, groupedReleases, selectedReleaseId, releaseQuarterFilter, releaseScopeFilter]);

  const selectedRelease = useMemo(() => releasesData.find((r) => r.id === selectedReleaseId) || null, [releasesData, selectedReleaseId]);

  const selectedReleaseChildren = useMemo(() => {
    if (!selectedRelease || selectedRelease.release_tier !== 'major') return [];
    return releasesData
      .filter((release) => release.parent_major_release_id === selectedRelease.id)
      .sort(sortReleasesChronologically);
  }, [selectedRelease, releasesData]);

  const getMajorReleaseInitiativeCount = (releaseId: string) => {
    return initiativesByReleaseId[releaseId]?.length || 0;
  };

  const getMajorReleaseInitiatives = (releaseId: string) => {
    return initiativesByReleaseId[releaseId] || [];
  };

  const getMajorReleaseChildCount = (releaseId: string) => {
    return releasesData.filter((r) => r.parent_major_release_id === releaseId).length;
  };

  const selectedReleaseEnvGroup = selectedRelease ? getEnvironmentGroup(selectedRelease.environment) : 'unknown';
  const selectedReleaseEnvLabel = selectedRelease ? formatEnvironmentLabel(selectedRelease.environment) : 'Unknown';
  const selectedReleaseEnvChipClasses =
    selectedReleaseEnvGroup === 'external'
      ? 'bg-sky-100 text-sky-800 dark:bg-sky-800 dark:text-sky-200'
      : selectedReleaseEnvGroup === 'internal'
      ? 'bg-violet-100 text-violet-800 dark:bg-violet-800 dark:text-violet-100'
      : 'bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text';

  const renderReleaseSupportCard = () => {
    if (!selectedRelease) return null;

    if (selectedRelease.release_tier === 'major') {
      return (
        <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl">
          <div className="p-4 border-b border-boh-border-light dark:border-boh-border">
            <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Linked Minor Releases</h3>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
              Minor releases associated with this major release
            </p>
          </div>
          <div className="p-4">
            {selectedReleaseChildren.length > 0 ? (
              <div className="space-y-3">
                {selectedReleaseChildren.map((child) => (
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
                        <span className={`inline-flex items-center rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium ${
                          isInProgressStatus(child.status)
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
                            : isReleasedStatus(child.status)
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200'
                            : 'bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text'
                        }`}>
                          {child.status || 'unknown'}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium ${
                          child.release_tier === 'minor'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200'
                        }`}>
                          {child.release_tier}
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
      );
    }

    return (
      <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl">
        <div className="p-4 border-b border-boh-border-light dark:border-boh-border">
          <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Assigned Tickets</h3>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
            Tickets assigned to this release
          </p>
        </div>
        <div className="p-4">
          {isLoadingTickets ? (
            <div className="text-center py-8">
              <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading tickets...</div>
            </div>
          ) : tickets.length > 0 ? (
            <div className="space-y-3">
              {sortedTicketsByPriority.map((ticket) => (
                <div
                  key={ticket.id}
                  className="border border-boh-border-light dark:border-boh-border rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-boh-text-light dark:text-boh-text">
                          #{ticket.ticket_number || ticket.id.slice(0, 8).toUpperCase()}
                        </span>
                        {ticket.status && (
                          <span className="inline-flex items-center rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text">
                            {ticket.status.label || ticket.status.key}
                          </span>
                        )}
                        {ticket.priority && (
                          <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${
                            ticket.priority.weight <= 2
                              ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                              : ticket.priority.weight <= 4
                              ? 'bg-violet-100 text-violet-800 dark:bg-violet-800 dark:text-violet-100'
                              : 'bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text'
                          }`}>
                            {ticket.priority.label}
                          </span>
                        )}
                        {isTicketReleaseReady(ticket) && (
                          <span className="inline-flex items-center rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200">
                            Ready
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-boh-text-light dark:text-boh-text mb-1">
                        {ticket.subject || 'No subject'}
                      </div>
                      {ticket.requester_name && (
                        <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                          From: {ticket.requester_name}
                          {ticket.requester_email && ` <${ticket.requester_email}>`}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-boh-text-sub-light dark:text-boh-text-sub">No tickets assigned to this release</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const CLOSED_STATUS_KEYWORDS = ['closed', 'resolved', 'done', 'complete', 'fixed', 'released'];

  const isTicketReleaseReady = (ticket: TicketRow) => {
    const key = (ticket.status?.key || '').toLowerCase();
    const label = (ticket.status?.label || '').toLowerCase();
    return CLOSED_STATUS_KEYWORDS.some((keyword) => key.includes(keyword) || label.includes(keyword));
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
    const descriptor = ticket.status?.label?.trim() || ticket.status?.key?.trim() || 'Status unknown';
    return `${identifier} — Open (${descriptor}): ${normalized}`;
  };

  const releaseSummary = useMemo(() => {
    if (!selectedRelease || selectedRelease.release_tier !== 'minor') return '';

    const releaseName = selectedRelease.version_label?.trim() || 'Minor Release';
    const minorVersion = formatVersionNumberForUi(selectedRelease.version_number);
    const minorDateLine = selectedRelease.release_candidate_date || selectedRelease.release_date
      ? `Release candidate: ${formatReleaseDateForUi(selectedRelease.release_candidate_date || selectedRelease.release_date)}`
      : 'Release candidate: date TBD';

    const parentMajor = selectedRelease.parent_major_release_id 
      ? releasesData.find((r) => r.id === selectedRelease.parent_major_release_id)
      : null;

    const majorName = parentMajor?.version_label?.trim() || 'Major Release';
    const majorVersion = formatVersionNumberForUi(parentMajor?.version_number);
    const majorReleaseDate = parentMajor?.release_candidate_date || parentMajor?.release_date
      ? formatReleaseDateForUi(parentMajor.release_candidate_date || parentMajor.release_date)
      : 'date TBD';

    const updatesHeading = isReleasedStatus(selectedRelease.status) ? '**Release notes**' : '**Release summary**';

    const sortedClosedTickets = tickets
      .filter(isTicketReleaseReady)
      .sort((a, b) => {
        const aNum = Number.parseInt((a.ticket_number || '').replace(/[^\d]/g, ''), 10) || Number.MAX_SAFE_INTEGER;
        const bNum = Number.parseInt((b.ticket_number || '').replace(/[^\d]/g, ''), 10) || Number.MAX_SAFE_INTEGER;
        return aNum - bNum;
      });

    const sortedOutstandingTickets = tickets
      .filter((ticket) => !isTicketReleaseReady(ticket))
      .sort((a, b) => {
        const aNum = Number.parseInt((a.ticket_number || '').replace(/[^\d]/g, ''), 10) || Number.MAX_SAFE_INTEGER;
        const bNum = Number.parseInt((b.ticket_number || '').replace(/[^\d]/g, ''), 10) || Number.MAX_SAFE_INTEGER;
        return aNum - bNum;
      });

    const lines = [
      `${releaseName} (Minor Release ${minorVersion})`,
      `${updatesHeading}`,
      minorDateLine,
      '',
      ...(sortedClosedTickets.length > 0
        ? [
            '**Completed / Resolved**',
            ...sortedClosedTickets.map(buildTicketReleaseLine),
          ]
        : ['**Completed / Resolved**', 'None']),
      '',
      ...(sortedOutstandingTickets.length > 0
        ? [
            '**Outstanding / In Flight**',
            ...sortedOutstandingTickets.map(buildTicketOutstandingLine),
          ]
        : ['**Outstanding / In Flight**', 'None']),
      '',
    ];

    if (parentMajor) {
      const isMinorReleased = isReleasedStatus(selectedRelease.status);
      const isMajorReleased = parentMajor ? isReleasedStatus(parentMajor.status) : false;
      const majorDateLine = isMajorReleased 
        ? `Culminating in ${majorName} (Major Release ${majorVersion} — released ${majorReleaseDate})`
        : `Leading into ${majorName} (Major Release ${majorVersion} — releasing ${majorReleaseDate})`;
      lines.push(majorDateLine);
    }

    return lines.join('\n');
  }, [selectedRelease, tickets, releasesData]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text';
      case 'in progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200';
      case 'blocked': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200';
      case 'done': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200';
      case 'cancelled': return 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub dark:bg-boh-surface dark:text-boh-text-sub';
      default: return 'bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text';
    }
  };

  const getTypeColor = (tier: string) => {
    switch (tier) {
      case 'major': return 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200';
      case 'minor': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200';
      default: return 'bg-boh-surface-light dark:bg-boh-surface dark:text-boh-text';
    }
  };

  const getReleaseControlClassName = (isActive: boolean) =>
    `min-h-9 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'border-primary text-boh-text-light dark:text-boh-text'
        : 'border-transparent text-boh-text-sub-light dark:text-boh-text-sub hover:border-boh-primary/60 hover:text-boh-text-light dark:hover:text-boh-text'
    }`;

  const renderScopeFilter = (env: 'internal' | 'external') => {
    const currentQuarter = currentReleaseContext[env].quarter;
    const scope = releaseScopeFilter[env];
    const isCurrentSelected = releaseQuarterFilter[env] === currentQuarter && !scope.includePast && !scope.includeFuture;

    return (
      <div className="flex items-center gap-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
        <span>Scope:</span>
        <div className="flex gap-2">
          {([
            { key: 'current' as const, label: 'Current', isActive: isCurrentSelected },
            { key: 'past' as const, label: 'Include past', isActive: scope.includePast },
            { key: 'future' as const, label: 'Include future', isActive: scope.includeFuture },
          ]).map((option) => (
            <button
              key={option.key}
              onClick={() => {
                if (option.key === 'current') {
                  setReleaseScopeFilter((prev) => ({
                    ...prev,
                    [env]: { includePast: false, includeFuture: false },
                  }));
                  setReleaseQuarterFilter((prev) => ({
                    ...prev,
                    [env]: currentQuarter,
                  }));
                  return;
                }

                setReleaseScopeFilter((prev) => {
                  const current = prev[env];
                  const next = option.key === 'past'
                    ? { ...current, includePast: !current.includePast }
                    : { ...current, includeFuture: !current.includeFuture };
                  return { ...prev, [env]: next };
                });
                setReleaseQuarterFilter((prev) => ({
                  ...prev,
                  [env]: 'all',
                }));
              }}
              className={getReleaseControlClassName(option.isActive)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const overviewReleaseCards = useMemo(() => {
    const activeStatuses = ['planned', 'in progress', 'development', 'testing', 'ready'];
    const nextFor = (environment: 'internal' | 'external', tier: ReleaseTier) =>
      releasesData
        .filter((release) => {
          const envGroup = getEnvironmentGroup(release.environment);
          const normalizedTier = normalizeReleaseTier(release.release_tier);
          const status = normalizeReleaseStatus(release.status);
          return envGroup === environment && normalizedTier === tier && activeStatuses.includes(status);
        })
        .sort(sortReleasesChronologically)[0] || null;

    return [
      { key: 'external-major', label: 'External Major', release: nextFor('external', 'major') },
      { key: 'external-minor', label: 'External Minor', release: nextFor('external', 'minor') },
      { key: 'internal-major', label: 'Internal Major', release: nextFor('internal', 'major') },
      { key: 'internal-minor', label: 'Internal Minor', release: nextFor('internal', 'minor') },
    ];
  }, [releasesData]);

  const releasePipelineSummary = useMemo(() => {
    const activeReleases = releasesData.filter((release) => !isReleasedStatus(release.status));
    return [
      {
        name: 'Planned',
        count: activeReleases.filter((release) => normalizeReleaseStatus(release.status) === 'planned').length,
        tone: 'bg-boh-surface-light dark:bg-boh-surface',
      },
      {
        name: 'In Progress',
        count: activeReleases.filter((release) => isInProgressStatus(release.status)).length,
        tone: 'bg-blue-500',
      },
      {
        name: 'Releases With Tickets',
        count: activeReleases.filter((release) => (release.ticket_count || 0) > 0).length,
        tone: 'bg-boh-primary',
      },
      {
        name: 'Released',
        count: releasesData.filter((release) => isReleasedStatus(release.status)).length,
        tone: 'bg-green-500',
      },
    ];
  }, [releasesData]);

  const recentReleasedReleases = useMemo(
    () =>
      releasesData
        .filter((release) => isReleasedStatus(release.status))
        .sort((a, b) => {
          const aIso = (a.release_date || a.sort_date || '').slice(0, 10);
          const bIso = (b.release_date || b.sort_date || '').slice(0, 10);
          const aDate = aIso ? parseIsoDate(aIso) : null;
          const bDate = bIso ? parseIsoDate(bIso) : null;
          if (aDate && bDate) return bDate.getTime() - aDate.getTime();
          if (aDate) return -1;
          if (bDate) return 1;
          return (b.version_label || '').localeCompare(a.version_label || '');
        })
        .slice(0, 4),
    [releasesData],
  );

  const getParentMajorReleaseLabel = (release: ReleaseVersionUsageRow) => {
    if (!release.parent_major_release_id) return 'Missing';
    const parent = releasesData.find((candidate) => candidate.id === release.parent_major_release_id);
    return parent?.version_label || parent?.version_number || 'Unknown parent';
  };

  const pageMeta = {
    overview: {
      title: 'Overview',
      description: 'Monitor delivery execution across workstreams and releases.',
    },
    workstreams: {
      title: 'Workstreams',
      description: 'Track active workstreams from Menu initiatives.',
    },
    'internal-releases': {
      title: 'Internal Releases',
      description: 'Manage BOH-facing release readiness and ticket coverage.',
    },
    'external-releases': {
      title: 'External Releases',
      description: 'Manage customer-facing release readiness and delivery state.',
    },
  }[activeTab];

  return (
    <div className="min-h-screen bg-boh-bg-light dark:bg-boh-bg">
      <div className="border-b border-boh-border-light dark:border-boh-border">
        <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                Forge
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-boh-text-light dark:text-boh-text">
                {pageMeta.title}
              </h1>
              <p className="mt-1 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                {pageMeta.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Product Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-4">
                <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
                  {overview?.data?.metrics?.total_initiatives || 0}
                </div>
                <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">Total Initiatives</div>
              </div>
              <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-4">
                <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
                  {overview?.data?.metrics?.active_initiatives || 0}
                </div>
                <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">Active Workstreams</div>
              </div>
              <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-4">
                <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
                  {overview?.data?.metrics?.total_releases || 0}
                </div>
                <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">Total Releases</div>
              </div>
              <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-4">
                <div className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
                  {Math.round(((overview?.data?.metrics?.active_initiatives || 0) / (overview?.data?.metrics?.total_initiatives || 1)) * 100)}%
                </div>
                <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">Completion Rate</div>
              </div>
            </div>

            <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-4">
              <h3 className="text-base font-semibold text-boh-text-light dark:text-boh-text mb-3">Release Pipeline</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {releasePipelineSummary.map((stage) => (
                  <div key={stage.name} className="flex items-center justify-between rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-3 min-h-[56px]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${stage.tone}`} />
                      <span className="text-sm font-medium text-boh-text-light dark:text-boh-text leading-snug">{stage.name}</span>
                    </div>
                    <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub whitespace-nowrap">{stage.count} releases</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-boh-text-light dark:text-boh-text">Next Releases</h3>
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    Live major and minor release queue split by internal and external delivery.
                  </p>
                </div>
                {isLoadingReleases && (
                  <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Refreshing release data...</span>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {overviewReleaseCards.map(({ key, label, release }) => (
                  <div
                    key={key}
                    className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-3 min-h-[142px]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">
                        {label}
                      </span>
                      {release && (
                        <span className={`inline-flex min-w-[88px] items-center justify-center whitespace-nowrap rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium ${getStatusColor(release.status)}`}>
                          {release.status || 'unknown'}
                        </span>
                      )}
                    </div>

                    {release ? (
                      <div className="mt-3 space-y-2">
                        <div>
                          <div className="text-base font-semibold text-boh-text-light dark:text-boh-text">
                            {release.version_label || 'Unnamed Release'}
                          </div>
                          <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                            {formatVersionNumberForUi(release.version_number)}
                          </div>
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="text-boh-text-sub-light dark:text-boh-text-sub">Release candidate</span>
                            <span className="font-medium text-boh-text-light dark:text-boh-text text-right">
                              {formatReleaseDateForUi(release.release_candidate_date || release.release_date)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-boh-text-sub-light dark:text-boh-text-sub">Rollout</span>
                            <span className="font-medium text-boh-text-light dark:text-boh-text text-right">
                              {formatReleaseDateForUi(release.rollout_date)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-boh-text-sub-light dark:text-boh-text-sub">Tickets</span>
                            <span className="font-medium text-boh-text-light dark:text-boh-text">
                              {release.ticket_count || 0}
                            </span>
                          </div>
                          {release.release_tier === 'minor' && (
                            <div className="flex justify-between gap-3">
                              <span className="text-boh-text-sub-light dark:text-boh-text-sub">Parent major</span>
                              <span className="font-medium text-boh-text-light dark:text-boh-text text-right">
                                {getParentMajorReleaseLabel(release)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                        No planned or in-progress release found.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-boh-text-light dark:text-boh-text">Past Releases</h3>
                <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">Last completed release records</span>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {recentReleasedReleases.length > 0 ? (
                  recentReleasedReleases.map((release) => (
                    <div
                      key={release.id}
                      className="rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-boh-text-light dark:text-boh-text">
                            {release.version_label || 'Unnamed Release'}
                          </div>
                          <div className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                            {formatEnvironmentLabel(release.environment)} / {release.release_tier}
                          </div>
                        </div>
                        <span className={`inline-flex min-w-[88px] items-center justify-center whitespace-nowrap rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium ${getStatusColor(release.status)}`}>
                          {release.status || 'unknown'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                        <span>Release candidate: {formatReleaseDateForUi(release.release_candidate_date || release.release_date)}</span>
                        <span>{release.ticket_count || 0} tickets</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                    No released records found.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workstreams' && (
          <div className="space-y-6">
            {/* Quarter/Year Selector */}
            <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-boh-text-light dark:text-boh-text">Workstreams</h2>
                  <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">Active workstreams from Menu initiatives</p>
                </div>
                <div className="flex items-center gap-4">
                  <MenuFilterDropdown
                    label="Year"
                    displayValue={selectedYear.toString()}
                    options={[
                      { value: 2025, label: '2025' },
                      { value: 2026, label: '2026' },
                      { value: 2027, label: '2027' },
                    ]}
                    onSelect={(value) => setSelectedYear(value)}
                  />
                  <MenuFilterDropdown
                    label="Quarter"
                    displayValue={selectedQuarter}
                    options={[
                      { value: 'Q1', label: 'Q1' },
                      { value: 'Q2', label: 'Q2' },
                      { value: 'Q3', label: 'Q3' },
                      { value: 'Q4', label: 'Q4' },
                    ]}
                    onSelect={(value) => setSelectedQuarter(value as any)}
                  />
                </div>
              </div>
            </div>

            {/* Workstreams List */}
            <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl">
              <div className="p-6">
                {isLoadingData || isLoadingWorkstreams ? (
                  <div className="text-center py-8">
                    <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading workstreams...</div>
                  </div>
                ) : enrichedWorkstreams && enrichedWorkstreams.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {enrichedWorkstreams.map((workstream) => (
                      <div
                        key={workstream?.id || Math.random()}
                        onClick={() => workstream && loadWorkstreamDetails(workstream)}
                        className="border border-boh-border-light dark:border-boh-border rounded-lg p-4 hover:shadow-sm hover:border-boh-primary transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text truncate">
                              {workstream?.title || 'Untitled Workstream'}
                            </h3>
                            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                              {workstream?.boh_app?.name || `App ID: ${workstream?.app_id}` || 'Unknown App'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workstream?.status)}`}>
                              {workstream?.status || 'Unknown'}
                            </span>
                            {workstream?.riskLevel && (
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                workstream.riskLevel === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                                workstream.riskLevel === 'medium' ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/20 dark:text-violet-300' :
                                'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              }`}>
                                {workstream.riskLevel} risk
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-boh-text-sub-light dark:text-boh-text-sub">Progress</span>
                            <div className="flex items-center mt-1">
                              <div className="flex-1 bg-boh-surface-light dark:bg-boh-surfaced-full h-2 mr-2">
                                <div 
                                  className="bg-boh-primary h-2 rounded-full" 
                                  style={{ width: `${Math.min(100, Math.max(0, workstream?.progress || 0))}%` }}
                                />
                              </div>
                              <span className="text-xs text-boh-text-light dark:text-boh-text">{workstream?.progress || 0}%</span>
                            </div>
                          </div>
                          <div>
                            <span className="text-boh-text-sub-light dark:text-boh-text-sub">Releases</span>
                            <div className="mt-1">
                              <span className="text-xs font-medium text-boh-text-light dark:text-boh-text">
                                {workstream?.linkedReleaseCount || 0} linked
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {workstream?.hasOwner && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              ✓ Assigned
                            </span>
                          )}
                          {workstream?.linkedReleaseCount > 0 && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                              ✓ Has Release
                            </span>
                          )}
                          {workstream?.isBlocked && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                              ⚠ Blocked
                            </span>
                          )}
                          {workstream?.isUnscheduled && (
                            <span className="inline-flex items-center rounded-full px-2 pt-0.5 pb-1.5 text-xs font-medium bg-boh-bg-light text-boh-text-sub-light dark:bg-boh-bg dark:text-boh-text-sub">
                              ⚠ Unscheduled
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 text-boh-text-sub-light dark:text-boh-text-sub">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-boh-text-light dark:text-boh-text mb-2">
                      No workstreams found
                    </h3>
                    <p className="text-boh-text-sub-light dark:text-boh-text-sub">
                      {workstreams && workstreams.length > 0 
                        ? `No workstreams found for ${selectedQuarter} ${selectedYear}`
                        : 'No workstreams available'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Detail Panel */}
            {selectedWorkstream && (
              <div className="fixed right-0 top-0 h-full w-96 bg-boh-surface-light dark:bg-boh-surface border-l border-boh-border-light dark:border-boh-border shadow-lg z-50">
                <div className="h-full flex flex-col">
                  <div className="p-6 border-b border-boh-border-light dark:border-boh-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text">Workstream Details</h3>
                      <button
                        onClick={() => {
                          setSelectedWorkstream(null);
                          setWorkstreamDetails(null);
                        }}
                        className="text-boh-text-sub-light hover:text-boh-text-light dark:hover:text-boh-text"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    {isLoadingDetails ? (
                      <div className="text-center py-8">
                        <div className="text-boh-text-sub-light dark:text-boh-text-sub">Loading details...</div>
                      </div>
                    ) : workstreamDetails ? (
                      <div className="space-y-6">
                        {/* Basic Info */}
                        <div>
                          <h4 className="text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-2">Basic Information</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Title</span>
                              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                                {workstreamDetails.title || workstreamDetails.initiative?.title || 'Untitled'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Status</span>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(workstreamDetails.status)}`}>
                                {workstreamDetails.status || 'Unknown'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Progress</span>
                              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">{workstreamDetails.progress || 0}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Ownership & Planning */}
                        <div>
                          <h4 className="text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-2">Ownership & Planning</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Assigned To</span>
                              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                                {workstreamDetails.assigned_user?.full_name || workstreamDetails.initiative?.owner_user?.full_name || 'No one assigned'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Approval Status</span>
                              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                                {workstreamDetails.workstream_approval?.status || 'Not submitted'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Planning Stage</span>
                              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                                {workstreamDetails.planning_stage_info?.label || 'Not specified'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">User Stories</span>
                              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                                {workstreamDetails.boh_user_story?.[0]?.count || 0}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Tickets</span>
                              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                                {workstreamDetails.counter_ticket?.[0]?.count || 0}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Linked Releases</span>
                              <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                                {selectedWorkstream?.linkedReleaseCount || 0}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {workstreamDetails.description || workstreamDetails.initiative?.description ? (
                          <div>
                            <h4 className="text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-2">Description</h4>
                            <p className="text-sm text-boh-text-light dark:text-boh-text bg-boh-bg-light dark:bg-boh-bg p-3 rounded-lg">
                              {workstreamDetails.description || workstreamDetails.initiative?.description}
                            </p>
                          </div>
                        ) : null}

                        {/* Linked Releases */}
                        {selectedWorkstream?.linkedReleases && selectedWorkstream.linkedReleases.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mb-2">Linked Releases</h4>
                            <div className="space-y-2">
                              {selectedWorkstream.linkedReleases.map((release: any) => (
                                <div key={release.id} className="flex items-center justify-between p-2 bg-boh-bg-light dark:bg-boh-bg dark:bg-boh-surface rounded-lg">
                                  <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                                      {release.version_label || 'Unknown Version'}
                                    </span>
                                    <span className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
                                      {release.environment || 'Unknown Environment'}
                                    </span>
                                  </div>
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(release.status)}`}>
                                    {release.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-boh-text-sub-light dark:text-boh-text-sub">No details available</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'internal-releases' && (
          <div className="space-y-6">
            <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  {(['major', 'minor'] as ReleaseTier[]).map((tier) => (
                    <button
                      key={tier}
                      onClick={() =>
                        setActiveReleaseTier((prev) =>
                          prev.internal === tier ? prev : { ...prev, internal: tier },
                        )
                      }
                      className={getReleaseControlClassName(activeReleaseTier.internal === tier)}
                    >
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  <span>Quarter:</span>
                  <div className="flex flex-wrap gap-2">
                    {QUARTER_FILTERS.map((quarter) => (
                      <button
                        key={quarter}
                        onClick={() =>
                          setReleaseQuarterFilter((prev) =>
                            prev.internal === quarter ? prev : { ...prev, internal: quarter },
                          )
                        }
                        className={getReleaseControlClassName(releaseQuarterFilter.internal === quarter)}
                      >
                        {QUARTER_LABELS[quarter]}
                      </button>
                    ))}
                  </div>
                </div>

                {renderScopeFilter('internal')}
              </div>
            </div>

            <ReleasesLayout
              releases={getReleasesForView('internal')}
              allReleases={releasesData.filter((release) => getEnvironmentGroup(release.environment) === 'internal')}
              selectedRelease={selectedRelease}
              childReleases={selectedReleaseChildren}
              initiatives={selectedRelease?.release_tier === 'major' ? getMajorReleaseInitiatives(selectedRelease.id) : []}
              tickets={tickets}
              initiativesByReleaseId={initiativesByReleaseId}
              isLoadingReleases={isLoadingReleases}
              isLoadingInitiatives={isLoadingInitiatives}
              isLoadingTickets={isLoadingTickets}
              onSelectRelease={setSelectedReleaseId}
              onUpdateStatus={updateReleaseStatus}
              releaseSummary={releaseSummary}
              isTicketReleaseReady={isTicketReleaseReady}
              emptyMessage={
                `No ${activeReleaseTier.internal} releases match the current scope and quarter filters.`
              }
            />
          </div>
        )}

      {activeTab === 'external-releases' && (
        <div className="space-y-6">
          <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                {(['major', 'minor'] as ReleaseTier[]).map((tier) => (
                  <button
                    key={tier}
                    onClick={() =>
                      setActiveReleaseTier((prev) =>
                        prev.external === tier ? prev : { ...prev, external: tier },
                      )
                    }
                    className={getReleaseControlClassName(activeReleaseTier.external === tier)}
                  >
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                <span>Quarter:</span>
                <div className="flex flex-wrap gap-2">
                  {QUARTER_FILTERS.map((quarter) => (
                    <button
                      key={quarter}
                      onClick={() =>
                        setReleaseQuarterFilter((prev) =>
                          prev.external === quarter ? prev : { ...prev, external: quarter },
                        )
                      }
                      className={getReleaseControlClassName(releaseQuarterFilter.external === quarter)}
                    >
                      {QUARTER_LABELS[quarter]}
                    </button>
                  ))}
                </div>
              </div>

              {renderScopeFilter('external')}
            </div>
            </div>

            <ReleasesLayout
              releases={getReleasesForView('external')}
              allReleases={releasesData.filter((release) => getEnvironmentGroup(release.environment) === 'external')}
              selectedRelease={selectedRelease}
              childReleases={selectedReleaseChildren}
              initiatives={selectedRelease?.release_tier === 'major' ? getMajorReleaseInitiatives(selectedRelease.id) : []}
              tickets={tickets}
              initiativesByReleaseId={initiativesByReleaseId}
              isLoadingReleases={isLoadingReleases}
              isLoadingInitiatives={isLoadingInitiatives}
              isLoadingTickets={isLoadingTickets}
              onSelectRelease={setSelectedReleaseId}
              onUpdateStatus={updateReleaseStatus}
              releaseSummary={releaseSummary}
              isTicketReleaseReady={isTicketReleaseReady}
              emptyMessage={
                `No ${activeReleaseTier.external} releases match the current scope and quarter filters.`
              }
            />
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {isToastVisible && (
        <Toast
          message={toastMessage}
          isVisible={isToastVisible}
          onVisibleChange={setIsToastVisible}
        />
      )}
    </div>
  );
};

export default ForgeManagement;

import { supabase } from '../supabase';
import type {
  Initiative,
  Release,
  Ticket,
  QuarterlyMetrics,
  ProductOverview,
  CreateInitiativeInput,
  UpdateInitiativeInput,
  CreateReleaseInput,
  UpdateReleaseInput,
  ProductFilters,
  QuarterlyReportData,
  ApiResponse,
  PaginatedResponse,
  ApiError,
  PlanningStage,
  ProductAppSummary,
  ProductAppModule,
  ProductAppInput,
  ProductAppModuleInput,
  PriorityOption
} from '../../types/product';

// Helper function to handle API responses
const handleResponse = async <T>(promise: Promise<any>): Promise<ApiResponse<T>> => {
  try {
    const { data, error } = await promise;
    if (error) {
      return { data: null as any, error: error.message };
    }
    return { data };
  } catch (err) {
    return {
      data: null as any,
      error: err instanceof Error ? err.message : 'Unknown error occurred'
    };
  }
};

const buildCountMap = (rows?: { initiative_id: string; count: number | string }[] | null) => {
  return (rows || []).reduce((acc, row) => {
    if (!row?.initiative_id) return acc;
    acc[row.initiative_id] = Number(row.count) || 0;
    return acc;
  }, {} as Record<string, number>);
};

// Product Overview API
export const productApi = {
  // Get product overview dashboard data
  getOverview: async (): Promise<ApiResponse<ProductOverview>> => {
    const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
    const currentYear = new Date().getFullYear();

    const [
      totalInitiativesResult,
      totalReleasesResult,
    ] = await Promise.all([
      supabase
        .from('boh_initiative')
        .select('id', { count: 'exact', head: true })
        .eq('is_archived', false)
        .eq('target_quarter', currentQuarter)
        .eq('target_year', currentYear),
      supabase
        .from('boh_release_version')
        .select('id', { count: 'exact', head: true })
        .eq('quarter', currentQuarter)
        .eq('year', currentYear),
    ]);

    // Get recent initiatives
    const { data: initiativesData, error: initiativesError } = await supabase
      .from('boh_initiative')
      .select(`
        id,
        title,
        description,
        status,
        target_quarter,
        target_year,
        progress,
        owner_user_id,
        major_release_id,
        target_start_date,
        target_end_date,
        tags,
        priority_id,
        app_id,
        is_archived,
        created_at,
        updated_at
      `)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (initiativesError) {
      return { data: null as any, error: initiativesError.message };
    }

    // Get recent releases
    const { data: releasesData, error: releasesError } = await supabase
      .from('boh_release_version')
      .select(`
        id,
        version_label,
        release_tier,
        status,
        release_date,
        quarter,
        year,
        environment,
        summary,
        created_at,
        updated_at,
        counter_ticket(count)
      `)
      .order('release_date', { ascending: false })
      .limit(10);

    if (releasesError) {
      return { data: null as any, error: releasesError.message };
    }

    // Get ticket counts - use app_context directly
    const { count: internalCount, error: internalError } = await supabase
      .from('counter_ticket')
      .select('id', { count: 'exact', head: true })
      .eq('app_context', 'boh');

    const { count: externalCount, error: externalError } = await supabase
      .from('counter_ticket')
      .select('id', { count: 'exact', head: true })
      .neq('app_context', 'boh');

    const processedInitiatives = (initiativesData || []).map((initiative: any) => ({
      ...initiative,
      ticket_count: 0,
    }));

    const processedReleases = (releasesData || []).map((release: any) => ({
      ...release,
      ticket_count: release.counter_ticket?.[0]?.count || 0,
    }));

    const overview: ProductOverview = {
      metrics: {
        active_initiatives: totalInitiativesResult.count || 0,
        total_initiatives: totalInitiativesResult.count || 0,
        active_releases: totalReleasesResult.count || 0,
        total_releases: totalReleasesResult.count || 0,
        internal_tickets: internalCount || 0,
        external_tickets: externalCount || 0,
      },
      recent_initiatives: processedInitiatives,
      recent_releases: processedReleases,
      upcoming_releases: processedReleases.filter(r => r.status === 'planned'),
    };

    return { data: overview };
  },

  // Initiatives
  getInitiatives: async (filters?: ProductFilters): Promise<ApiResponse<Initiative[]>> => {
    const baseSelect = `
      id,
      title,
      description,
      status,
      target_quarter,
      target_year,
      progress,
      owner_user_id,
      major_release_id,
      target_start_date,
      target_end_date,
      tags,
      priority_id,
      app_id,
      module_id,
      planning_stage_id,
      forge_status_id,
      committed_quarter_calendar_id,
      submitted_to_forge_at,
      forge_reviewed_at,
      forge_reviewed_by,
      forge_decision_notes,
      governance_notes,
      is_archived,
      created_at,
      updated_at
    `;

    let query = supabase.from('boh_initiative').select(baseSelect);

    if (!filters?.include_archived) {
      query = query.eq('is_archived', false);
    }

    if (filters?.quarter) {
      query = query.eq('target_quarter', filters.quarter);
    }
    if (filters?.year) {
      query = query.eq('target_year', filters.year);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.owner_user_id) {
      query = query.eq('owner_user_id', filters.owner_user_id);
    }
    if (filters?.app_id) {
      query = query.eq('app_id', filters.app_id);
    }
    if (filters?.module_id !== undefined) {
      if (filters.module_id === null) {
        query = query.is('module_id', null);
      } else {
        query = query.eq('module_id', filters.module_id);
      }
    }
    if (filters?.planning_stage_id) {
      query = query.eq('planning_stage_id', filters.planning_stage_id);
    }
    if (filters?.priority_id) {
      query = query.eq('priority_id', filters.priority_id);
    }
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      return { data: null as any, error: error.message };
    }

    const initiatives = data || [];
    const initiativeIds = initiatives.map((initiative: any) => initiative.id);

    let workstreamCounts: Record<string, number> = {};
    let userStoryCounts: Record<string, number> = {};
    let releaseCounts: Record<string, number> = {};
    let ticketCounts: Record<string, number> = {};

    if (initiativeIds.length > 0) {
      const [workstreams, userStories, releases] = await Promise.all([
        supabase
          .from('boh_workstream')
          .select('initiative_id')
          .in('initiative_id', initiativeIds),
        supabase
          .from('boh_user_story')
          .select('initiative_id')
          .in('initiative_id', initiativeIds),
        supabase
          .from('boh_initiative_release')
          .select('initiative_id')
          .in('initiative_id', initiativeIds)
      ]);

      // Build count maps manually
      workstreamCounts = (workstreams.data || []).reduce((acc, item) => {
        acc[item.initiative_id] = (acc[item.initiative_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      userStoryCounts = (userStories.data || []).reduce((acc, item) => {
        acc[item.initiative_id] = (acc[item.initiative_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      releaseCounts = (releases.data || []).reduce((acc, item) => {
        acc[item.initiative_id] = (acc[item.initiative_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      if (workstreams.error) {
        console.warn('[ProductAPI] Error loading workstream counts', workstreams.error);
      }

      if (userStories.error) {
        console.warn('[ProductAPI] Error loading user story counts', userStories.error);
      }

      if (releases.error) {
        console.warn('[ProductAPI] Error loading release counts', releases.error);
      }

      // Counter tickets are release-scoped bug/minor-fix work, not initiative tasks.
      ticketCounts = {};
    }

    const ownerIds = Array.from(
      new Set(
        initiatives
          .map((initiative: any) => initiative.owner_user_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const appIds = Array.from(
      new Set(
        initiatives
          .map((initiative: any) => initiative.app_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const moduleIds = Array.from(
      new Set(
        initiatives
          .map((initiative: any) => initiative.module_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const planningStageIds = Array.from(
      new Set(
        initiatives
          .map((initiative: any) => initiative.planning_stage_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const priorityIds = Array.from(
      new Set(
        initiatives
          .map((initiative: any) => initiative.priority_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const forgeStatusIds = Array.from(
      new Set(
        initiatives
          .map((initiative: any) => initiative.forge_status_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const majorReleaseIds = Array.from(
      new Set(
        initiatives
          .map((initiative: any) => initiative.major_release_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const ownerMap: Record<string, any> = {};
    if (ownerIds.length > 0) {
      const { data: ownerRows, error: ownerError } = await supabase
        .from('boh_user')
        .select('id, full_name, email, status')
        .in('id', ownerIds);
      if (ownerError) {
        console.warn('[ProductAPI] Error loading owners', ownerError);
      } else {
        ownerRows?.forEach((owner) => {
          ownerMap[owner.id] = owner;
        });
      }
    }

    const appMap: Record<string, ProductAppSummary> = {};
    if (appIds.length > 0) {
      const { data: appRows, error: appError } = await supabase
        .from('boh_app')
        .select('id, slug, name, description, route, primary_color, type, is_active')
        .in('id', appIds);
      if (appError) {
        console.warn('[ProductAPI] Error loading apps', appError);
      } else {
        appRows?.forEach((app) => {
          appMap[app.id] = app as ProductAppSummary;
        });
      }
    }

    const moduleMap: Record<string, ProductAppModule> = {};
    if (moduleIds.length > 0) {
      const { data: moduleRows, error: moduleError } = await supabase
        .from('boh_app_module')
        .select('id, app_id, key, label, description, route, icon_key, group_label, sort_order, is_primary, is_active')
        .in('id', moduleIds);
      if (moduleError) {
        console.warn('[ProductAPI] Error loading modules', moduleError);
      } else {
        moduleRows?.forEach((module) => {
          moduleMap[module.id] = module as ProductAppModule;
        });
      }
    }

    const planningStageMap: Record<string, PlanningStage> = {};
    if (planningStageIds.length > 0) {
      const { data: planningRows, error: planningError } = await supabase
        .from('boh_initiative_planning_stage')
        .select('id, key, label, description, color_token, sort_order, is_active, created_at')
        .in('id', planningStageIds);
      if (planningError) {
        console.warn('[ProductAPI] Error loading planning stages', planningError);
      } else {
        planningRows?.forEach((stage) => {
          planningStageMap[stage.id] = stage as PlanningStage;
        });
      }
    }

    const priorityMap: Record<string, PriorityOption> = {};
    if (priorityIds.length > 0) {
      const { data: priorityRows, error: priorityError } = await supabase
        .from('counter_ticket_priority')
        .select('id, key, label, description, weight, color_token, is_active')
        .in('id', priorityIds);
      if (priorityError) {
        console.warn('[ProductAPI] Error loading priorities', priorityError);
      } else {
        priorityRows?.forEach((priority) => {
          priorityMap[priority.id] = priority as PriorityOption;
        });
      }
    }

    const forgeStatusMap: Record<string, NonNullable<Initiative['forge_status']>> = {};
    if (forgeStatusIds.length > 0) {
      const { data: forgeStatusRows, error: forgeStatusError } = await supabase
        .from('boh_initiative_forge_status')
        .select('id, key, label, description, color_token, sort_order, is_active')
        .in('id', forgeStatusIds);
      if (forgeStatusError) {
        console.warn('[ProductAPI] Error loading Forge handoff statuses', forgeStatusError);
      } else {
        forgeStatusRows?.forEach((status) => {
          forgeStatusMap[status.id] = status as NonNullable<Initiative['forge_status']>;
        });
      }
    }

    const majorReleaseMap: Record<string, any> = {};
    if (majorReleaseIds.length > 0) {
      const { data: releaseRows, error: releaseError } = await supabase
        .from('boh_release_version')
        .select('id, version_label, status, release_date')
        .in('id', majorReleaseIds);
      if (releaseError) {
        console.warn('[ProductAPI] Error loading major releases', releaseError);
      } else {
        releaseRows?.forEach((release) => {
          majorReleaseMap[release.id] = release;
        });
      }
    }

    const processedData = initiatives.map((initiative: any) => {
      const releaseCount = releaseCounts[initiative.id] || 0;
      const ticketCount = ticketCounts[initiative.id] || 0;

      return {
        ...initiative,
        owner_user: initiative.owner_user_id ? ownerMap[initiative.owner_user_id] || null : null,
        app: initiative.app_id ? appMap[initiative.app_id] || null : null,
        module: initiative.module_id ? moduleMap[initiative.module_id] || null : null,
        planning_stage: initiative.planning_stage_id ? planningStageMap[initiative.planning_stage_id] || null : null,
        priority: initiative.priority_id ? priorityMap[initiative.priority_id] || null : null,
        forge_status: initiative.forge_status_id ? forgeStatusMap[initiative.forge_status_id] || null : null,
        major_release: initiative.major_release_id ? majorReleaseMap[initiative.major_release_id] || null : null,
        ticket_count: ticketCount,
        workstream_count: workstreamCounts[initiative.id] || 0,
        user_story_count: userStoryCounts[initiative.id] || 0,
        release_count: releaseCount,
        has_release: Boolean(initiative.major_release_id || releaseCount > 0),
        has_tickets: ticketCount > 0,
      } as Initiative;
    });

    let filteredData = processedData;

    if (filters?.has_release === true) {
      filteredData = filteredData.filter((initiative) => initiative.has_release);
    } else if (filters?.has_release === false) {
      filteredData = filteredData.filter((initiative) => !initiative.has_release);
    }

    if (filters?.has_tickets === true) {
      filteredData = filteredData.filter((initiative) => (initiative.ticket_count || 0) > 0);
    } else if (filters?.has_tickets === false) {
      filteredData = filteredData.filter((initiative) => !initiative.has_tickets);
    }

    return { data: filteredData };
  },

  getInitiative: async (id: string): Promise<ApiResponse<Initiative>> => {
    // First get the initiative
    const { data: initiativeData, error: initiativeError } = await supabase
      .from('boh_initiative')
      .select(`
        *,
        owner_user:boh_user!boh_initiative_owner_user_id_fkey(id, full_name, email, status),
        app:boh_app!boh_initiative_app_id_fkey(id, slug, name, description, route, primary_color, type, is_active),
        module:boh_app_module!boh_initiative_module_id_fkey(id, app_id, key, label, description, route, icon_key, group_label, sort_order, is_primary, is_active),
        planning_stage:boh_initiative_planning_stage(id, key, label, description, color_token, sort_order, is_active),
        priority:counter_ticket_priority(id, key, label, description, weight, color_token, is_active),
        major_release:boh_release_version(
          id,
          version_label,
          status,
          release_date
        ),
        releases:boh_initiative_release(
          release_id,
          release:boh_release_version(
            id,
            version_label,
            status,
            release_date
          )
        )
      `)
      .eq('id', id)
      .single();

    if (initiativeError) {
      return { data: null as any, error: initiativeError.message };
    }

    const [workstreamAggregate, userStoriesAggregate, releasesAggregate] = await Promise.all([
      supabase
        .from('boh_workstream')
        .select('id', { count: 'exact', head: true })
        .eq('initiative_id', id),
      supabase
        .from('boh_user_story')
        .select('id', { count: 'exact' })
        .eq('initiative_id', id),
      supabase
        .from('boh_initiative_release')
        .select('id', { count: 'exact', head: true })
        .eq('initiative_id', id)
    ]);

    const workstreamCount = workstreamAggregate.count || 0;
    const releaseCount = releasesAggregate.count || 0;

    const userStoryCount = userStoriesAggregate.count || 0;
    const userStoryIds = (userStoriesAggregate.data || []).map((story) => story.id);

    let taskCount = 0;
    if (userStoryIds.length > 0) {
      const { count: tasksCount, error: taskError } = await supabase
        .from('boh_task')
        .select('id', { count: 'exact', head: true })
        .in('user_story_id', userStoryIds);

      if (taskError) {
        console.warn('[ProductAPI] Error loading task count', taskError);
      } else {
        taskCount = tasksCount || 0;
      }
    }

    // Transform the data to match the expected Initiative interface
    const transformedData: Initiative = {
      ...initiativeData,
      releases: initiativeData.releases?.map((ir: any) => ir.release) || [],
      workstream_count: workstreamCount,
      user_story_count: userStoryCount,
      task_count: taskCount,
      ticket_count: 0,
      release_count: releaseCount,
      has_release: Boolean(initiativeData.major_release_id || releaseCount > 0),
      has_tickets: false,
    };

    return { data: transformedData };
  },

  getProductApps: async (): Promise<ApiResponse<ProductAppSummary[]>> => {
    const { data, error } = await supabase
      .from('boh_app')
      .select('id, slug, name, description, route, primary_color, type, location, surface, offering_status, operational_since, is_active, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data: data || [] };
  },

  getAppModules: async (appId?: string, includeInactive = false): Promise<ApiResponse<ProductAppModule[]>> => {
    let query = supabase
      .from('boh_app_module')
      .select('id, app_id, key, label, description, route, icon_key, group_label, surface, offering_status, operational_since, sort_order, is_primary, is_active')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (appId) {
      query = query.eq('app_id', appId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data: data || [] };
  },

  createProductApp: async (input: ProductAppInput): Promise<ApiResponse<ProductAppSummary>> => {
    const { data, error } = await supabase
      .from('boh_app')
      .insert({
        ...input,
        is_active: input.is_active ?? true,
      })
      .select('id, slug, name, description, route, primary_color, type, location, surface, offering_status, operational_since, is_active, sort_order')
      .single();

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data };
  },

  updateProductApp: async (id: string, input: Partial<ProductAppInput>): Promise<ApiResponse<ProductAppSummary>> => {
    const { data, error } = await supabase
      .from('boh_app')
      .update(input)
      .eq('id', id)
      .select('id, slug, name, description, route, primary_color, type, location, surface, offering_status, operational_since, is_active, sort_order')
      .single();

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data };
  },

  createAppModule: async (input: ProductAppModuleInput): Promise<ApiResponse<ProductAppModule>> => {
    const { data, error } = await supabase
      .from('boh_app_module')
      .insert({
        ...input,
        is_active: input.is_active ?? true,
        is_primary: input.is_primary ?? false,
      })
      .select('id, app_id, key, label, description, route, icon_key, group_label, surface, offering_status, operational_since, sort_order, is_primary, is_active')
      .single();

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data };
  },

  updateAppModule: async (id: string, input: Partial<ProductAppModuleInput>): Promise<ApiResponse<ProductAppModule>> => {
    const { data, error } = await supabase
      .from('boh_app_module')
      .update(input)
      .eq('id', id)
      .select('id, app_id, key, label, description, route, icon_key, group_label, surface, offering_status, operational_since, sort_order, is_primary, is_active')
      .single();

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data };
  },

  getPlanningStages: async (): Promise<ApiResponse<PlanningStage[]>> => {
    const { data, error } = await supabase
      .from('boh_initiative_planning_stage')
      .select('id, key, label, description, color_token, sort_order, is_active, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data: data || [] };
  },

  getPriorityOptions: async (): Promise<ApiResponse<PriorityOption[]>> => {
    const { data, error } = await supabase
      .from('counter_ticket_priority')
      .select('id, key, label, description, weight, color_token, is_active')
      .eq('is_active', true)
      .order('weight', { ascending: false })
      .order('label', { ascending: true });

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data: data || [] };
  },

  getInitiativeStatuses: async (): Promise<ApiResponse<Array<{ id: string; key: string; label: string; description?: string; color_token?: string; sort_order: number; is_active: boolean }>>> => {
    const { data, error } = await supabase
      .from('boh_initiative_status')
      .select('id, key, label, description, color_token, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data: data || [] };
  },

  getForgeStatuses: async (): Promise<ApiResponse<Array<{ id: string; key: string; label: string; description?: string; color_token?: string; sort_order: number; is_active: boolean }>>> => {
    const { data, error } = await supabase
      .from('boh_initiative_forge_status')
      .select('id, key, label, description, color_token, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data: data || [] };
  },

  getQuarterCalendar: async (): Promise<ApiResponse<Array<{ id: string; year: number; quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; start_date: string; end_date: string; label: string; is_active: boolean }>>> => {
    const { data, error } = await supabase
      .from('boh_quarter_calendar')
      .select('id, year, quarter, start_date, end_date, label, is_active')
      .eq('is_active', true)
      .order('year', { ascending: true })
      .order('quarter', { ascending: true });

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data: data || [] };
  },

  createInitiative: async (input: CreateInitiativeInput): Promise<ApiResponse<Initiative>> => {
    const { data, error } = await supabase
      .from('boh_initiative')
      .insert({
        ...input,
        progress: 0,
        is_archived: false,
      })
      .select()
      .single();

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data };
  },

  updateInitiative: async (id: string, input: UpdateInitiativeInput): Promise<ApiResponse<Initiative>> => {
    const { data, error } = await supabase
      .from('boh_initiative')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data };
  },

  deleteInitiative: async (id: string): Promise<ApiResponse<void>> => {
    const { error } = await supabase
      .from('boh_initiative')
      .update({ is_archived: true })
      .eq('id', id);

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data: undefined };
  },

  // Releases
  getReleases: async (filters?: ProductFilters): Promise<ApiResponse<Release[]>> => {
    let query = supabase
      .from('boh_release_version')
      .select(`
        id,
        version_label,
        version_number,
        release_tier,
        status,
        release_date,
        quarter,
        year,
        cycle,
        environment,
        summary,
        is_active,
        notes,
        created_at,
        updated_at,
        counter_ticket(count)
      `);

    if (filters?.quarter) {
      query = query.eq('quarter', filters.quarter);
    }
    if (filters?.year) {
      query = query.eq('year', filters.year);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.search) {
      query = query.or(`version_label.ilike.%${filters.search}%,summary.ilike.%${filters.search}%`);
    }

    const { data, error } = await query.order('release_date', { ascending: false });

    if (error) {
      return { data: null as any, error: error.message };
    }

    const processedData = (data || []).map((release: any) => ({
      ...release,
      ticket_count: release.counter_ticket?.[0]?.count || 0,
    }));

    return { data: processedData };
  },

  getRelease: async (id: string): Promise<ApiResponse<Release>> => {
    const { data, error } = await supabase
      .rpc('get_release_with_details', { p_release_id: id });

    if (error) {
      return { data: null as any, error: error.message };
    }

    const release = data?.[0];
    if (!release) {
      return { data: null as any, error: 'Release not found' };
    }

    return { data: release };
  },

  createRelease: async (input: CreateReleaseInput): Promise<ApiResponse<Release>> => {
    // Start a transaction by creating the release first
    const { data: releaseData, error: releaseError } = await supabase
      .from('boh_release_version')
      .insert({
        version_label: input.version_label,
        version_number: input.version_number,
        release_tier: input.release_tier,
        status: input.status || 'planned',
        release_date: input.release_date,
        environment: input.environment,
        summary: input.summary,
        notes: input.notes,
        parent_major_release_id: input.parent_major_release_id,
        is_active: true,
      })
      .select()
      .single();

    if (releaseError) {
      return { data: null as any, error: releaseError.message };
    }

    // If initiative IDs are provided, link them to the release
    if (input.initiative_ids && input.initiative_ids.length > 0) {
      const initiativeReleaseLinks = input.initiative_ids.map(initiativeId => ({
        initiative_id: initiativeId,
        release_id: releaseData.id,
      }));

      const { error: linkError } = await supabase
        .from('boh_initiative_release')
        .insert(initiativeReleaseLinks);

      if (linkError) {
        // Rollback the release creation
        await supabase
          .from('boh_release_version')
          .delete()
          .eq('id', releaseData.id);

        return { data: null as any, error: linkError.message };
      }
    }

    return { data: releaseData };
  },

  updateRelease: async (id: string, input: UpdateReleaseInput): Promise<ApiResponse<Release>> => {
    // Update the release
    const { data: releaseData, error: releaseError } = await supabase
      .from('boh_release_version')
      .update({
        version_label: input.version_label,
        version_number: input.version_number,
        release_tier: input.release_tier,
        status: input.status,
        release_date: input.release_date,
        environment: input.environment,
        summary: input.summary,
        notes: input.notes,
        parent_major_release_id: input.parent_major_release_id,
      })
      .eq('id', id)
      .select()
      .single();

    if (releaseError) {
      return { data: null as any, error: releaseError.message };
    }

    // If initiative IDs are provided, update the links
    if (input.initiative_ids !== undefined) {
      // Remove existing links
      await supabase
        .from('boh_initiative_release')
        .delete()
        .eq('release_id', id);

      // Add new links if any
      if (input.initiative_ids.length > 0) {
        const initiativeReleaseLinks = input.initiative_ids.map(initiativeId => ({
          initiative_id: initiativeId,
          release_id: id,
        }));

        const { error: linkError } = await supabase
          .from('boh_initiative_release')
          .insert(initiativeReleaseLinks);

        if (linkError) {
          return { data: null as any, error: linkError.message };
        }
      }
    }

    return { data: releaseData };
  },

  deleteRelease: async (id: string): Promise<ApiResponse<void>> => {
    // Delete initiative-release links first
    await supabase
      .from('boh_initiative_release')
      .delete()
      .eq('release_id', id);

    // Then delete the release
    const { error } = await supabase
      .from('boh_release_version')
      .delete()
      .eq('id', id);

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data: undefined };
  },

  // Quarterly Report
  getQuarterlyReport: async (quarter: string, year: number): Promise<ApiResponse<QuarterlyReportData>> => {
    // Get metrics
    const { data: metricsData, error: metricsError } = await supabase
      .rpc('get_quarterly_metrics', { p_quarter: quarter, p_year: year });

    if (metricsError) {
      return { data: null as any, error: metricsError.message };
    }

    const metrics = metricsData?.[0] || {};

    // Get initiatives for the quarter
    const { data: initiativesData, error: initiativesError } = await supabase
      .from('boh_initiative')
      .select(`
        id,
        title,
        description,
        status,
        target_quarter,
        target_year,
        progress,
        owner_user_id,
        is_archived,
        created_at,
        updated_at
      `)
      .eq('target_quarter', quarter)
      .eq('target_year', year)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (initiativesError) {
      return { data: null as any, error: initiativesError.message };
    }

    // Get releases for the quarter
    const { data: releasesData, error: releasesError } = await supabase
      .from('boh_release_version')
      .select(`
        id,
        version_label,
        version_number,
        release_tier,
        status,
        release_date,
        quarter,
        year,
        cycle,
        environment,
        summary,
        created_at,
        updated_at,
        counter_ticket(count)
      `)
      .eq('quarter', quarter)
      .eq('year', year)
      .order('release_date', { ascending: false });

    if (releasesError) {
      return { data: null as any, error: releasesError.message };
    }

    const processedInitiatives = (initiativesData || []).map((initiative: any) => ({
      ...initiative,
      ticket_count: 0,
    }));

    const processedReleases = (releasesData || []).map((release: any) => ({
      ...release,
      ticket_count: release.counter_ticket?.[0]?.count || 0,
    }));

    const reportData: QuarterlyReportData = {
      quarter,
      year,
      metrics: {
        total_initiatives: metrics.total_initiatives || 0,
        active_initiatives: metrics.active_initiatives || 0,
        completed_initiatives: metrics.completed_initiatives || 0,
        total_releases: metrics.total_releases || 0,
        major_releases: metrics.major_releases || 0,
        minor_releases: metrics.minor_releases || 0,
        total_tickets: metrics.total_tickets || 0,
        internal_tickets: metrics.internal_tickets || 0,
        external_tickets: metrics.external_tickets || 0,
        average_initiative_progress: metrics.average_initiative_progress || 0,
        releases_per_initiative: metrics.releases_per_initiative || 0,
      },
      initiatives: processedInitiatives,
      releases: processedReleases,
    };

    return { data: reportData };
  },

  // Link initiative to release
  linkInitiativeToRelease: async (initiativeId: string, releaseId: string): Promise<ApiResponse<void>> => {
    const { error } = await supabase
      .from('boh_initiative_release')
      .insert({
        initiative_id: initiativeId,
        release_id: releaseId,
      });

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data: undefined };
  },

  // Unlink initiative from release
  unlinkInitiativeFromRelease: async (initiativeId: string, releaseId: string): Promise<ApiResponse<void>> => {
    const { error } = await supabase
      .from('boh_initiative_release')
      .delete()
      .eq('initiative_id', initiativeId)
      .eq('release_id', releaseId);

    if (error) {
      return { data: null as any, error: error.message };
    }

    return { data: undefined };
  },
};

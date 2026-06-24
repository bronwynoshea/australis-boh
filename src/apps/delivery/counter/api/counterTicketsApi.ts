import { supabase } from '../../../../lib/supabase';
import { getCurrentBohUserContext } from '../../../../boh/api/bohApi';
import type { Ticket, CounterTicketStatus, CounterTicketPriority, Activity, ReleaseVersion, CounterAppOption } from '../types';

/**
 * Lookup data structure returned by fetchTicketLookups()
 */
export interface TicketLookups {
  statuses: CounterTicketStatus[];
  priorities: CounterTicketPriority[];
  apps: CounterAppOption[];
}

/**
 * Fetches all lookup data (statuses and priorities) from Supabase.
 * 
 * @returns {Promise<TicketLookups>} Object containing statuses and priorities
 * @throws {Error} If data fetching fails
 */
export async function fetchTicketLookups(): Promise<TicketLookups> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) return { statuses: [], priorities: [], apps: [] };

  // Fetch statuses
  const { data: statusesData, error: statusesError } = await supabase
    .from('counter_ticket_status')
    .select('*')
    .eq('tenant_id', bohContext.tenant_id)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (statusesError) {
    console.error('Error fetching ticket statuses:', statusesError);
    throw statusesError;
  }

  // Fetch priorities
  const { data: prioritiesData, error: prioritiesError } = await supabase
    .from('counter_ticket_priority')
    .select('*')
    .eq('tenant_id', bohContext.tenant_id)
    .order('weight', { ascending: false, nullsFirst: false });

  if (prioritiesError) {
    console.error('Error fetching ticket priorities:', prioritiesError);
    throw prioritiesError;
  }

  const apps = await fetchCounterApps();

  return {
    statuses: (statusesData || []) as CounterTicketStatus[],
    priorities: (prioritiesData || []) as CounterTicketPriority[],
    apps,
  };
}

/**
 * Fetches app lookup rows from BOH app registry for Counter filters and ticket app context.
 */
export async function fetchCounterApps(): Promise<CounterAppOption[]> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) return [];

  const { data: tenantApps, error: tenantAppsError } = await supabase
    .from('boh_tenant_app')
    .select('app_id')
    .eq('tenant_id', bohContext.tenant_id)
    .in('status', ['enabled', 'coming_soon']);

  if (tenantAppsError) {
    console.error('Error fetching tenant BOH app enablement:', tenantAppsError);
    return [];
  }

  const appIds = (tenantApps || []).map((row) => row.app_id).filter(Boolean) as string[];
  if (appIds.length === 0) return [];

  const { data, error } = await supabase
    .from('boh_app')
    .select('id, slug, name, app_context, type, surface, primary_color, sort_order')
    .in('id', appIds)
    .eq('is_active', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching BOH app lookup rows:', error);
    return [];
  }

  return (data || []) as CounterAppOption[];
}

/**
 * Fetches active release versions for ticket assignment.
 */
export async function fetchReleaseVersions(): Promise<ReleaseVersion[]> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) return [];

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      console.warn('[fetchReleaseVersions] No active Supabase session found; queries may be denied by RLS policies scoped to authenticated.');
    }
  } catch (e) {
    console.warn('[fetchReleaseVersions] Failed to check Supabase session', e);
  }

  const { data, error } = await supabase
    .from('boh_release_version')
    .select(
      'id, environment, version_label, version_number, release_year, release_cycle, release_tier, release_date, sort_date, status, is_active, notes, parent_major_release_id, created_at',
    )
    .eq('tenant_id', bohContext.tenant_id)
    .eq('release_tier', 'minor')
    .order('sort_date', { ascending: true, nullsFirst: false })
    .order('release_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching release versions:', error);
    return [];
  }

  return (data || []) as ReleaseVersion[];
}

/**
 * Creates a new release version.
 */
export async function createReleaseVersion(versionLabel: string, versionNumber?: string, releaseDate?: string): Promise<ReleaseVersion> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) throw new Error('Unable to find current BOH tenant. Please re-authenticate.');

  const { data, error } = await supabase
    .from('boh_release_version')
    .insert({
      tenant_id: bohContext.tenant_id,
      version_label: versionLabel,
      version_number: versionNumber || null,
      release_date: releaseDate || null,
      status: 'planned', // Default to planned as per schema enum likely values
      is_active: true
    })
    .select('id, version_label, version_number, release_date, status, is_active, notes')
    .single();

  if (error) {
    console.error('Error creating release version:', error);
    throw error;
  }

  return data as ReleaseVersion;
}

/**
 * Updates a release version.
 */
export async function updateReleaseVersion(id: string, patch: Partial<ReleaseVersion>): Promise<ReleaseVersion> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) throw new Error('Unable to find current BOH tenant. Please re-authenticate.');

  const dbPatch: any = {};
  if (patch.version_label !== undefined) dbPatch.version_label = patch.version_label;
  if (patch.version_number !== undefined) dbPatch.version_number = patch.version_number;
  if (patch.release_date !== undefined) dbPatch.release_date = patch.release_date;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.is_active !== undefined) dbPatch.is_active = patch.is_active;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;

  const { data, error } = await supabase
    .from('boh_release_version')
    .update(dbPatch)
    .eq('id', id)
    .eq('tenant_id', bohContext.tenant_id)
    .select('id, version_label, version_number, release_date, status, is_active, notes')
    .single();

  if (error) {
    console.error('Error updating release version:', error);
    throw error;
  }

  return data as ReleaseVersion;
}

/**
 * Parameters for fetching tickets for a specific view
 */
export interface FetchTicketsParams {
  // BOH user id used for filtering My Tickets (created_by / assigned_to)
  bohUserId?: string;
  filters?: {
    statuses?: string[];
    severities?: string[];
    apps?: string[];
    priorities?: string[];
    assignees?: string[];
    releases?: string[]; // boh_release_version.id, use 'none' to target nulls
  };
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface FetchTicketsResult {
  tickets: Ticket[];
  totalCount: number;
}

export interface ManualTicketPayload {
  subject: string;
  description: string;
  category: string;
  app: string;
  app_id?: string | null;
  app_context?: string | null;
  status_id: string;
  priority_id: string;
  requester_name?: string | null;
  requester_email?: string | null;
  screenshot_url?: string | null;
  release_version_id?: string | null;
}

async function assertCounterLookupInTenant(table: 'counter_ticket_status' | 'counter_ticket_priority', id: string | null | undefined, tenantId: string, label: string): Promise<void> {
  if (!id) return;
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`${label} is not part of the current BOH tenant.`);
}

async function assertCounterReleaseInTenant(releaseVersionId: string | null | undefined, tenantId: string): Promise<void> {
  if (!releaseVersionId) return;
  const { data, error } = await supabase
    .from('boh_release_version')
    .select('id')
    .eq('id', releaseVersionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Selected release is not part of the current BOH tenant.');
}

async function assertCounterAppInTenant(appId: string | null | undefined, tenantId: string): Promise<void> {
  if (!appId) return;
  const { data, error } = await supabase
    .from('boh_tenant_app')
    .select('app_id')
    .eq('app_id', appId)
    .eq('tenant_id', tenantId)
    .in('status', ['enabled', 'coming_soon'])
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Selected app is not enabled for the current BOH tenant.');
}

async function assertCounterTicketInTenant(ticketId: string, tenantId: string): Promise<void> {
  const { data, error } = await supabase
    .from('counter_ticket')
    .select('id')
    .eq('id', ticketId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Ticket was not found in the current BOH tenant.');
}

export async function createManualTicket(payload: ManualTicketPayload) {
  const bohContext = await getCurrentBohUserContext();
  const bohUserId = bohContext?.id;
  if (!bohUserId || !bohContext?.tenant_id) {
    throw new Error('Unable to find current BOH user. Please re-authenticate.');
  }

  await Promise.all([
    assertCounterLookupInTenant('counter_ticket_status', payload.status_id, bohContext.tenant_id, 'Selected status'),
    assertCounterLookupInTenant('counter_ticket_priority', payload.priority_id, bohContext.tenant_id, 'Selected priority'),
    assertCounterReleaseInTenant(payload.release_version_id, bohContext.tenant_id),
    assertCounterAppInTenant(payload.app_id, bohContext.tenant_id),
  ]);

  const insertPayload = {
    tenant_id: bohContext.tenant_id,
    subject: payload.subject.trim(),
    description: payload.description.trim(),
    category: payload.category,
    app: payload.app,
    app_id: payload.app_id || null,
    app_context: payload.app_context || payload.app,
    status_id: payload.status_id,
    priority_id: payload.priority_id,
    requester_name: payload.requester_name?.trim() || null,
    requester_email: payload.requester_email?.trim() || null,
    screenshot_url: payload.screenshot_url?.trim() || null,
    release_version_id: payload.release_version_id || null,
    source: 'manual',
    initial_user_message: 'Manual ticket created via Type mode',
    created_by: bohUserId,
  };

  const { data, error } = await supabase
    .from('counter_ticket')
    .insert(insertPayload)
    .select('id, ticket_number, subject')
    .single();

  if (error) {
    console.error('[createManualTicket] Failed to create ticket', error);
    throw error;
  }

  return data;
}

/**
 * Fetches tickets for a specific view (inbox, my, or all).
 * Uses explicit joins to boh_user to avoid auto-expansion issues.
 * 
 * @param view - The view type: "inbox" | "my" | "all"
 * @param params - Optional parameters for filtering and user context
 * @returns {Promise<Ticket[]>} Array of tickets
 * @throws {Error} If data fetching fails
 */
export async function fetchTicketsForView(
  view: 'inbox' | 'my' | 'all',
  params?: FetchTicketsParams
): Promise<FetchTicketsResult> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) return { tickets: [], totalCount: 0 };

  // Query base table with explicit joins to boh_user using constraint names
  let query = supabase
    .from('counter_ticket')
    .select(`
      *,
      status:counter_ticket_status!counter_ticket_status_id_fkey(id, key, label, sort_order, color_token),
      priority:counter_ticket_priority!counter_ticket_priority_id_fkey(id, key, label, weight, color_token),
      release:boh_release_version!counter_ticket_release_version_id_fkey(id, version_label, environment),
      app_record:boh_app!counter_ticket_app_id_fkey(id, slug, name, app_context, type),
      created_by_user:boh_user!counter_tickets_created_by_fkey(id, full_name, email),
      assigned_to_user:boh_user!counter_tickets_assigned_to_fkey(id, full_name, email)
    `, { count: 'exact', head: false })
    .eq('tenant_id', bohContext.tenant_id);

  const rawSearch = params?.search?.trim();
  const hasSearch = Boolean(rawSearch);
  const wildcardSearch = hasSearch ? `%${rawSearch}%` : undefined;
  const baseSearchFilters = hasSearch
    ? [
        `subject.ilike.${wildcardSearch}`,
        `ticket_number.ilike.${wildcardSearch}`,
        `requester_email.ilike.${wildcardSearch}`,
        `release.version_label.ilike.${wildcardSearch}`,
      ]
    : [];

  // Apply view-specific filters
  // Note: Base table uses assigned_to (UUID), not assignee (computed name from view)
  if (view === 'inbox') {
    // Inbox filtering is applied after rows are hydrated below. Filtering by
    // the joined status key in PostgREST can drop or stall rows depending on
    // the relationship shape, while the all-ticket query path is stable.
  } else if (view === 'my') {
    // My Tickets: tickets created by OR assigned to the current BOH user
    // We expect a bohUserId, which is the boh_user.id for the current auth user.
    const bohUserId = params?.bohUserId;
    if (!bohUserId) {
      // Fallback: if we cannot resolve a BOH user, return empty.
      return {
        tickets: [],
        totalCount: 0,
      };
    }

    if (hasSearch && wildcardSearch) {
      const searchOrClause = `or(${baseSearchFilters.join(',')})`;
      query = query.or([
        `and(created_by.eq.${bohUserId},${searchOrClause})`,
        `and(assigned_to.eq.${bohUserId},${searchOrClause})`,
      ].join(','));
    } else {
      // created_by and assigned_to both reference boh_user.id on the backend
      query = query.or(`created_by.eq.${bohUserId},assigned_to.eq.${bohUserId}`);
    }
  }
  // For 'all', no base filter is applied

  // Apply additional filters if provided
  if (params?.filters) {
    const { statuses, severities, apps, priorities, assignees, releases } = params.filters;
    
    if (statuses && statuses.length > 0) {
      query = query.in('status_id', statuses);
    }
    
    if (severities && severities.length > 0) {
      query = query.in('severity', severities);
    }
    
    if (apps && apps.length > 0) {
      query = query.in('app', apps);
    }
    
    if (priorities && priorities.length > 0) {
      query = query.in('priority_id', priorities);
    }
    
    // Note: assignees filter expects UUIDs, not names
    // If assignees are provided as names, this would need to be handled differently
    // For now, assuming assignees are UUIDs matching assigned_to
    if (assignees && assignees.length > 0) {
      query = query.in('assigned_to', assignees);
    }

    if (releases && releases.length > 0) {
      const releaseIds = releases.filter((id) => id && id !== 'none');
      const includeNone = releases.some((id) => id === 'none');

      if (releaseIds.length > 0 && includeNone) {
        const releaseClauses = [
          `release_version_id.in.(${releaseIds.join(',')})`,
          'release_version_id.is.null',
        ].join(',');
        query = query.or(releaseClauses);
      } else if (releaseIds.length > 0) {
        query = query.in('release_version_id', releaseIds);
      } else if (includeNone) {
        query = query.is('release_version_id', null);
      }
    }
  }

  // Apply search if provided (non-My views fall through here)
  if (hasSearch && wildcardSearch && view !== 'my') {
    // Search by subject or ticket_number (human-friendly), not raw UUID id
    query = query.or(
      baseSearchFilters.join(','),
    );
  }

  // Order by creation date (oldest first for inbox, newest first for others)
  if (view === 'inbox') {
    query = query.order('created_at', { ascending: true });
  } else {
    query = query.order('updated_at', { ascending: false });
  }

  // Apply pagination when requested; default to 10 per page when page specified without pageSize
  const requestedPageSize = params?.pageSize ?? (params?.page ? 10 : undefined);
  if (requestedPageSize && requestedPageSize > 0) {
    const page = Math.max(1, params?.page ?? 1);
    const from = (page - 1) * requestedPageSize;
    const to = from + requestedPageSize - 1;
    query = query.range(from, to);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error(`Error fetching tickets for view "${view}":`, error);
    throw error;
  }

  // Transform database rows to Ticket type
  // Map user objects from explicit joins and compute assignee name
  const tickets = (data || []).map((row: any) => ({
    id: row.id,
    ticketNumber: row.ticket_number,
    subject: row.subject,
    app: row.app_record?.slug ?? row.app_context ?? row.app,
    app_id: row.app_id ?? null,
    app_context: row.app_context ?? row.app_record?.app_context ?? null,
    app_area_id: row.app_area_id,
    release_version_id: row.release_version_id ?? null,
    release_version_label: row.release?.version_label ?? null,
    release_environment: row.release?.environment ?? null,
    careerModule: row.career_module,
    category: row.category,
    severity: row.severity,
    statusId: row.status_id,
    statusKey: row.status?.key ?? '',
    statusLabel: row.status?.label ?? '',
    priorityId: row.priority_id,
    priorityKey: row.priority?.key ?? '',
    priorityLabel: row.priority?.label ?? '',
    priorityWeight: row.priority?.weight ?? null,
    createdById: row.created_by ?? null,
    assignedToId: row.assigned_to ?? null,
    // Compute assignee name from joined user object, fallback to 'Unassigned'
    assignee: row.assigned_to_user?.full_name || 'Unassigned',
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    description: row.description,
    createdAt: new Date(row.created_at),
    lastUpdatedAt: new Date(row.updated_at),
    source: row.source,
    chatTranscript: row.chat_transcript,
    // Include user objects from explicit joins
    created_by_user: row.created_by_user || null,
    assigned_to_user: row.assigned_to_user || null,
  })) as Ticket[];

  if (view === 'inbox') {
    const inboxTickets = tickets.filter((ticket) => (ticket.statusKey || ticket.statusLabel || '').toLowerCase() === 'new');
    return {
      tickets: inboxTickets,
      totalCount: inboxTickets.length,
    };
  }

  return {
    tickets,
    totalCount: typeof count === 'number' ? count : tickets.length,
  };
}

/**
 * Fetches a single ticket by ID.
 * Uses explicit joins to boh_user to avoid auto-expansion issues.
 * 
 * @param id - The ticket ID
 * @returns {Promise<Ticket | null>} The ticket, or null if not found
 * @throws {Error} If data fetching fails
 */
export async function fetchTicketById(id: string): Promise<Ticket | null> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) return null;

  // Query base table with explicit joins to boh_user using constraint names
  const { data, error } = await supabase
    .from('counter_ticket')
    .select(`
      *,
      status:counter_ticket_status!counter_ticket_status_id_fkey(id, key, label, sort_order, color_token),
      priority:counter_ticket_priority!counter_ticket_priority_id_fkey(id, key, label, weight, color_token),
      release:boh_release_version!counter_ticket_release_version_id_fkey(id, version_label, environment),
      app_record:boh_app!counter_ticket_app_id_fkey(id, slug, name, app_context, type),
      created_by_user:boh_user!counter_tickets_created_by_fkey(id, full_name, email),
      assigned_to_user:boh_user!counter_tickets_assigned_to_fkey(id, full_name, email)
    `)
    .eq('id', id)
    .eq('tenant_id', bohContext.tenant_id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Error fetching ticket by ID:', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  // Transform database row to Ticket type
  // Include user objects from explicit joins and compute assignee name
  return {
    id: data.id,
    ticketNumber: data.ticket_number,
    subject: data.subject,
    app: (data as any).app_record?.slug ?? (data as any).app_context ?? data.app,
    app_id: (data as any).app_id ?? null,
    app_context: (data as any).app_context ?? (data as any).app_record?.app_context ?? null,
    app_area_id: data.app_area_id,
    release_version_id: (data as any).release_version_id ?? null,
    release_version_label: (data as any).release?.version_label ?? null,
    release_environment: (data as any).release?.environment ?? null,
    careerModule: data.career_module,
    category: data.category,
    severity: data.severity,
    statusId: data.status_id,
    statusKey: (data as any).status?.key ?? '',
    statusLabel: (data as any).status?.label ?? '',
    priorityId: data.priority_id,
    priorityKey: (data as any).priority?.key ?? '',
    priorityLabel: (data as any).priority?.label ?? '',
    priorityWeight: (data as any).priority?.weight ?? null,
    createdById: (data as any).created_by ?? null,
    assignedToId: (data as any).assigned_to ?? null,
    // Compute assignee name from joined user object, fallback to 'Unassigned'
    assignee: data.assigned_to_user?.full_name || 'Unassigned',
    requesterName: data.requester_name,
    requesterEmail: data.requester_email,
    description: data.description,
    createdAt: new Date(data.created_at),
    lastUpdatedAt: new Date(data.updated_at),
    source: data.source,
    chatTranscript: data.chat_transcript,
    // Include user objects from explicit joins
    created_by_user: data.created_by_user || null,
    assigned_to_user: data.assigned_to_user || null,
  } as Ticket;
}

/**
 * Assigns a ticket to a BOH user by updating the assigned_to foreign key.
 * Returns the updated Ticket with joins and mappings applied.
 */
export async function assignTicket(id: string, bohUserId: string | null): Promise<Ticket> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) throw new Error('Unable to find current BOH tenant. Please re-authenticate.');

  if (bohUserId) {
    const { data: agent, error: agentError } = await supabase
      .from('boh_user')
      .select('id')
      .eq('id', bohUserId)
      .eq('tenant_id', bohContext.tenant_id)
      .eq('app_context', 'boh')
      .maybeSingle();

    if (agentError) throw agentError;
    if (!agent) throw new Error('Selected agent is not part of the current BOH tenant.');
  }

  const { data, error } = await supabase
    .from('counter_ticket')
    .update({
      assigned_to: bohUserId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', bohContext.tenant_id)
    .select(`
      *,
      status:counter_ticket_status!counter_ticket_status_id_fkey(id, key, label, sort_order, color_token),
      priority:counter_ticket_priority!counter_ticket_priority_id_fkey(id, key, label, weight, color_token),
      release:boh_release_version!counter_ticket_release_version_id_fkey(id, version_label, environment),
      app_record:boh_app!counter_ticket_app_id_fkey(id, slug, name, app_context, type),
      created_by_user:boh_user!counter_tickets_created_by_fkey(id, full_name, email),
      assigned_to_user:boh_user!counter_tickets_assigned_to_fkey(id, full_name, email)
    `)
    .single();

  if (error) {
    console.error('Error assigning ticket:', error);
    throw error;
  }

  if (!data) {
    throw new Error('Ticket assignment returned no data');
  }

  // Reuse the same mapping as fetchTicketById
  return {
    id: data.id,
    ticketNumber: data.ticket_number,
    subject: data.subject,
    app: (data as any).app_record?.slug ?? (data as any).app_context ?? data.app,
    app_id: (data as any).app_id ?? null,
    app_context: (data as any).app_context ?? (data as any).app_record?.app_context ?? null,
    app_area_id: data.app_area_id,
    release_version_id: (data as any).release_version_id ?? null,
    release_version_label: (data as any).release?.version_label ?? null,
    release_environment: (data as any).release?.environment ?? null,
    careerModule: data.career_module,
    category: data.category,
    severity: data.severity,
    statusId: data.status_id,
    statusKey: (data as any).status?.key ?? '',
    statusLabel: (data as any).status?.label ?? '',
    priorityId: data.priority_id,
    priorityKey: (data as any).priority?.key ?? '',
    priorityLabel: (data as any).priority?.label ?? '',
    priorityWeight: (data as any).priority?.weight ?? null,
    createdById: (data as any).created_by ?? null,
    assignedToId: (data as any).assigned_to ?? null,
    assignee: data.assigned_to_user?.full_name || 'Unassigned',
    requesterName: data.requester_name,
    requesterEmail: data.requester_email,
    description: data.description,
    createdAt: new Date(data.created_at),
    lastUpdatedAt: new Date(data.updated_at),
    source: data.source,
    chatTranscript: data.chat_transcript,
    created_by_user: data.created_by_user || null,
    assigned_to_user: data.assigned_to_user || null,
  } as Ticket;
}

/**
 * Updates an existing ticket comment body.
 */
export async function updateTicketComment(commentId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;

  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) throw new Error('Unable to find current BOH tenant. Please re-authenticate.');

  const { data: comment, error: commentError } = await supabase
    .from('counter_ticket_comment')
    .select('ticket_id')
    .eq('id', commentId)
    .maybeSingle();

  if (commentError) throw commentError;
  if (!comment?.ticket_id) throw new Error('Ticket comment was not found.');
  await assertCounterTicketInTenant(comment.ticket_id, bohContext.tenant_id);

  const { error } = await supabase
    .from('counter_ticket_comment')
    .update({ body: trimmed })
    .eq('id', commentId);

  if (error) {
    console.error('Error updating ticket comment:', error);
    throw error;
  }
}

// ============================================================================
// TODO: Mutation functions (to be implemented)
// ============================================================================

/**
 * Creates a new ticket.
 * 
 * @param payload - The ticket data to create
 * @returns {Promise<Ticket>} The created ticket
 */
export async function createTicket(payload: {
  subject: string;
  app: string;
  app_area_id?: string | null;
  career_module?: string | null;
  category: string;
  severity: string;
  internal_priority: string;
  status: string;
  assignee?: string | null;
  requester_name: string;
  requester_email: string;
  description: string;
  source?: string;
  chat_transcript?: any;
}): Promise<Ticket> {
  // TODO: Implement ticket creation
  throw new Error('createTicket not yet implemented');
}

/**
 * Updates a ticket.
 * 
 * @param id - The ticket ID
 * @param patch - Partial ticket data to update
 * @returns {Promise<Ticket>} The updated ticket
 */
export async function updateTicket(id: string, patch: Partial<Ticket>): Promise<Ticket> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) throw new Error('Unable to find current BOH tenant. Please re-authenticate.');

  await Promise.all([
    assertCounterLookupInTenant('counter_ticket_status', patch.statusId, bohContext.tenant_id, 'Selected status'),
    assertCounterLookupInTenant('counter_ticket_priority', patch.priorityId, bohContext.tenant_id, 'Selected priority'),
    assertCounterReleaseInTenant((patch as any).release_version_id, bohContext.tenant_id),
    assertCounterAppInTenant((patch as any).app_id, bohContext.tenant_id),
  ]);

  // Map the Partial<Ticket> to the counter_ticket table columns.
  const dbPatch: any = {};

  if (patch.statusId !== undefined) {
    dbPatch.status_id = patch.statusId;
  }

  if (patch.priorityId !== undefined) {
    dbPatch.priority_id = patch.priorityId;
  }

  // app_area_id is not a real column; we instead persist the selected area
  // into app_context/app using the Ticket.app field.

  if (patch.category !== undefined) {
    dbPatch.category = patch.category;
  }

  if (patch.severity !== undefined) {
    dbPatch.severity = patch.severity;
  }

  if (patch.description !== undefined) {
    dbPatch.description = patch.description;
  }

  if (patch.subject !== undefined) {
    dbPatch.subject = patch.subject;
  }

  if (patch.app !== undefined) {
    dbPatch.app = patch.app;
    dbPatch.app_context = patch.app_context ?? patch.app;
  }

  if ((patch as any).app_id !== undefined) {
    dbPatch.app_id = (patch as any).app_id;
  }

  if ((patch as any).app_context !== undefined) {
    dbPatch.app_context = (patch as any).app_context;
  }

  if ((patch as any).release_version_id !== undefined) {
    dbPatch.release_version_id = (patch as any).release_version_id;
  }

  // Let the backend handle updated_at via trigger if present; otherwise we can set it here
  dbPatch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('counter_ticket')
    .update(dbPatch)
    .eq('id', id)
    .eq('tenant_id', bohContext.tenant_id)
    .select(`
      *,
      status:counter_ticket_status!counter_ticket_status_id_fkey(id, key, label, sort_order, color_token),
      priority:counter_ticket_priority!counter_ticket_priority_id_fkey(id, key, label, weight, color_token),
      release:boh_release_version!counter_ticket_release_version_id_fkey(id, version_label, environment),
      app_record:boh_app!counter_ticket_app_id_fkey(id, slug, name, app_context, type),
      created_by_user:boh_user!counter_tickets_created_by_fkey(id, full_name, email),
      assigned_to_user:boh_user!counter_tickets_assigned_to_fkey(id, full_name, email)
    `)
    .single();

  if (error) {
    console.error('Error updating ticket:', error);
    throw error;
  }

  if (!data) {
    throw new Error('Ticket update returned no data');
  }

  // Reuse the same mapping as fetchTicketById
  return {
    id: data.id,
    ticketNumber: data.ticket_number,
    subject: data.subject,
    app: (data as any).app_record?.slug ?? (data as any).app_context ?? data.app,
    app_id: (data as any).app_id ?? null,
    app_context: (data as any).app_context ?? (data as any).app_record?.app_context ?? null,
    app_area_id: data.app_area_id,
    release_version_id: (data as any).release_version_id ?? null,
    release_version_label: (data as any).release?.version_label ?? null,
    release_environment: (data as any).release?.environment ?? null,
    careerModule: data.career_module,
    category: data.category,
    severity: data.severity,
    statusId: data.status_id,
    statusKey: (data as any).status?.key ?? '',
    statusLabel: (data as any).status?.label ?? '',
    priorityId: data.priority_id,
    priorityKey: (data as any).priority?.key ?? '',
    priorityLabel: (data as any).priority?.label ?? '',
    priorityWeight: (data as any).priority?.weight ?? null,
    createdById: (data as any).created_by ?? null,
    assignedToId: (data as any).assigned_to ?? null,
    assignee: data.assigned_to_user?.full_name || 'Unassigned',
    requesterName: data.requester_name,
    requesterEmail: data.requester_email,
    description: data.description,
    createdAt: new Date(data.created_at),
    lastUpdatedAt: new Date(data.updated_at),
    source: data.source,
    chatTranscript: data.chat_transcript,
    created_by_user: data.created_by_user || null,
    assigned_to_user: data.assigned_to_user || null,
} as Ticket;
}

/**
 * Assigns several tickets to a minor release, or clears the release assignment.
 */
export async function assignTicketsToRelease(ticketIds: string[], releaseVersionId: string | null): Promise<void> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) throw new Error('Unable to find current BOH tenant. Please re-authenticate.');

  const uniqueIds = Array.from(new Set(ticketIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  if (releaseVersionId) {
    const { data: release, error: releaseError } = await supabase
      .from('boh_release_version')
      .select('id')
      .eq('id', releaseVersionId)
      .eq('tenant_id', bohContext.tenant_id)
      .maybeSingle();

    if (releaseError) throw releaseError;
    if (!release) throw new Error('Selected release is not part of the current BOH tenant.');
  }

  const { error } = await supabase
    .from('counter_ticket')
    .update({
      release_version_id: releaseVersionId,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', bohContext.tenant_id)
    .in('id', uniqueIds);

  if (error) {
    console.error('Error assigning tickets to release:', error);
    throw error;
  }
}

/**
 * Assigns several tickets to a BOH user, or clears assignment.
 */
export async function assignTicketsToUser(ticketIds: string[], bohUserId: string | null): Promise<void> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) throw new Error('Unable to find current BOH tenant. Please re-authenticate.');

  const uniqueIds = Array.from(new Set(ticketIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  if (bohUserId) {
    const { data: agent, error: agentError } = await supabase
      .from('boh_user')
      .select('id')
      .eq('id', bohUserId)
      .eq('tenant_id', bohContext.tenant_id)
      .eq('app_context', 'boh')
      .maybeSingle();

    if (agentError) throw agentError;
    if (!agent) throw new Error('Selected agent is not part of the current BOH tenant.');
  }

  const { error } = await supabase
    .from('counter_ticket')
    .update({
      assigned_to: bohUserId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', bohContext.tenant_id)
    .in('id', uniqueIds);

  if (error) {
    console.error('Error assigning tickets to user:', error);
    throw error;
  }
}

/**
 * Updates a ticket's status.
 * 
 * @param id - The ticket ID
 * @param statusId - The new status ID from counter_ticket_status
 * @returns {Promise<void>}
 */
export async function updateTicketStatus(id: string, statusId: string): Promise<void> {
  // TODO: Implement status update
  throw new Error('updateTicketStatus not yet implemented');
}

/**
 * Updates a ticket's priority.
 * 
 * @param id - The ticket ID
 * @param priorityId - The new priority ID from counter_ticket_priority
 * @returns {Promise<void>}
 */
export async function updateTicketPriority(id: string, priorityId: string): Promise<void> {
  // TODO: Implement priority update
  throw new Error('updateTicketPriority not yet implemented');
}

// ============================================================================
// Ticket comments (activity)
// ============================================================================

interface TicketCommentRow {
  id: string;
  ticket_id: string;
  author_id: string | null;
  body: string;
  is_visible_to_requester: boolean;
  should_notify_requester: boolean;
  created_at: string;
}

/**
 * Fetches comments (activity) for a ticket and maps them to the Activity type
 * used by the TicketDetailPage UI.
 */
export async function fetchTicketComments(ticketId: string): Promise<Activity[]> {
  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) return [];
  await assertCounterTicketInTenant(ticketId, bohContext.tenant_id);

  const { data, error } = await supabase
    .from('counter_ticket_comment')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching ticket comments:', error);
    throw error;
  }

  const rows = (data || []) as TicketCommentRow[];

  const authorIds = Array.from(
    new Set(rows.map((row) => row.author_id).filter(Boolean) as string[]),
  );

  const authorNameById = new Map<string, string>();

  if (authorIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('boh_user')
      .select('id, full_name')
      .eq('tenant_id', bohContext.tenant_id)
      .eq('app_context', 'boh')
      .in('id', authorIds);

    if (usersError) {
      console.error('Error fetching boh_user names for ticket comments:', usersError);
    } else {
      (users || []).forEach((user) => {
        const typed = user as { id: string; full_name: string | null };
        authorNameById.set(typed.id, typed.full_name ?? '');
      });
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    const aTime = Date.parse(a.created_at);
    const bTime = Date.parse(b.created_at);
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return 0;
    }
    return bTime - aTime;
  });

  return sortedRows.map((row) => {
    const isReply = row.is_visible_to_requester;

    const closeTicketMarker = '[[close_ticket_note]]';
    const isCloseTicketNote = typeof row.body === 'string' && row.body.trimStart().startsWith(closeTicketMarker);
    const type = isCloseTicketNote ? 'Close ticket note' : (isReply ? 'Reply to user' : 'Internal note');

    const note = isCloseTicketNote
      ? row.body.replace(closeTicketMarker, '').trimStart()
      : row.body;

    const resolvedAuthor = row.author_id ? authorNameById.get(row.author_id) : undefined;
    const authorFallback = isReply ? 'Support' : 'Internal note';
    const author = resolvedAuthor && resolvedAuthor.trim() ? resolvedAuthor : authorFallback;

    return {
      id: row.id,
      authorId: row.author_id,
      author,
      timestamp: new Date(row.created_at).toLocaleString(),
      note,
      type,
    } as Activity;
  });
}

/**
 * Adds a new comment for a ticket.
 * For now we store the text and visibility flags; a future iteration can
 * populate author_id with the current boh_user and trigger email notifications.
 */
export async function addTicketComment(
  ticketId: string,
  body: string,
  options?: { isVisibleToRequester?: boolean; shouldNotifyRequester?: boolean; authorId?: string | null },
): Promise<void> {
  const { isVisibleToRequester = false, shouldNotifyRequester = false, authorId = null } = options || {};

  const bohContext = await getCurrentBohUserContext();
  if (!bohContext?.tenant_id) throw new Error('Unable to find current BOH tenant. Please re-authenticate.');
  await assertCounterTicketInTenant(ticketId, bohContext.tenant_id);

  if (authorId) {
    const { data: author, error: authorError } = await supabase
      .from('boh_user')
      .select('id')
      .eq('id', authorId)
      .eq('tenant_id', bohContext.tenant_id)
      .eq('app_context', 'boh')
      .maybeSingle();

    if (authorError) throw authorError;
    if (!author) throw new Error('Comment author is not part of the current BOH tenant.');
  }

  const payload = {
    ticket_id: ticketId,
    body,
    author_id: authorId,
    is_visible_to_requester: isVisibleToRequester,
    should_notify_requester: shouldNotifyRequester,
  };

  const { data, error } = await supabase
    .from('counter_ticket_comment')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error('Error adding ticket comment:', error);
    throw error;
  }

  // Trigger email notification via edge function when requested
  if (shouldNotifyRequester && data?.id) {
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke('counter-ticket-notify', {
        body: {
          ticket_id: ticketId,
          comment_id: data.id,
        },
      });

      if (fnError) {
        console.error('Error invoking counter-ticket-notify function:', fnError);
      } else {
        console.log('counter-ticket-notify invoked successfully:', fnData);
      }
    } catch (fnError) {
      console.error('Error invoking counter-ticket-notify function:', fnError);
      // Do not throw: the comment is saved even if email fails
    }
  }
}

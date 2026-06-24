// Edge Function: forge-overview-report
// Provides Forge-specific overview metrics for execution/delivery dashboard
// Uses real Forge data: workstreams, releases, submitted initiatives
// @ts-nocheck

import { buildCorsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const auth = await requireUser(req);
  if (!auth.success) {
    return new Response(
      JSON.stringify({ error: { message: auth.error, function_name: 'forge-overview-report' } }),
      { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseAdmin = auth.serviceClient;
  const tenantId = auth.context.bohUser?.tenant_id;

  if (!tenantId) {
    return new Response(
      JSON.stringify({ error: { message: 'Forbidden - Tenant context required', function_name: 'forge-overview-report' } }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse request body for optional filters
    const body = await req.json().catch(() => ({}));
    const { quarter, year, app_id } = body;

    // ==========================================
    // 1. SUBMITTED INITIATIVES
    // Initiatives that have been submitted to Forge for execution
    // ==========================================
    let submittedInitiativesQuery = supabaseAdmin
      .from('boh_initiative')
      .select('id, title, submitted_to_forge_at, forge_status_id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .not('submitted_to_forge_at', 'is', null)
      .eq('is_archived', false);

    if (quarter) submittedInitiativesQuery = submittedInitiativesQuery.eq('target_quarter', quarter);
    if (year) submittedInitiativesQuery = submittedInitiativesQuery.eq('target_year', year);
    if (app_id) submittedInitiativesQuery = submittedInitiativesQuery.eq('app_id', app_id);

    const { count: submittedInitiativeCount, error: submittedError } = await submittedInitiativesQuery;

    if (submittedError) {
      console.error('[forge-overview-report] Error counting submitted initiatives:', submittedError);
    }

    // ==========================================
    // 2. ACTIVE WORKSTREAMS
    // Workstreams that are currently active (not done/cancelled)
    // ==========================================
    // First get workstream statuses for lookup
    const { data: statusMap } = await supabaseAdmin
      .from('boh_workstream_status')
      .select('id, key, label')
      .eq('tenant_id', tenantId);
    
    const statusById = new Map((statusMap || []).map(s => [s.id, s]));

    // Get workstreams with initiative joins for filtering
    let workstreamsQuery = supabaseAdmin
      .from('boh_workstream')
      .select('id, status, status_id, initiative_id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (quarter || year || app_id) {
      // Need to join with initiative for filtering
      const { data: initiativeIds } = await supabaseAdmin
        .from('boh_initiative')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('is_archived', false)
        .filter(quarter ? 'target_quarter' : 'id', quarter ? 'eq' : 'not.is', quarter || null)
        .filter(year ? 'target_year' : 'id', year ? 'eq' : 'not.is', year || null)
        .filter(app_id ? 'app_id' : 'id', app_id ? 'eq' : 'not.is', app_id || null);
      
      const validInitiativeIds = (initiativeIds || []).map(i => i.id);
      if (validInitiativeIds.length > 0) {
        workstreamsQuery = workstreamsQuery.in('initiative_id', validInitiativeIds);
      }
    }

    const { data: workstreams, count: totalWorkstreams, error: workstreamsError } = await workstreamsQuery;

    if (workstreamsError) {
      console.error('[forge-overview-report] Error fetching workstreams:', workstreamsError);
    }

    // Count active (not done/cancelled) using status lookup
    const activeWorkstreams = (workstreams || []).filter(w => {
      const statusKey = statusById.get(w.status_id)?.key || w.status;
      return !['done', 'cancelled', 'completed'].includes(statusKey);
    });
    const activeWorkstreamCount = activeWorkstreams.length;

    // Count completed
    const completedWorkstreams = (workstreams || []).filter(w => {
      const statusKey = statusById.get(w.status_id)?.key || w.status;
      return ['done', 'completed'].includes(statusKey);
    });
    const completedWorkstreamCount = completedWorkstreams.length;

    // Calculate completion rate
    const totalActiveForRate = activeWorkstreamCount + completedWorkstreamCount;
    const completionRate = totalActiveForRate > 0
      ? Math.round((completedWorkstreamCount / totalActiveForRate) * 100)
      : 0;

    // ==========================================
    // 3. TOTAL MINOR RELEASES
    // ==========================================
    let minorReleasesQuery = supabaseAdmin
      .from('boh_release_version')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('release_tier', 'minor')
      .eq('is_active', true);

    if (quarter) {
      minorReleasesQuery = minorReleasesQuery.eq('quarter', quarter);
    }
    if (year) {
      minorReleasesQuery = minorReleasesQuery.eq('release_year', year);
    }

    const { count: minorReleaseCount, error: minorReleaseError } = await minorReleasesQuery;

    if (minorReleaseError) {
      console.error('[forge-overview-report] Error counting minor releases:', minorReleaseError);
    }

    // ==========================================
    // 4. NEXT RELEASE
    // Next upcoming minor release with ticket count
    // ==========================================
    const today = new Date().toISOString().split('T')[0];

    let nextReleaseQuery = supabaseAdmin
      .from('boh_release_version')
      .select(`
        id,
        version_label,
        version_number,
        release_date,
        release_year,
        quarter,
        status,
        sort_date
      `)
      .eq('tenant_id', tenantId)
      .eq('release_tier', 'minor')
      .eq('is_active', true)
      .or(`release_date.gte.${today},and(release_date.is.null,sort_date.gte.${today})`)
      .order('sort_date', { ascending: true })
      .order('release_date', { ascending: true })
      .limit(1);

    if (quarter) {
      nextReleaseQuery = nextReleaseQuery.eq('quarter', quarter);
    }
    if (year) {
      nextReleaseQuery = nextReleaseQuery.eq('release_year', year);
    }

    const { data: nextReleaseData, error: nextReleaseError } = await nextReleaseQuery;

    if (nextReleaseError) {
      console.error('[forge-overview-report] Error fetching next release:', nextReleaseError);
    }

    const nextRelease = nextReleaseData?.[0] || null;
    let nextReleaseTicketCount = 0;

    if (nextRelease) {
      // Count tickets linked to this release via release_version_id
      const { count: ticketCount, error: ticketError } = await supabaseAdmin
        .from('counter_ticket')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('release_version_id', nextRelease.id);

      if (ticketError) {
        console.error('[forge-overview-report] Error counting release tickets:', ticketError);
      } else {
        nextReleaseTicketCount = ticketCount || 0;
      }
    }

    // ==========================================
    // 5. CURRENT RELEASE WORK
    // Tickets linked to active releases
    // ==========================================
    const { data: activeReleases, error: activeReleasesError } = await supabaseAdmin
      .from('boh_release_version')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('status', ['planned', 'in progress'])
      .eq('is_active', true);

    if (activeReleasesError) {
      console.error('[forge-overview-report] Error fetching active releases:', activeReleasesError);
    }

    const activeReleaseIds = (activeReleases || []).map(r => r.id);
    let currentWorkTotalTickets = 0;
    let currentWorkCompletedTickets = 0;

    if (activeReleaseIds.length > 0) {
      // Get all tickets for active releases
      const { data: releaseTickets, error: releaseTicketsError } = await supabaseAdmin
        .from('counter_ticket')
        .select('id, status_id, status:counter_ticket_status(key)')
        .eq('tenant_id', tenantId)
        .in('release_version_id', activeReleaseIds);

      if (releaseTicketsError) {
        console.error('[forge-overview-report] Error fetching release tickets:', releaseTicketsError);
      } else {
        currentWorkTotalTickets = releaseTickets?.length || 0;
        currentWorkCompletedTickets = (releaseTickets || []).filter(t => {
          const statusKey = t.status?.key || '';
          return ['closed', 'resolved', 'done', 'completed'].includes(statusKey.toLowerCase());
        }).length;
      }
    }

    // ==========================================
    // 6. WORKSTREAM PIPELINE
    // Count by status for visual pipeline
    // ==========================================
    const { data: workstreamStatuses, error: statusError } = await supabaseAdmin
      .from('boh_workstream_status')
      .select('id, key, label, sort_order, color_token')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (statusError) {
      console.error('[forge-overview-report] Error fetching workstream statuses:', statusError);
    }

    // Build pipeline counts
    const pipelineCounts = (workstreamStatuses || []).map(status => {
      const count = (workstreams || []).filter(w =>
        w.status_id === status.id || w.status === status.key
      ).length;

      return {
        key: status.key,
        label: status.label,
        color_token: status.color_token,
        count
      };
    });

    // ==========================================
    // ASSEMBLE RESPONSE
    // ==========================================
    const reportData = {
      // Summary cards
      submitted_initiative_count: submittedInitiativeCount || 0,
      active_workstream_count: activeWorkstreamCount,
      completed_workstream_count: completedWorkstreamCount,
      total_minor_release_count: minorReleaseCount || 0,
      completion_rate: completionRate,

      // Next release panel
      next_release: nextRelease ? {
        id: nextRelease.id,
        version_label: nextRelease.version_label,
        version_number: nextRelease.version_number,
        release_date: nextRelease.release_date,
        status: nextRelease.status,
        ticket_count: nextReleaseTicketCount
      } : null,

      // Current release work
      current_release_work: {
        total_tickets: currentWorkTotalTickets,
        completed_tickets: currentWorkCompletedTickets,
        pending_tickets: currentWorkTotalTickets - currentWorkCompletedTickets
      },

      // Pipeline
      workstream_pipeline: pipelineCounts,

      // Meta
      generated_at: new Date().toISOString(),
      filters: { quarter, year, app_id }
    };

    return new Response(
      JSON.stringify({ success: true, data: reportData }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('[forge-overview-report] Error:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: error.message || 'Internal server error',
          function_name: 'forge-overview-report'
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

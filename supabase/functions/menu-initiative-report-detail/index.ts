// Edge Function: menu-initiative-report-detail
// Provides detailed report for a single initiative
// @ts-nocheck

import { buildCorsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const auth = await requireUser(req);
  if (!auth.success) {
    return new Response(JSON.stringify({ success: false, error: auth.error }), { status: auth.status, headers: corsHeaders });
  }

  const supabaseAdmin = auth.serviceClient;
  const tenantId = auth.context.bohUser?.tenant_id;

  if (!tenantId) {
    return new Response(JSON.stringify({ success: false, error: 'Forbidden - Tenant context required' }), { status: 403, headers: corsHeaders });
  }

  try {

    // Parse request body
    const body = await req.json();
    const { initiative_id } = body;

    if (!initiative_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'initiative_id is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get initiative with all related data
    const { data: initiative, error: initiativeError } = await supabaseAdmin
      .from('boh_initiative')
      .select(`
        *,
        planning_stage:planning_stage_id (
          key,
          label
        ),
        status:status_id (
          key,
          label
        ),
        app:app_id (
          id,
          name,
          slug
        ),
        major_release:major_release_id (
          id,
          version_label,
          version_number,
          release_tier,
          release_date,
          release_year,
          release_cycle,
          quarter,
          status,
          summary
        ),
        priority:priority_id (
          key,
          label
        )
      `)
      .eq('id', initiative_id)
      .eq('tenant_id', tenantId)
      .single();

    if (initiativeError || !initiative) {
      console.error('[menu-initiative-report-detail] Error fetching initiative:', initiativeError);
      return new Response(
        JSON.stringify({ success: false, error: 'Initiative not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get user stories for this initiative
    const { data: userStories, error: storiesError } = await supabaseAdmin
      .from('boh_user_story')
      .select(`
        *,
        target_release:target_release_id (
          id,
          version_label,
          version_number,
          release_tier,
          release_date,
          status
        )
      `)
      .eq('initiative_id', initiative_id)
      .eq('tenant_id', tenantId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true });

    if (storiesError) {
      console.error('[menu-initiative-report-detail] Error fetching user stories:', storiesError);
    }

    // Get minor releases linked to this initiative
    const { data: initiativeReleases, error: relError } = await supabaseAdmin
      .from('boh_initiative_release')
      .select(`
        release:release_id (
          id,
          version_label,
          version_number,
          release_tier,
          release_date,
          release_year,
          release_cycle,
          quarter,
          status,
          summary,
          parent_major_release_id,
          parent_major_release:parent_major_release_id (
            id,
            version_label,
            version_number
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('initiative_id', initiative_id);

    if (relError) {
      console.error('[menu-initiative-report-detail] Error fetching initiative releases:', relError);
    }

    // Extract minor release IDs from linked releases
    const linkedReleaseIds = initiativeReleases
      ?.filter((ir: any) => ir.release && ir.release.release_tier === 'minor')
      .map((ir: any) => ir.release.id) || [];

    // Get tickets linked to this initiative THROUGH RELEASES (BOH operating model)
    // Primary source: tickets linked to minor releases via release_version_id
    const { data: releaseTickets, error: releaseTicketsError } = await supabaseAdmin
      .from('counter_ticket')
      .select(`
        *,
        status:status_id (
          key,
          label
        ),
        priority:priority_id (
          key,
          label,
          weight
        ),
        assigned_to:assigned_to (
          id,
          full_name
        )
      `)
      .eq('tenant_id', tenantId)
      .in('release_version_id', linkedReleaseIds)
      .order('created_at', { ascending: false });

    if (releaseTicketsError) {
      console.error('[menu-initiative-report-detail] Error fetching release-linked tickets:', releaseTicketsError);
    }

    // Legacy fallback: Get any direct initiative-linked tickets (secondary source)
    const { data: directTickets, error: directTicketsError } = await supabaseAdmin
      .from('counter_ticket')
      .select(`
        *,
        status:status_id (
          key,
          label
        ),
        priority:priority_id (
          key,
          label,
          weight
        ),
        assigned_to:assigned_to (
          id,
          full_name
        )
      `)
      .eq('initiative_id', initiative_id)
      .eq('tenant_id', tenantId)
      .is('release_version_id', null) // Only get tickets NOT linked to releases
      .order('created_at', { ascending: false });

    if (directTicketsError) {
      console.error('[menu-initiative-report-detail] Error fetching direct initiative tickets:', directTicketsError);
    }

    // Combine tickets: prioritize release-linked, add direct tickets as legacy
    const allTickets = [...(releaseTickets || []), ...(directTickets || [])];
    const tickets = allTickets;

    // Calculate readiness
    const incompleteStories = (userStories || []).filter(
      (s: any) => s.status !== 'done' && !s.is_archived
    );
    const outstandingTickets = (tickets || []).filter((t: any) => {
      const statusKey = t.status?.key || '';
      return !['closed', 'resolved', 'done'].includes(statusKey.toLowerCase());
    });
    const highPriorityTickets = outstandingTickets.filter((t: any) => t.priority?.weight >= 4);

    let readiness = 'on_track';
    let readinessReason = 'Progressing as expected';

    if (initiative.no_coding_planned) {
      readiness = 'no_coding_planned';
      readinessReason = 'No coding planned for this initiative';
    } else if (initiative.status === 'done' || initiative.status === 'cancelled') {
      readiness = 'complete';
      readinessReason = 'Initiative is complete or cancelled';
    } else if (initiative.status === 'blocked') {
      readiness = 'at_risk';
      readinessReason = 'Initiative is blocked';
    } else if (highPriorityTickets.length > 0) {
      readiness = 'at_risk';
      readinessReason = `${highPriorityTickets.length} high priority tickets outstanding`;
    } else if (outstandingTickets.length > 3) {
      readiness = 'needs_attention';
      readinessReason = `${outstandingTickets.length} tickets outstanding`;
    } else if (incompleteStories.length > 5) {
      readiness = 'needs_attention';
      readinessReason = `${incompleteStories.length} user stories incomplete`;
    } else if (initiative.status === 'planned' && !initiative.major_release_id) {
      readiness = 'parked';
      readinessReason = 'No major release assigned';
    }

    // Transform user stories
    const transformedStories = (userStories || []).map((story: any) => ({
      id: story.id,
      title: story.title,
      description: story.description,
      status: story.status,
      story_points: story.story_points,
      estimated_hours: story.estimated_hours,
      is_archived: story.is_archived,
      completed_at: story.completed_at,
      target_release_id: story.target_release_id,
      target_release: story.target_release || null,
    }));

    // Transform tickets
    const transformedTickets = (tickets || []).map((ticket: any) => ({
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      category: ticket.category,
      severity: ticket.severity,
      status_key: ticket.status?.key || 'unknown',
      status_label: ticket.status?.label || 'Unknown',
      priority_key: ticket.priority?.key || 'unknown',
      priority_label: ticket.priority?.label || 'Unknown',
      priority_weight: ticket.priority?.weight || 0,
      created_at: ticket.created_at,
      assigned_to_name: ticket.assigned_to?.full_name || null,
      is_outstanding: !['closed', 'resolved', 'done'].includes(
        (ticket.status?.key || '').toLowerCase()
      ),
    }));

    // Get related minor releases
    const relatedMinorReleases = (initiativeReleases || [])
      .filter((ir: any) => ir.release && ir.release.release_tier === 'minor')
      .map((ir: any) => ({
        ...ir.release,
        parent_major_release: ir.release.parent_major_release || null,
      }));

    const reportData = {
      initiative: {
        id: initiative.id,
        title: initiative.title,
        description: initiative.description,
        status: initiative.status,
        planning_stage_key: initiative.planning_stage?.key || 'unknown',
        planning_stage_label: initiative.planning_stage?.label || 'Unknown',
        target_quarter: initiative.target_quarter,
        target_year: initiative.target_year,
        no_coding_planned: initiative.no_coding_planned,
        is_archived: initiative.is_archived,
        progress: initiative.progress || 0,
        app_id: initiative.app_id,
        app_name: initiative.app?.name || 'Unknown',
        app_slug: initiative.app?.slug || 'unknown',
        major_release_id: initiative.major_release_id,
        major_release: initiative.major_release || null,
        readiness: readiness,
        readiness_reason: readinessReason,
        linked_minor_releases: relatedMinorReleases,
        user_story_count: (userStories || []).length,
        incomplete_user_story_count: incompleteStories.length,
        ticket_count: (tickets || []).length,
        outstanding_ticket_count: outstandingTickets.length,
        high_priority_ticket_count: highPriorityTickets.length,
        governance_notes: initiative.governance_notes,
      },
      user_stories: transformedStories,
      tickets: transformedTickets,
      related_minor_releases: relatedMinorReleases,
      generated_at: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({ success: true, data: reportData }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[menu-initiative-report-detail] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// Edge Function: menu-minor-release-report
// Provides detailed report for a minor release
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
    const { release_id } = body;

    if (!release_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'release_id is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Get the minor release
    const { data: release, error: releaseError } = await supabaseAdmin
      .from('boh_release_version')
      .select(`
        *,
        parent_major_release:parent_major_release_id (
          id,
          version_label,
          version_number,
          release_date,
          status,
          summary
        )
      `)
      .eq('id', release_id)
      .eq('tenant_id', tenantId)
      .eq('release_tier', 'minor')
      .single();

    if (releaseError || !release) {
      console.error('[menu-minor-release-report] Error fetching release:', releaseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Release not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get initiatives linked to this release
    const { data: initiativeReleases, error: irError } = await supabaseAdmin
      .from('boh_initiative_release')
      .select(`
        initiative:initiative_id (
          id,
          title,
          description,
          status,
          target_quarter,
          target_year,
          no_coding_planned,
          progress,
          app:app_id (
            id,
            name,
            slug
          ),
          planning_stage:planning_stage_id (
            key,
            label
          ),
          major_release:major_release_id (
            id,
            version_label
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('release_id', release_id);

    if (irError) {
      console.error('[menu-minor-release-report] Error fetching initiatives:', irError);
    }

    // Get tickets linked to this release
    const { data: tickets, error: ticketsError } = await supabaseAdmin
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
        ),
        initiative:initiative_id (
          id,
          title
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('release_version_id', release_id)
      .order('created_at', { ascending: false });

    if (ticketsError) {
      console.error('[menu-minor-release-report] Error fetching tickets:', ticketsError);
    }

    // Get user stories targeting this release
    const { data: userStories, error: storiesError } = await supabaseAdmin
      .from('boh_user_story')
      .select(`
        *,
        initiative:initiative_id (
          id,
          title,
          app:app_id (
            id,
            name
          )
        )
      `)
      .eq('target_release_id', release_id)
      .eq('tenant_id', tenantId)
      .eq('is_archived', false);

    if (storiesError) {
      console.error('[menu-minor-release-report] Error fetching user stories:', storiesError);
    }

    // Separate outstanding vs completed tickets
    const allTickets = (tickets || []);
    const outstandingTickets = allTickets.filter((t: any) => {
      const statusKey = (t.status?.key || '').toLowerCase();
      return !['closed', 'resolved', 'done'].includes(statusKey);
    });
    const completedTickets = allTickets.filter((t: any) => {
      const statusKey = (t.status?.key || '').toLowerCase();
      return ['closed', 'resolved', 'done'].includes(statusKey);
    });

    // Get incomplete user stories
    const incompleteStories = (userStories || []).filter(
      (s: any) => s.status !== 'done' && !s.is_archived
    );

    // Calculate readiness
    let readiness = 'ready';
    let readinessReason = 'Release is ready';

    const isReleased = ['released', 'done'].includes((release.status || '').toLowerCase());
    const isBlocked = outstandingTickets.some((t: any) => t.priority?.weight >= 4);

    if (isReleased) {
      readiness = 'ready';
      readinessReason = 'Release has been deployed';
    } else if (isBlocked) {
      readiness = 'blocked';
      readinessReason = `${outstandingTickets.filter((t: any) => t.priority?.weight >= 4).length} critical tickets blocking release`;
    } else if (outstandingTickets.length > 5) {
      readiness = 'at_risk';
      readinessReason = `${outstandingTickets.length} tickets still outstanding`;
    } else if (incompleteStories.length > 3) {
      readiness = 'in_progress';
      readinessReason = `${incompleteStories.length} user stories still in progress`;
    } else {
      readiness = 'in_progress';
      readinessReason = 'Active development in progress';
    }

    // Transform related initiatives
    const relatedInitiatives = (initiativeReleases || [])
      .filter((ir: any) => ir.initiative)
      .map((ir: any) => ({
        id: ir.initiative.id,
        title: ir.initiative.title,
        description: ir.initiative.description,
        status: ir.initiative.status,
        target_quarter: ir.initiative.target_quarter,
        target_year: ir.initiative.target_year,
        no_coding_planned: ir.initiative.no_coding_planned,
        progress: ir.initiative.progress || 0,
        app_id: ir.initiative.app?.id,
        app_name: ir.initiative.app?.name || 'Unknown',
        app_slug: ir.initiative.app?.slug || 'unknown',
        planning_stage_key: ir.initiative.planning_stage?.key || 'unknown',
        planning_stage_label: ir.initiative.planning_stage?.label || 'Unknown',
        major_release_id: ir.initiative.major_release?.id || null,
      }));

    // Transform tickets
    const transformTicket = (t: any) => ({
      id: t.id,
      ticket_number: t.ticket_number,
      subject: t.subject,
      category: t.category,
      severity: t.severity,
      status_key: t.status?.key || 'unknown',
      status_label: t.status?.label || 'Unknown',
      priority_key: t.priority?.key || 'unknown',
      priority_label: t.priority?.label || 'Unknown',
      priority_weight: t.priority?.weight || 0,
      created_at: t.created_at,
      assigned_to_name: t.assigned_to?.full_name || null,
      initiative_title: t.initiative?.title || null,
    });

    // Transform user stories
    const transformStory = (s: any) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      status: s.status,
      story_points: s.story_points,
      estimated_hours: s.estimated_hours,
      initiative_title: s.initiative?.title || 'Unknown',
      app_name: s.initiative?.app?.name || 'Unknown',
    });

    const reportData = {
      release: {
        id: release.id,
        version_label: release.version_label,
        version_number: release.version_number,
        release_tier: release.release_tier,
        release_date: release.release_date,
        release_year: release.release_year,
        release_cycle: release.release_cycle,
        quarter: release.quarter,
        status: release.status,
        summary: release.summary,
        parent_major_release_id: release.parent_major_release_id,
      },
      parent_major_release: release.parent_major_release || null,
      related_initiatives: relatedInitiatives,
      outstanding_tickets: outstandingTickets.map(transformTicket),
      completed_tickets: completedTickets.map(transformTicket),
      incomplete_user_stories: incompleteStories.map(transformStory),
      readiness: readiness,
      readiness_reason: readinessReason,
      generated_at: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({ success: true, data: reportData }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[menu-minor-release-report] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});

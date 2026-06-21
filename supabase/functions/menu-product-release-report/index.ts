// Edge Function: menu-product-release-report
// Provides overview report data for Product Release Reports
// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  // Log request details for debugging
  console.log('[menu-product-release-report] Request details:', {
    method: req.method,
    hasAuthHeader: !!req.headers.get('Authorization'),
    authHeaderPrefix: req.headers.get('Authorization')?.substring(0, 20) + '...'
  });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SB_PUBLISHABLE_KEY');
  const secretKey = Deno.env.get('SB_SECRET_KEY');

  if (!supabaseUrl || !publishableKey || !secretKey) {
    console.error('[menu-product-release-report] Missing Supabase env vars');
    return new Response(
      JSON.stringify({
        error: {
          message: 'Server misconfiguration',
          function_name: 'menu-product-release-report'
        }
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  // Create user client for auth verification
  const supabaseUserClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  // Create supabaseAdmin client for database operations
  const supabaseAdmin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  // Verify the user is logged in
  const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();

  console.log('[menu-product-release-report] Auth result:', {
    hasUser: !!user,
    userError: userError?.message,
    userId: user?.id
  });

  if (userError || !user) {
    console.error('[menu-product-release-report] Unauthorized', userError);
    return new Response(
      JSON.stringify({
        error: {
          message: 'Unauthorized - Please log in',
          function_name: 'menu-product-release-report'
        }
      }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  try {
    // Parse request body
    const body = await req.json();
    const { report_window, app_id, quarter, year, readiness_filter } = body;

    // Calculate date window
    const today = new Date();
    const windowStart = today.toISOString().split('T')[0];
    let windowEnd: string;

    switch (report_window) {
      case '90days':
        windowEnd = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case '6months':
        windowEnd = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case '12months':
        windowEnd = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      default:
        windowEnd = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    // Get quarter calendar data for the window
    const { data: quarters, error: quartersError } = await supabaseAdmin
      .from('boh_quarter_calendar')
      .select('*')
      .gte('end_date', windowStart)
      .lte('start_date', windowEnd)
      .order('start_date', { ascending: true });

    if (quartersError) {
      console.error('[menu-product-release-report] Error fetching quarters:', quartersError);
    }

    // Build base query for initiatives
    let initiativesQuery = supabaseAdmin
      .from('boh_initiative')
      .select(`
        id,
        title,
        description,
        status,
        target_quarter,
        target_year,
        no_coding_planned,
        is_archived,
        progress,
        app_id,
        major_release_id,
        governance_notes,
        planning_stage:planning_stage_id (
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
        )
      `)
      .eq('is_archived', false);

    // Apply filters
    if (app_id) {
      initiativesQuery = initiativesQuery.eq('app_id', app_id);
    }

    if (quarter) {
      initiativesQuery = initiativesQuery.eq('target_quarter', quarter);
    }

    if (year) {
      initiativesQuery = initiativesQuery.eq('target_year', year);
    }

    // Get initiatives within date window based on target dates
    const { data: initiatives, error: initiativesError } = await initiativesQuery;

    if (initiativesError) {
      console.error('[menu-product-release-report] Error fetching initiatives:', initiativesError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch initiatives' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Get user stories for these initiatives
    const initiativeIds = initiatives?.map((i: any) => i.id) || [];
    const { data: userStories, error: storiesError } = await supabaseAdmin
      .from('boh_user_story')
      .select('*')
      .in('initiative_id', initiativeIds)
      .eq('is_archived', false);

    if (storiesError) {
      console.error('[menu-product-release-report] Error fetching user stories:', storiesError);
    }

    // Get minor releases linked to these initiatives
    const { data: initiativeReleases, error: relError } = await supabaseAdmin
      .from('boh_initiative_release')
      .select(`
        initiative_id,
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
          parent_major_release_id
        )
      `)
      .in('initiative_id', initiativeIds);

    if (relError) {
      console.error('[menu-product-release-report] Error fetching initiative releases:', relError);
    }

    // Extract release IDs from linked releases
    const linkedReleaseIds = initiativeReleases
      ?.filter((ir: any) => ir.release && ir.release.release_tier === 'minor')
      .map((ir: any) => ir.release.id) || [];

    // Get tickets linked to these initiatives THROUGH RELEASES (BOH operating model)
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
        )
      `)
      .in('release_version_id', linkedReleaseIds);

    if (releaseTicketsError) {
      console.error('[menu-product-release-report] Error fetching release-linked tickets:', releaseTicketsError);
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
        )
      `)
      .in('initiative_id', initiativeIds)
      .is('release_version_id', null); // Only get tickets NOT linked to releases

    if (directTicketsError) {
      console.error('[menu-product-release-report] Error fetching direct initiative tickets:', directTicketsError);
    }

    // Combine tickets: prioritize release-linked, add direct tickets as legacy
    const allTickets = [...(releaseTickets || []), ...(directTickets || [])];
    const tickets = allTickets;

    console.log('[menu-product-release-report] Debug - Data counts:', {
      initiativeCount: initiatives?.length || 0,
      storyCount: userStories?.length || 0,
      releaseTicketCount: releaseTickets?.length || 0,
      directTicketCount: directTickets?.length || 0,
      totalTicketCount: allTickets?.length || 0,
      linkedReleaseCount: linkedReleaseIds.length
    });

    // Group data by initiative
    const storiesByInitiative: Record<string, any[]> = {};
    const ticketsByInitiative: Record<string, any[]> = {};
    const minorReleasesByInitiative: Record<string, any[]> = {};

    // Group stories by initiative (unchanged - stories are initiative-linked)
    userStories?.forEach((story: any) => {
      if (!storiesByInitiative[story.initiative_id]) {
        storiesByInitiative[story.initiative_id] = [];
      }
      storiesByInitiative[story.initiative_id].push(story);
    });

    // Group tickets by initiative
    // For release-linked tickets, we need to map them back to initiatives
    const releaseToInitiativeMap: Record<string, string> = {};
    initiativeReleases?.forEach((ir: any) => {
      if (ir.release && ir.release.release_tier === 'minor') {
        releaseToInitiativeMap[ir.release.id] = ir.initiative_id;
      }
    });

    allTickets?.forEach((ticket: any) => {
      let initiativeId: string | null = null;
      
      if (ticket.release_version_id && releaseToInitiativeMap[ticket.release_version_id]) {
        // Release-linked ticket: map back to initiative
        initiativeId = releaseToInitiativeMap[ticket.release_version_id];
      } else if (ticket.initiative_id) {
        // Direct initiative-linked ticket (legacy)
        initiativeId = ticket.initiative_id;
      }
      
      if (initiativeId) {
        if (!ticketsByInitiative[initiativeId]) {
          ticketsByInitiative[initiativeId] = [];
        }
        ticketsByInitiative[initiativeId].push(ticket);
      }
    });

    console.log('[menu-product-release-report] Debug - Grouped data:', {
      initiativesWithStories: Object.keys(storiesByInitiative).length,
      initiativesWithTickets: Object.keys(ticketsByInitiative).length,
      initiativesWithReleases: Object.keys(minorReleasesByInitiative).length,
      releaseToInitiativeMappings: Object.keys(releaseToInitiativeMap).length
    });

    initiativeReleases?.forEach((ir: any) => {
      if (ir.release && ir.release.release_tier === 'minor') {
        if (!minorReleasesByInitiative[ir.initiative_id]) {
          minorReleasesByInitiative[ir.initiative_id] = [];
        }
        minorReleasesByInitiative[ir.initiative_id].push(ir.release);
      }
    });

    // Calculate readiness for each initiative
    function calculateInitiativeReadiness(initiative: any): { readiness: string; reason: string } {
      const stories = storiesByInitiative[initiative.id] || [];
      const storyTickets = ticketsByInitiative[initiative.id] || [];
      
      // Add safety checks to prevent undefined errors
      if (!Array.isArray(stories)) {
        console.error('[menu-product-release-report] Stories is not an array for initiative:', initiative.id);
        return { readiness: 'needs_attention', reason: 'Data integrity issue with stories' };
      }
      
      if (!Array.isArray(storyTickets)) {
        console.error('[menu-product-release-report] StoryTickets is not an array for initiative:', initiative.id);
        return { readiness: 'needs_attention', reason: 'Data integrity issue with tickets' };
      }
      
      const incompleteStories = stories.filter((s: any) => s && s.status !== 'done' && !s.is_archived);
      const outstandingTickets = storyTickets.filter((t: any) => {
        if (!t || !t.status) return false;
        const statusKey = t.status.key || '';
        return !['closed', 'resolved', 'done'].includes(statusKey.toLowerCase());
      });
      const highPriorityTickets = outstandingTickets.filter((t: any) => {
        return t && t.priority && t.priority.weight >= 4; // High or Critical
      });

      if (initiative.no_coding_planned) {
        return { readiness: 'no_coding_planned', reason: 'No coding planned for this initiative' };
      }

      if (initiative.status === 'done' || initiative.status === 'cancelled') {
        return { readiness: 'complete', reason: 'Initiative is complete or cancelled' };
      }

      if (initiative.status === 'blocked') {
        return { readiness: 'at_risk', reason: 'Initiative is blocked' };
      }

      if (highPriorityTickets.length > 0) {
        return { readiness: 'at_risk', reason: `${highPriorityTickets.length} high priority tickets outstanding` };
      }

      if (outstandingTickets.length > 3) {
        return { readiness: 'needs_attention', reason: `${outstandingTickets.length} tickets outstanding` };
      }

      if (incompleteStories.length > 5) {
        return { readiness: 'needs_attention', reason: `${incompleteStories.length} user stories incomplete` };
      }

      if (initiative.status === 'planned' && !initiative.major_release_id) {
        return { readiness: 'parked', reason: 'No major release assigned' };
      }

      return { readiness: 'on_track', reason: 'Progressing as expected' };
    }

    // Transform initiatives
    const transformedInitiatives = initiatives?.map((initiative: any) => {
      const stories = storiesByInitiative[initiative.id] || [];
      const storyTickets = ticketsByInitiative[initiative.id] || [];
      const incompleteStories = stories.filter((s: any) => s.status !== 'done' && !s.is_archived);
      const outstandingTickets = storyTickets.filter((t: any) => {
        const statusKey = t.status?.key || '';
        return !['closed', 'resolved', 'done'].includes(statusKey.toLowerCase());
      });
      const highPriorityTickets = outstandingTickets.filter((t: any) => t.priority?.weight >= 4);

      const readiness = calculateInitiativeReadiness(initiative);

      return {
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
        readiness: readiness.readiness,
        readiness_reason: readiness.reason,
        linked_minor_releases: minorReleasesByInitiative[initiative.id] || [],
        user_story_count: stories.length,
        incomplete_user_story_count: incompleteStories.length,
        ticket_count: storyTickets.length,
        outstanding_ticket_count: outstandingTickets.length,
        high_priority_ticket_count: highPriorityTickets.length,
        governance_notes: initiative.governance_notes,
      };
    }) || [];

    // Apply readiness filter if specified
    let filteredInitiatives = transformedInitiatives;
    if (readiness_filter) {
      filteredInitiatives = transformedInitiatives.filter(
        (i: any) => i.readiness === readiness_filter
      );
    }

    // Group by app
    const appsMap: Record<string, any> = {};
    filteredInitiatives.forEach((initiative: any) => {
      if (!appsMap[initiative.app_id]) {
        appsMap[initiative.app_id] = {
          app_id: initiative.app_id,
          app_name: initiative.app_name,
          app_slug: initiative.app_slug,
          initiatives: [],
        };
      }
      appsMap[initiative.app_id].initiatives.push(initiative);
    });

    // Build app summaries
    const apps = Object.values(appsMap).map((app: any) => {
      const activeCount = app.initiatives.filter((i: any) => i.status === 'in progress').length;
      const plannedCount = app.initiatives.filter((i: any) => i.status === 'planned').length;
      const parkedCount = app.initiatives.filter((i: any) => i.readiness === 'parked').length;
      const atRiskCount = app.initiatives.filter((i: any) => i.readiness === 'at_risk').length;
      const noCodingCount = app.initiatives.filter((i: any) => i.readiness === 'no_coding_planned').length;

      const totalStories = app.initiatives.reduce((sum: number, i: any) => sum + i.user_story_count, 0);
      const incompleteStories = app.initiatives.reduce(
        (sum: number, i: any) => sum + i.incomplete_user_story_count,
        0
      );
      const totalTickets = app.initiatives.reduce((sum: number, i: any) => sum + i.ticket_count, 0);
      const outstandingTickets = app.initiatives.reduce(
        (sum: number, i: any) => sum + i.outstanding_ticket_count,
        0
      );
      const highPriorityTickets = app.initiatives.reduce(
        (sum: number, i: any) => sum + i.high_priority_ticket_count,
        0
      );

      return {
        app_id: app.app_id,
        app_name: app.app_name,
        app_slug: app.app_slug,
        initiative_count: app.initiatives.length,
        active_initiative_count: activeCount,
        planned_initiative_count: plannedCount,
        parked_initiative_count: parkedCount,
        at_risk_count: atRiskCount,
        no_coding_count: noCodingCount,
        total_user_stories: totalStories,
        incomplete_user_stories: incompleteStories,
        total_tickets: totalTickets,
        outstanding_tickets: outstandingTickets,
        high_priority_tickets: highPriorityTickets,
        initiatives: app.initiatives,
      };
    });

    // Calculate totals
    const totalInitiatives = filteredInitiatives.length;
    const totalActive = filteredInitiatives.filter((i: any) => i.status === 'in progress').length;
    const totalPlanned = filteredInitiatives.filter((i: any) => i.status === 'planned').length;
    const totalParked = filteredInitiatives.filter((i: any) => i.readiness === 'parked').length;
    const totalAtRisk = filteredInitiatives.filter((i: any) => i.readiness === 'at_risk').length;

    const reportData = {
      report_window: report_window,
      window_start_date: windowStart,
      window_end_date: windowEnd,
      generated_at: new Date().toISOString(),
      apps: apps,
      total_initiatives: totalInitiatives,
      total_active_initiatives: totalActive,
      total_planned_initiatives: totalPlanned,
      total_parked_initiatives: totalParked,
      total_at_risk: totalAtRisk,
      total_user_stories: apps.reduce((sum: number, a: any) => sum + a.total_user_stories, 0),
      total_incomplete_stories: apps.reduce((sum: number, a: any) => sum + a.incomplete_user_stories, 0),
      total_tickets: apps.reduce((sum: number, a: any) => sum + a.total_tickets, 0),
      total_outstanding_tickets: apps.reduce((sum: number, a: any) => sum + a.outstanding_tickets, 0),
      total_high_priority_tickets: apps.reduce((sum: number, a: any) => sum + a.high_priority_tickets, 0),
    };

    return new Response(
      JSON.stringify({ success: true, data: reportData }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[menu-product-release-report] Error:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: error.message || 'Internal server error',
          function_name: 'menu-product-release-report'
        }
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

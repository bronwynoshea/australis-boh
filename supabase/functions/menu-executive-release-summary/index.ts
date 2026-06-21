// Edge Function: menu-executive-release-summary
// Provides executive-level summary for leadership
// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

const formatWindow = (val: string) => {
  return val
    .replace('days', ' days')
    .replace('months', ' months');
};

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
  console.log('[menu-executive-release-summary] Request details:', {
    method: req.method,
    hasAuthHeader: !!req.headers.get('Authorization'),
    authHeaderPrefix: req.headers.get('Authorization')?.substring(0, 20) + '...'
  });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SB_PUBLISHABLE_KEY');
  const secretKey = Deno.env.get('SB_SECRET_KEY');

  // Debug: Log which environment variables are found
  console.log('[menu-executive-release-summary] Environment variables check:', {
    supabaseUrl: supabaseUrl ? 'found' : 'missing',
    publishableKey: publishableKey ? 'found' : 'missing (SB_PUBLISHABLE_KEY)',
    secretKey: secretKey ? 'found' : 'missing (SB_SECRET_KEY)',
  });

  if (!supabaseUrl || !publishableKey || !secretKey) {
    console.error('[menu-executive-release-summary] Missing Supabase env vars');
    return new Response(
      JSON.stringify({
        error: {
          message: 'Server misconfiguration',
          function_name: 'menu-executive-release-summary'
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
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  // Create admin client for database operations
  const supabaseAdmin = createClient(supabaseUrl, secretKey);

  // Verify the user is logged in
  const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();

  console.log('[menu-executive-release-summary] Auth result:', {
    hasUser: !!user,
    userError: userError?.message,
    userId: user?.id
  });

  if (userError || !user) {
    console.error('[menu-executive-release-summary] Unauthorized', userError);
    return new Response(
      JSON.stringify({
        error: {
          message: 'Unauthorized - Please log in',
          function_name: 'menu-executive-release-summary'
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
    const { report_window } = body;

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

    // Get all active initiatives
    const { data: initiatives, error: initiativesError } = await supabaseAdmin
      .from('boh_initiative')
      .select(`
        id,
        title,
        status,
        target_quarter,
        target_year,
        no_coding_planned,
        is_archived,
        progress,
        app_id,
        major_release_id,
        app:app_id (
          id,
          name,
          slug
        ),
        planning_stage:planning_stage_id (
          key,
          label
        )
      `)
      .eq('is_archived', false)
      .neq('status', 'cancelled');

    if (initiativesError) {
      console.error('[menu-executive-release-summary] Error fetching initiatives:', initiativesError);
    }

    const initiativeIds = initiatives?.map((i: any) => i.id) || [];

    // Get user stories count
    const { data: userStories, error: storiesError } = await supabaseAdmin
      .from('boh_user_story')
      .select('id, initiative_id, status, is_archived')
      .in('initiative_id', initiativeIds)
      .eq('is_archived', false);

    if (storiesError) {
      console.error('[menu-executive-release-summary] Error fetching stories:', storiesError);
    }

    // Get initiative-release mappings for ticket aggregation
    const { data: initiativeReleases, error: irError } = await supabaseAdmin
      .from('boh_initiative_release')
      .select(`
        initiative_id,
        release:release_id (
          id,
          release_tier
        )
      `)
      .in('initiative_id', initiativeIds);

    if (irError) {
      console.error('[menu-executive-release-summary] Error fetching initiative releases:', irError);
    }

    // Extract minor release IDs from linked releases
    const linkedReleaseIds = initiativeReleases
      ?.filter((ir: any) => ir.release && ir.release.release_tier === 'minor')
      .map((ir: any) => ir.release.id) || [];

    // Get tickets THROUGH RELEASES (BOH operating model)
    // Primary source: tickets linked to minor releases via release_version_id
    const { data: releaseTickets, error: releaseTicketsError } = await supabaseAdmin
      .from('counter_ticket')
      .select(`
        id,
        release_version_id,
        status:status_id (
          key
        ),
        priority:priority_id (
          weight
        )
      `)
      .in('release_version_id', linkedReleaseIds);

    if (releaseTicketsError) {
      console.error('[menu-executive-release-summary] Error fetching release-linked tickets:', releaseTicketsError);
    }

    // Legacy fallback: Get any direct initiative-linked tickets (secondary source)
    const { data: directTickets, error: directTicketsError } = await supabaseAdmin
      .from('counter_ticket')
      .select(`
        id,
        initiative_id,
        release_version_id,
        status:status_id (
          key
        ),
        priority:priority_id (
          weight
        )
      `)
      .in('initiative_id', initiativeIds)
      .is('release_version_id', null); // Only get tickets NOT linked to releases

    if (directTicketsError) {
      console.error('[menu-executive-release-summary] Error fetching direct initiative tickets:', directTicketsError);
    }

    // Combine tickets for metrics calculation (single declaration)
    const allTickets = [...(releaseTickets || []), ...(directTickets || [])];

    // Get releases with unresolved work
    const { data: releases, error: releasesError } = await supabaseAdmin
      .from('boh_release_version')
      .select(`
        id,
        version_label,
        release_tier,
        release_date,
        status
      `)
      .in('status', ['planned', 'in progress'])
      .gte('release_date', windowStart)
      .lte('release_date', windowEnd);

    if (releasesError) {
      console.error('[menu-executive-release-summary] Error fetching releases:', releasesError);
    }

    // Group data
    const storiesByInitiative: Record<string, any[]> = {};
    const ticketsByInitiative: Record<string, any[]> = {};

    // Group stories by initiative (unchanged - stories are initiative-linked)
    userStories?.forEach((s: any) => {
      if (!storiesByInitiative[s.initiative_id]) {
        storiesByInitiative[s.initiative_id] = [];
      }
      storiesByInitiative[s.initiative_id].push(s);
    });

    // Group tickets by initiative
    // Create mapping from release to initiative for ticket aggregation
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

    // Calculate initiative-level metrics
    const activeInitiatives = (initiatives || []).filter(
      (i: any) => i.status === 'in progress'
    );

    // Apps with active initiatives
    const appsWithActiveInitiatives = new Set(activeInitiatives.map((i: any) => i.app_id)).size;

    // Initiatives at risk
    const atRiskInitiatives: any[] = [];

    // Initiatives without major release
    const withoutMajorRelease: any[] = [];

    // Initiatives without user stories
    const withoutUserStories: any[] = [];

    (initiatives || []).forEach((initiative: any) => {
      const stories = storiesByInitiative[initiative.id] || [];
      const storyTickets = ticketsByInitiative[initiative.id] || [];

      const incompleteStories = stories.filter(
        (s: any) => s.status !== 'done' && !s.is_archived
      );
      const outstandingTickets = storyTickets.filter((t: any) => {
        const statusKey = (t.status?.key || '').toLowerCase();
        return !['closed', 'resolved', 'done'].includes(statusKey);
      });
      const highPriorityTickets = outstandingTickets.filter(
        (t: any) => t.priority?.weight >= 4
      );

      // Check for risk conditions
      if (highPriorityTickets.length > 0) {
        atRiskInitiatives.push({
          initiative_id: initiative.id,
          initiative_title: initiative.title,
          app_name: initiative.app?.name || 'Unknown',
          risk_reason: `${highPriorityTickets.length} high priority tickets outstanding`,
          severity: 'high' as const,
        });
      } else if (outstandingTickets.length > 5) {
        atRiskInitiatives.push({
          initiative_id: initiative.id,
          initiative_title: initiative.title,
          app_name: initiative.app?.name || 'Unknown',
          risk_reason: `${outstandingTickets.length} tickets outstanding`,
          severity: 'medium' as const,
        });
      } else if (incompleteStories.length > 5 && initiative.status === 'in progress') {
        atRiskInitiatives.push({
          initiative_id: initiative.id,
          initiative_title: initiative.title,
          app_name: initiative.app?.name || 'Unknown',
          risk_reason: `${incompleteStories.length} user stories still incomplete`,
          severity: 'medium' as const,
        });
      }

      // Check for missing major release
      if (!initiative.major_release_id && initiative.status === 'planned') {
        withoutMajorRelease.push({
          id: initiative.id,
          title: initiative.title,
          app_name: initiative.app?.name || 'Unknown',
        });
      }

      // Check for missing user stories
      if (stories.length === 0 && !initiative.no_coding_planned) {
        withoutUserStories.push({
          id: initiative.id,
          title: initiative.title,
          app_name: initiative.app?.name || 'Unknown',
        });
      }
    });

    // Calculate totals
    const totalIncompleteStories = (userStories || []).filter(
      (s: any) => s.status !== 'done' && !s.is_archived
    ).length;

    const openTickets = allTickets.filter((t: any) => {
      const statusKey = (t.status?.key || '').toLowerCase();
      return !['closed', 'resolved', 'done'].includes(statusKey);
    });
    const highPriorityOpenTickets = openTickets.filter((t: any) => t.priority?.weight >= 4);

    // Find releases with unresolved work
    const releaseIds = (releases || []).map((r: any) => r.id);
    const releasesNeedingAttention: any[] = [];

    releaseIds.forEach((releaseId: string) => {
      const releaseTickets = allTickets.filter(
        (t: any) => t.release_version_id === releaseId
      );
      const releaseStories = (userStories || []).filter(
        (s: any) => s.target_release_id === releaseId && s.status !== 'done'
      );

      const unresolvedTickets = releaseTickets.filter((t: any) => {
        const statusKey = (t.status?.key || '').toLowerCase();
        return !['closed', 'resolved', 'done'].includes(statusKey);
      });

      if (unresolvedTickets.length > 0 || releaseStories.length > 0) {
        const release = (releases || []).find((r: any) => r.id === releaseId);
        if (release) {
          releasesNeedingAttention.push({
            release_id: releaseId,
            version_label: release.version_label,
            unresolved_ticket_count: unresolvedTickets.length,
            incomplete_story_count: releaseStories.length,
          });
        }
      }
    });

    // Build metrics
    const metrics = {
      total_apps_with_active_initiatives: appsWithActiveInitiatives,
      initiatives_at_risk: atRiskInitiatives.length,
      initiatives_without_major_release: withoutMajorRelease.length,
      initiatives_without_user_stories: withoutUserStories.length,
      total_incomplete_stories: totalIncompleteStories,
      total_open_tickets: openTickets.length,
      total_high_priority_open_tickets: highPriorityOpenTickets.length,
      releases_with_unresolved_work: releasesNeedingAttention.length,
    };

    // Build summary paragraph
    const summaryParts: string[] = [];

    if (appsWithActiveInitiatives > 0) {
      summaryParts.push(
        `${appsWithActiveInitiatives} apps have active initiatives in the ${formatWindow(report_window)} window.`
      );
    }

    if (atRiskInitiatives.length > 0) {
      summaryParts.push(
        `${atRiskInitiatives.length} initiative${atRiskInitiatives.length === 1 ? '' : 's'} require attention.`
      );
    }

    if (openTickets.length > 0) {
      summaryParts.push(
        `${openTickets.length} open ticket${openTickets.length === 1 ? '' : 's'} across all initiatives.`
      );
    }

    if (highPriorityOpenTickets.length > 0) {
      summaryParts.push(
        `${highPriorityOpenTickets.length} high priority ticket${highPriorityOpenTickets.length === 1 ? '' : 's'} need immediate attention.`
      );
    }

    if (withoutMajorRelease.length > 0) {
      summaryParts.push(
        `${withoutMajorRelease.length} planned initiative${withoutMajorRelease.length === 1 ? '' : 's'} still need major release assignment.`
      );
    }

    const summaryParagraph = summaryParts.length > 0
      ? summaryParts.join(' ')
      : 'All initiatives are on track with no immediate concerns.';

    const reportData = {
      report_window: report_window,
      window_start_date: windowStart,
      window_end_date: windowEnd,
      generated_at: new Date().toISOString(),
      metrics: metrics,
      at_risk_initiatives: atRiskInitiatives,
      releases_needing_attention: releasesNeedingAttention,
      summary_paragraph: summaryParagraph,
    };

    return new Response(
      JSON.stringify({ success: true, data: reportData }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[menu-executive-release-summary] Error:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: error.message || 'Internal server error',
          function_name: 'menu-executive-release-summary'
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

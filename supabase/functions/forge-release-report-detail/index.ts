// Edge Function: forge-release-report-detail
// Provides Forge-specific release reporting with correct ticket linkage
// Handles the real relationships: counter_ticket.release_version_id, boh_initiative_release, boh_user_story.target_release_id
// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SB_PUBLISHABLE_KEY');
  const secretKey = Deno.env.get('SB_SECRET_KEY');

  if (!supabaseUrl || !publishableKey || !secretKey) {
    console.error('[forge-release-report-detail] Missing Supabase env vars');
    return new Response(
      JSON.stringify({
        error: {
          message: 'Server misconfiguration',
          function_name: 'forge-release-report-detail'
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Pattern B auth: verify user token
  const supabaseUserClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const supabaseAdmin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();

  if (userError || !user) {
    return new Response(
      JSON.stringify({
        error: {
          message: 'Unauthorized - Please log in',
          function_name: 'forge-release-report-detail'
        }
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { report_window, app_id, quarter, year, release_id } = body;

    // ==========================================
    // RELEASE QUERY
    // Fetch releases with optional filtering
    // ==========================================
    let releasesQuery = supabaseAdmin
      .from('boh_release_version')
      .select(`
        id,
        version_label,
        version_number,
        release_tier,
        release_date,
        release_year,
        quarter,
        status,
        summary,
        parent_major_release_id,
        environment,
        is_active,
        sort_date,
        created_at,
        updated_at
      `)
      .eq('is_active', true);

    // Apply filters
    if (quarter) releasesQuery = releasesQuery.eq('quarter', quarter);
    if (year) releasesQuery = releasesQuery.eq('release_year', year);
    if (release_id) releasesQuery = releasesQuery.eq('id', release_id);
    
    // Apply report_window date filtering
    if (report_window) {
      const today = new Date().toISOString().split('T')[0];
      if (report_window === '90days') {
        const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        releasesQuery = releasesQuery.gte('release_date', today).lte('release_date', future);
      } else if (report_window === '30days') {
        const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        releasesQuery = releasesQuery.gte('release_date', today).lte('release_date', future);
      } else if (report_window === '6months') {
        const future = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        releasesQuery = releasesQuery.gte('release_date', today).lte('release_date', future);
      } else if (report_window === '12months') {
        const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        releasesQuery = releasesQuery.gte('release_date', today).lte('release_date', future);
      }
    }

    const { data: releases, error: releasesError } = await releasesQuery.order('sort_date', { ascending: true });

    if (releasesError) {
      console.error('[forge-release-report-detail] Error fetching releases:', releasesError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch releases' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const releaseIds = releases?.map((r: any) => r.id) || [];
    
    // Build parent major release lookup for minor releases
    const parentMajorIds = releases?.filter((r: any) => r.parent_major_release_id).map((r: any) => r.parent_major_release_id) || [];
    let parentMajorsById: Record<string, any> = {};
    if (parentMajorIds.length > 0) {
      const { data: parentMajors } = await supabaseAdmin
        .from('boh_release_version')
        .select('id, version_label, version_number')
        .in('id', parentMajorIds);
      parentMajorsById = Object.fromEntries((parentMajors || []).map((p: any) => [p.id, p]));
    }

    // ==========================================
    // TICKET LINKAGE STRATEGY
    // Correctly aggregates ALL tickets associated with releases
    // ==========================================
    //
    // PRIMARY LINKAGE: counter_ticket.release_version_id
    // This is the direct FK from tickets to releases.
    // When a ticket is assigned to a release, it gets this FK set.
    //
    // SECONDARY LINKAGE (for context): boh_initiative_release
    // This links initiatives to releases. We use this to:
    // - Show which initiatives are associated with a release
    // - Map release context back to planning/initiative level
    //
    // TERTIARY LINKAGE (for story tracking): boh_user_story.target_release_id
    // Stories can target a release for completion. This helps track:
    // - Stories scheduled for a release
    // - Completion status relative to release

    // ==========================================
    // 1. GET ALL RELEASE-LINKED TICKETS (PRIMARY)
    // Tickets directly linked via release_version_id
    // ==========================================
    let releaseTickets: any[] = [];
    if (releaseIds.length > 0) {
      const { data: tickets, error: ticketsError } = await supabaseAdmin
        .from('counter_ticket')
        .select(`
          id,
          ticket_number,
          subject,
          description,
          requester_name,
          requester_email,
          created_at,
          updated_at,
          release_version_id,
          initiative_id,
          status:counter_ticket_status(key, label),
          priority:counter_ticket_priority(key, label, weight)
        `)
        .in('release_version_id', releaseIds);

      if (ticketsError) {
        console.error('[forge-release-report-detail] Error fetching release tickets:', ticketsError);
      } else {
        releaseTickets = tickets || [];
      }
    }

    // ==========================================
    // 2. GET INITIATIVE-RELEASE LINKAGES (SECONDARY)
    // For context on which initiatives feed into releases
    // ==========================================
    const { data: initiativeReleases, error: irError } = await supabaseAdmin
      .from('boh_initiative_release')
      .select(`
        initiative_id,
        release_id,
        initiative:boh_initiative!inner(
          id,
          title,
          status,
          app_id,
          app:boh_app!inner(id, name, slug)
        )
      `)
      .in('release_id', releaseIds);

    if (irError) {
      console.error('[forge-release-report-detail] Error fetching initiative releases:', irError);
    }

    // Build initiative lookup by release
    const initiativesByRelease: Record<string, any[]> = {};
    (initiativeReleases || []).forEach((ir: any) => {
      if (!initiativesByRelease[ir.release_id]) {
        initiativesByRelease[ir.release_id] = [];
      }
      if (ir.initiative) {
        initiativesByRelease[ir.release_id].push(ir.initiative);
      }
    });

    // ==========================================
    // 3. GET STORIES TARGETING RELEASES (TERTIARY)
    // Stories scheduled for release completion
    // ==========================================
    const { data: releaseStories, error: storiesError } = await supabaseAdmin
      .from('boh_user_story')
      .select(`
        id,
        title,
        status,
        target_release_id,
        initiative_id,
        workstream_id,
        boh_initiative!inner(id, title)
      `)
      .in('target_release_id', releaseIds)
      .eq('is_archived', false);

    if (storiesError) {
      console.error('[forge-release-report-detail] Error fetching release stories:', storiesError);
    }

    // Build stories lookup by release
    const storiesByRelease: Record<string, any[]> = {};
    const workstreamsByRelease: Record<string, Set<string>> = {};
    (releaseStories || []).forEach((story: any) => {
      if (!storiesByRelease[story.target_release_id]) {
        storiesByRelease[story.target_release_id] = [];
      }
      storiesByRelease[story.target_release_id].push(story);
      // Track unique workstreams per release
      if (story.workstream_id) {
        if (!workstreamsByRelease[story.target_release_id]) {
          workstreamsByRelease[story.target_release_id] = new Set();
        }
        workstreamsByRelease[story.target_release_id].add(story.workstream_id);
      }
    });

    // ==========================================
    // ASSEMBLE RELEASE DETAILS
    // Combine all linkages per release
    // ==========================================
    const releaseDetails = (releases || []).map((release: any) => {
      // Get tickets directly linked to this release
      const linkedTickets = releaseTickets.filter(
        (t: any) => t.release_version_id === release.id
      );

      // Count by status
      const openTickets = linkedTickets.filter((t: any) => {
        const statusKey = (t.status?.key || '').toLowerCase();
        return !['closed', 'resolved', 'done', 'completed'].includes(statusKey);
      });

      const closedTickets = linkedTickets.filter((t: any) => {
        const statusKey = (t.status?.key || '').toLowerCase();
        return ['closed', 'resolved', 'done', 'completed'].includes(statusKey);
      });

      const highPriorityOpen = openTickets.filter((t: any) => {
        return (t.priority?.weight || 0) >= 4; // High or Critical
      });

      // Get stories for this release
      const linkedStories = storiesByRelease[release.id] || [];
      const incompleteStories = linkedStories.filter(
        (s: any) => s.status !== 'done' && s.status !== 'completed'
      );

      // Get initiatives for this release
      const linkedInitiatives = initiativesByRelease[release.id] || [];
      
      // Get parent major version label for minor releases
      const parentMajor = release.parent_major_release_id ? parentMajorsById[release.parent_major_release_id] : null;
      
      // Get workstream count for this release
      const workstreamCount = workstreamsByRelease[release.id]?.size || 0;

      return {
        id: release.id,
        version_label: release.version_label,
        version_number: release.version_number,
        release_tier: release.release_tier,
        release_date: release.release_date,
        release_year: release.release_year,
        quarter: release.quarter,
        status: release.status,
        summary: release.summary,
        environment: release.environment,
        parent_major_release_id: release.parent_major_release_id,
        parent_major_version: parentMajor?.version_label || null,

        // Ticket counts
        ticket_count: linkedTickets.length,
        open_ticket_count: openTickets.length,
        closed_ticket_count: closedTickets.length,
        high_priority_open_count: highPriorityOpen.length,

        // Story counts
        story_count: linkedStories.length,
        incomplete_story_count: incompleteStories.length,

        // Workstream and initiative context
        workstream_count: workstreamCount,
        initiative_count: linkedInitiatives.length,
        initiatives: linkedInitiatives.slice(0, 5), // Limit for payload size

        // Full tickets list (for detail view)
        tickets: linkedTickets.map((t: any) => ({
          id: t.id,
          ticket_number: t.ticket_number,
          subject: t.subject,
          description: t.description,
          requester_name: t.requester_name,
          requester_email: t.requester_email,
          created_at: t.created_at,
          updated_at: t.updated_at,
          status: t.status,
          priority: t.priority
        }))
      };
    });

    // ==========================================
    // SUMMARY METRICS
    // ==========================================
    const summary = {
      total_releases: releaseDetails.length,
      total_tickets: releaseTickets.length,
      releases_with_tickets: releaseDetails.filter((r: any) => r.ticket_count > 0).length,
      releases_with_stories: releaseDetails.filter((r: any) => r.story_count > 0).length,
      total_stories: Object.values(storiesByRelease).flat().length,
      high_priority_open_tickets: releaseDetails.reduce(
        (sum: number, r: any) => sum + r.high_priority_open_count, 0
      )
    };

    // ==========================================
    // RESPONSE
    // ==========================================
    const reportData = {
      summary,
      releases: releaseDetails,
      generated_at: new Date().toISOString(),
      filters: { report_window, app_id, quarter, year, release_id },

      // Debug info for verification
      _debug: {
        release_count: releaseIds.length,
        ticket_count: releaseTickets.length,
        initiative_link_count: (initiativeReleases || []).length,
        story_count: (releaseStories || []).length
      }
    };

    return new Response(
      JSON.stringify({ success: true, data: reportData }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('[forge-release-report-detail] Error:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: error.message || 'Internal server error',
          function_name: 'forge-release-report-detail'
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

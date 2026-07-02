import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  const requestCorsHeaders = corsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: requestCorsHeaders })
  }

  try {
    const { slug, guestName } = await req.json()

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: slug' }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get room details and access status
    const { data: roomData, error: roomError } = await supabase
      .from('loft_room as lr')
      .select(`
        lr.id,
        lr.title,
        lr.is_open,
        lr.public_join_enabled,
        lr.host_profile_id,
        p.display_name,
        p.full_name,
        p.avatar_url
      `)
      .innerJoin('profile as p', 'lr.id', 'p.personal_room_id')
      .eq('p.personal_room_slug', slug)
      .single()

    if (roomError || !roomData) {
      return new Response(
        JSON.stringify({ error: 'Room not found' }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check if guest is already on waitlist (SECURE: service role with strict filtering)
    let userApprovalStatus = undefined
    if (guestName) {
      console.log('[Get Personal Room Access] Checking waitlist for guest:', guestName, 'room:', roomData.id);
      
      // Use service role client but with VERY specific filtering to minimize security risk
      const serviceClient = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: { Authorization: `Bearer ${supabaseKey}` }
        }
      });
      
      // SECURITY: Only select the ONE specific field we need, with exact matching
      const { data: waitlistData, error: waitlistError } = await serviceClient
        .from('loft_room_waitlist')
        .select('status') // ONLY select status - no other fields
        .eq('loft_room_id', roomData.id) // Exact room match
        .eq('guest_name', guestName) // Exact guest name match
        .single() // Only return one record

      console.log('[Get Personal Room Access] Waitlist query result:', { waitlistData, waitlistError });

      if (waitlistError) {
        console.error('[Get Personal Room Access] Waitlist query error:', waitlistError);
        // Don't fail the whole request, just continue without approval status
      } else if (waitlistData) {
        userApprovalStatus = waitlistData.status
        console.log('[Get Personal Room Access] Guest approval status:', userApprovalStatus);
      }
    }

    const response = {
      roomId: roomData.id,
      title: roomData.title || 'Personal Room',
      hostName: roomData.display_name || roomData.full_name || 'Host',
      hostDetails: {
        profileId: roomData.host_profile_id,
        displayName: roomData.display_name || roomData.full_name,
        avatarUrl: roomData.avatar_url
      },
      accessStatus: {
        isOpen: roomData.is_open,
        requiresApproval: !roomData.is_open || !roomData.public_join_enabled
      },
      userApprovalStatus
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

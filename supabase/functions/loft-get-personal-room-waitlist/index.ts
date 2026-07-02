import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  console.log('[Edge Function] Request method:', req.method);
  console.log('[Edge Function] Request headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[Edge Function] Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) })
  }

  try {
    console.log('[Edge Function] Handling POST request');
    const { personalRoomId } = await req.json()
    console.log('[Edge Function] personalRoomId:', personalRoomId);

    if (!personalRoomId) {
      console.log('[Edge Function] Missing personalRoomId');
      return new Response(
        JSON.stringify({ error: 'Missing required field: personalRoomId' }),
        { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    console.log('[Edge Function] Creating Supabase client');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SB_SECRET_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('[Edge Function] Querying waitlist');
    const { data: waitlist, error } = await supabase
      .from('loft_room_waitlist')
      .select(`
        id,
        guest_name,
        guest_email,
        guest_avatar_url,
        status,
        requested_at,
        approved_at,
        approved_by
      `)
      .eq('loft_room_id', personalRoomId)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('[Edge Function] Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch waitlist', details: error.message }),
        { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('[Edge Function] Waitlist data:', waitlist);
    const formattedWaitlist = waitlist.map(entry => ({
      id: entry.id,
      guestName: entry.guest_name,
      guestEmail: entry.guest_email,
      guestAvatarUrl: entry.guest_avatar_url,
      status: entry.status,
      requestedAt: entry.requested_at,
      approvedAt: entry.approved_at,
      approvedBy: entry.approved_by
    }))

    console.log('[Edge Function] Returning success response');
    return new Response(
      JSON.stringify({ waitlist: formattedWaitlist }),
      { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[Edge Function] Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

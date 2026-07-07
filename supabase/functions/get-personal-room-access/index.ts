import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  const requestCorsHeaders = corsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: requestCorsHeaders })

  try {
    const { slug, guestName } = await req.json()
    if (!slug) {
      return new Response(JSON.stringify({ error: 'Missing required field: slug' }), { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: roomData, error: roomError } = await supabase
      .from('loft_room')
      .select('id, title, is_open, public_join_enabled, invite_code, host_boh_user_id')
      .ilike('invite_code', String(slug).trim())
      .eq('room_origin', 'personal')
      .neq('status', 'deleted')
      .maybeSingle()

    if (roomError || !roomData) {
      return new Response(JSON.stringify({ error: 'Room not found' }), { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 404 })
    }

    const { data: host } = roomData.host_boh_user_id
      ? await supabase.from('boh_user').select('id, first_name, last_name, email, avatar_url').eq('id', roomData.host_boh_user_id).maybeSingle()
      : { data: null }
    const hostName = [host?.first_name, host?.last_name].filter(Boolean).join(' ').trim() || host?.email || 'Host'

    let userApprovalStatus = undefined
    if (guestName) {
      const { data: waitlistData, error: waitlistError } = await supabase
        .from('loft_room_waitlist')
        .select('status')
        .eq('loft_room_id', roomData.id)
        .eq('guest_name', guestName)
        .maybeSingle()
      if (!waitlistError && waitlistData) userApprovalStatus = waitlistData.status
    }

    const response = {
      roomId: roomData.id,
      title: roomData.title || 'Personal Room',
      hostName,
      hostDetails: {
        profileId: null,
        bohUserId: roomData.host_boh_user_id || null,
        displayName: hostName,
        avatarUrl: host?.avatar_url || null
      },
      accessStatus: {
        isOpen: roomData.is_open,
        requiresApproval: !roomData.is_open || !roomData.public_join_enabled
      },
      userApprovalStatus
    }

    return new Response(JSON.stringify(response), { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error: any) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"
import { verifyLeaveToken } from "../_shared/loftExternalAccess.ts"

serve(async (req: Request) => {
  const requestCorsHeaders = corsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: requestCorsHeaders })
  }

  try {
    const { roomName, loftRoomId, guestName, leaveToken } = await req.json()

    const resolvedRoomId = String(loftRoomId || '').trim()
    const resolvedGuestName = String(guestName || '').trim()

    if ((!roomName && !resolvedRoomId) || !resolvedGuestName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: loftRoomId or roomName, guestName' }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    let roomId = resolvedRoomId
    if (!roomId && roomName) {
      const { data: room, error: roomError } = await supabase
        .from('loft_room')
        .select('id')
        .eq('daily_room_name', roomName)
        .maybeSingle()

      if (roomError) {
        console.error('[Update Guest Leave] Failed to resolve room:', roomError)
        return new Response(
          JSON.stringify({ error: 'Failed to resolve room', details: roomError.message }),
          { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
      roomId = room?.id || ''
    }

    if (!roomId) {
      return new Response(
        JSON.stringify({ error: 'Room not found' }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
    let hasAuthenticatedCaller = false
    if (jwt && anonKey) {
      const supabaseAuthed = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: { user } } = await supabaseAuthed.auth.getUser()
      hasAuthenticatedCaller = Boolean(user?.id)
    }

    const hasValidLeaveToken = await verifyLeaveToken(supabaseKey, String(leaveToken || ''), {
      loftRoomId: roomId,
      guestName: resolvedGuestName,
    })

    if (!hasAuthenticatedCaller && !hasValidLeaveToken) {
      return new Response(
        JSON.stringify({ error: 'leave_token_required' }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { data: deletedEntries, error: deleteError } = await supabase
      .from('loft_room_waitlist')
      .delete()
      .eq('loft_room_id', roomId)
      .eq('guest_name', resolvedGuestName)
      .select('id')

    if (deleteError) {
      console.error('[Update Guest Leave] Failed to delete waitlist entry:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete waitlist entry', details: deleteError.message }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('[Update Guest Leave] Deleted waitlist entries for guest:', resolvedGuestName, deletedEntries?.length || 0)

    return new Response(
      JSON.stringify({ 
        success: true, 
        dismissedCount: deletedEntries?.length || 0,
        message: 'Guest waitlist entry deleted successfully' 
      }),
      { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('[Update Guest Leave] Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

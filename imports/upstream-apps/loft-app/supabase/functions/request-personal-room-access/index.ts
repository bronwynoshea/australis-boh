import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

const PERSONAL_ROOM_TAG = 'personal-room'

const hasPersonalRoomTag = (room: { tags?: unknown } | null) =>
  Array.isArray(room?.tags) && room.tags.includes(PERSONAL_ROOM_TAG)

async function findPersonalRoomByInviteCode(supabase: any, inviteCode: string) {
  const roomLookup = await supabase
    .from('loft_room')
    .select('id, tags')
    .eq('invite_code', inviteCode)
    .maybeSingle()

  const room = roomLookup.data
  if (roomLookup.error || !room) return roomLookup
  if (hasPersonalRoomTag(room)) return { data: room, error: null }

  const ownerLookup = await supabase
    .from('profile')
    .select('personal_room_id')
    .eq('personal_room_id', room.id)
    .maybeSingle()

  if (ownerLookup.error || !ownerLookup.data?.personal_room_id) {
    return { data: null, error: ownerLookup.error }
  }

  return { data: room, error: null }
}

serve(async (req) => {
  const requestCorsHeaders = corsHeaders(req.headers.get('origin'))

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: requestCorsHeaders })
  }

  try {
    const { slug, guestName, guestEmail } = await req.json()

    if (!slug || !guestName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: slug, guestName' }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const normalizedSlug = String(slug).trim()
    const normalizedCode = normalizedSlug.toUpperCase()
    const normalizedName = String(guestName).trim()
    const normalizedEmail = String(guestEmail || '').trim().toLowerCase()

    let { data: room, error: roomError } = await findPersonalRoomByInviteCode(supabase, normalizedCode)

    if (!room) {
      const profileLookup = await supabase
        .from('profile')
        .select('personal_room_id')
        .eq('personal_room_slug', normalizedSlug)
        .maybeSingle()

      if (profileLookup.error || !profileLookup.data?.personal_room_id) {
        return new Response(
          JSON.stringify({ error: 'personal_room_not_found' }),
          { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      const roomLookup = await supabase
        .from('loft_room')
        .select('id')
        .eq('id', profileLookup.data.personal_room_id)
        .maybeSingle()

      room = roomLookup.data
      roomError = roomLookup.error
    }

    if (roomError || !room?.id) {
      return new Response(
        JSON.stringify({ error: 'personal_room_not_found' }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const existingQuery = supabase
      .from('loft_room_waitlist')
      .select('id, status')
      .eq('loft_room_id', room.id)
      .eq('guest_name', normalizedName)

    let { data: existing } = normalizedEmail
      ? await existingQuery.eq('guest_email', normalizedEmail).maybeSingle()
      : await existingQuery.maybeSingle()

    if (!existing && normalizedEmail) {
      const nameOnlyLookup = await supabase
        .from('loft_room_waitlist')
        .select('id, status')
        .eq('loft_room_id', room.id)
        .eq('guest_name', normalizedName)
        .maybeSingle()
      existing = nameOnlyLookup.data
    }

    if (existing?.id) {
      return new Response(
        JSON.stringify({ success: true, waitlistEntryId: existing.id, status: existing.status }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const { data, error } = await supabase
      .from('loft_room_waitlist')
      .insert({
        loft_room_id: room.id,
        guest_name: normalizedName,
        guest_email: normalizedEmail || null,
        status: 'pending',
        requested_at: new Date().toISOString(),
      })
      .select('id, status')
      .single()

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to request access', details: error.message }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    return new Response(
      JSON.stringify(data),
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

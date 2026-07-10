import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

const JOINABLE_ROOM_TAGS = new Set(['personal-room', 'interview-room', 'external-recruiter'])

const isJoinableGuestRoom = (room: { tags?: unknown; room_origin?: unknown } | null) => {
  if (!room) return false
  if (room.room_origin === 'personal') return true
  const tags = Array.isArray(room.tags) ? room.tags.map((tag) => String(tag)) : []
  return tags.some((tag) => JOINABLE_ROOM_TAGS.has(tag))
}

async function getTenantId(supabase: any, tenantSlug: string) {
  const normalizedSlug = String(tenantSlug || '').trim().toLowerCase()
  if (!normalizedSlug) return null
  const { data, error } = await supabase
    .from('boh_tenant')
    .select('id')
    .eq('slug', normalizedSlug)
    .maybeSingle()
  if (error || !data?.id) return null
  return data.id as string
}

async function findPersonalRoomByInviteCode(supabase: any, inviteCode: string, tenantSlug?: string) {
  const tenantId = await getTenantId(supabase, tenantSlug || '')
  const roomSelect = 'id, tags, tenant_id, room_origin'
  let query = supabase
    .from('loft_room')
    .select(roomSelect)
    .ilike('invite_code', inviteCode)
    .neq('status', 'deleted')
    .limit(1)
  if (tenantId) query = query.eq('tenant_id', tenantId)

  let result = await query.maybeSingle()
  if ((!result.data || !isJoinableGuestRoom(result.data)) && tenantId) {
    const globalMatch = await supabase
      .from('loft_room')
      .select(roomSelect)
      .ilike('invite_code', inviteCode)
      .neq('status', 'deleted')
      .limit(2)
    if (!globalMatch.error && Array.isArray(globalMatch.data) && globalMatch.data.length === 1) {
      result = { data: globalMatch.data[0], error: null }
    }
  }

  if (result.data && !isJoinableGuestRoom(result.data)) return { data: null, error: null }
  return result
}

serve(async (req) => {
  const requestCorsHeaders = corsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: requestCorsHeaders })
  }

  try {
    const { slug, tenantSlug, guestName, guestEmail } = await req.json()

    if (!slug || !guestName) {
      return new Response(
        JSON.stringify({ error: 'missing_required_fields', message: 'Please enter your name and try again.' }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const normalizedSlug = String(slug).trim()
    const normalizedCode = normalizedSlug.toUpperCase()
    const normalizedName = String(guestName).trim()
    const normalizedEmail = String(guestEmail || '').trim().toLowerCase()

    let { data: room, error: roomError } = await findPersonalRoomByInviteCode(supabase, normalizedCode, tenantSlug)

    if (roomError || !room?.id) {
      return new Response(
        JSON.stringify({ error: 'guest_link_not_available', message: 'This guest link is not available. Please ask the host to send a fresh link.' }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const statusQuery = supabase
      .from('loft_room_waitlist')
      .select('status')
      .eq('loft_room_id', room.id)
      .eq('guest_name', normalizedName)

    let { data: waitlistEntry, error } = normalizedEmail
      ? await statusQuery.eq('guest_email', normalizedEmail).maybeSingle()
      : await statusQuery.maybeSingle()

    if (!waitlistEntry && normalizedEmail) {
      const nameOnlyLookup = await supabase
        .from('loft_room_waitlist')
        .select('status')
        .eq('loft_room_id', room.id)
        .eq('guest_name', normalizedName)
        .maybeSingle()
      waitlistEntry = nameOnlyLookup.data
      error = nameOnlyLookup.error
    }

    const data = {
      userApprovalStatus: waitlistEntry?.status || null,
    }

    if (error) {
      console.error('[Check Guest Status] Database error:', error)
      return new Response(
        JSON.stringify({ error: 'status_check_failed', message: 'We could not check your request yet. This page will keep trying.' }),
        { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('[Check Guest Status] Result:', data);
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[Check Guest Status] Function error:', error)
    return new Response(
      JSON.stringify({ error: 'unexpected_error', message: 'Something went wrong. Please refresh and try again.' }),
      { headers: { ...requestCorsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

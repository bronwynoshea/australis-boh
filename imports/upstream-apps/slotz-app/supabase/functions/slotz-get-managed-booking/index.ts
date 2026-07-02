import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bookingId } = await req.json()
    if (!bookingId) return json({ error: 'Missing bookingId' }, 400)

    const supabase = createClient(
      requiredEnv('SLOTZ_SUPABASE_URL'),
      requiredEnv('SLOTZ_SUPABASE_ADMIN_KEY')
    )

    const { data: booking, error } = await supabase
      .from('scheduling_bookings')
      .select('*, scheduling_meeting_types(*), scheduling_staff_profiles(id, full_name, email, timezone)')
      .eq('id', bookingId)
      .single()

    if (error || !booking) return json({ error: 'Booking not found' }, 404)

    const { data: loftVideoSession, error: loftVideoSessionError } = await supabase
      .from('loft_video_session')
      .select('id, loft_room_id, join_url, status, scheduled_start_at, scheduled_end_at')
      .eq('tenant_id', booking.tenant_id)
      .eq('source_app', 'slotz')
      .eq('business_record_table', 'scheduling_bookings')
      .eq('business_record_id', booking.id)
      .maybeSingle()

    if (loftVideoSessionError) {
      console.error('Loft video session lookup failed:', loftVideoSessionError)
      return json({ error: 'Loft video session lookup failed', details: loftVideoSessionError.message }, 500)
    }

    return json({ booking: { ...booking, loft_video_session: loftVideoSession || null } })
  } catch (error) {
    console.error('Get managed booking error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

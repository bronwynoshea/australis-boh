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

    const { data: booking, error: bookingError } = await supabase
      .from('scheduling_bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) return json({ error: 'Booking not found' }, 404)

    const [
      meetingTypeResult,
      staffProfileResult,
      availabilityResult,
      blackoutsResult,
      bookingsResult,
      outlookEventsResult,
    ] = await Promise.all([
      supabase.from('scheduling_meeting_types').select('*').eq('id', booking.meeting_type_id).single(),
      supabase.from('scheduling_staff_profiles').select('*').eq('id', booking.staff_id).single(),
      supabase.from('scheduling_availability_rules').select('*').eq('staff_id', booking.staff_id).order('day_of_week'),
      supabase.from('scheduling_blackout_dates').select('*').eq('staff_id', booking.staff_id).order('date'),
      supabase.from('scheduling_bookings').select('*').eq('staff_id', booking.staff_id).order('start_time', { ascending: false }),
      supabase.from('outlook_synced_events').select('*').eq('staff_id', booking.staff_id).eq('sync_status', 'synced').order('event_start_time', { ascending: true }),
    ])

    if (meetingTypeResult.error || !meetingTypeResult.data) return json({ error: 'Meeting type not found' }, 404)
    if (staffProfileResult.error || !staffProfileResult.data) return json({ error: 'Staff profile not found' }, 404)
    if (availabilityResult.error) throw availabilityResult.error
    if (blackoutsResult.error) throw blackoutsResult.error
    if (bookingsResult.error) throw bookingsResult.error

    return json({
      booking,
      meetingType: meetingTypeResult.data,
      staffProfile: staffProfileResult.data,
      availabilityRules: availabilityResult.data || [],
      blackoutDates: blackoutsResult.data || [],
      bookings: bookingsResult.data || [],
      outlookEvents: outlookEventsResult.error ? [] : outlookEventsResult.data || [],
      outlookEventsError: outlookEventsResult.error?.message || null,
    })
  } catch (error) {
    console.error('Get reschedule context error:', error)
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

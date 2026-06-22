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

    return json({ booking })
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

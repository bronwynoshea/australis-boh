import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bookingId, reason } = await req.json()
    if (!bookingId) return json({ error: 'Missing bookingId' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: booking, error: bookingError } = await supabase
      .from('scheduling_bookings')
      .select(`
        *,
        scheduling_meeting_types(id, name, duration_minutes),
        scheduling_staff_profiles(id, full_name, email, timezone)
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) return json({ error: 'Booking not found' }, 404)
    if (booking.status === 'cancelled') return json({ success: true, booking })

    const { data: cancelledBooking, error: updateError } = await supabase
      .from('scheduling_bookings')
      .update({
        status: 'cancelled',
        cancellation_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    const calendarResult = await deleteOutlookEvent(supabase, booking)
    const emailResult = await sendCancellationEmail(booking)

    return json({
      success: true,
      booking: cancelledBooking,
      outlook_deleted: calendarResult.success,
      outlook_error: calendarResult.error,
      email_sent: emailResult.success,
      email_error: emailResult.error,
    })
  } catch (error) {
    console.error('Cancel booking error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function deleteOutlookEvent(supabase: any, booking: any) {
  const eventId = booking.external_event_id || booking.outlook_event_id
  if (!eventId || (booking.external_calendar_provider && booking.external_calendar_provider !== 'outlook')) {
    return { success: false, error: 'no_outlook_event' }
  }

  const { data: tokenData } = await supabase
    .from('outlook_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('staff_id', booking.staff_id)
    .eq('is_active', true)
    .single()

  if (!tokenData) return { success: false, error: 'no_tokens' }
  const accessToken = await getFreshAccessToken(supabase, booking.staff_id, tokenData)
  if (!accessToken) return { success: false, error: 'token_refresh_failed' }

  const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (response.status === 404) return { success: true }
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Outlook DELETE failed:', response.status, errorText)
    return { success: false, error: errorText || `Graph returned ${response.status}` }
  }

  await supabase
    .from('outlook_synced_events')
    .update({
      sync_status: 'synced',
      updated_at: new Date().toISOString(),
    })
    .eq('outlook_event_id', eventId)

  return { success: true }
}

async function getFreshAccessToken(supabase: any, staffId: string, tokenData: any) {
  const tokenExpiresAt = new Date(tokenData.expires_at)
  const now = new Date()
  const bufferMs = 5 * 60 * 1000

  if (tokenExpiresAt.getTime() - bufferMs >= now.getTime()) {
    return tokenData.access_token
  }

  const tokenResponse = await refreshAccessToken(supabase, tokenData.refresh_token)
  if (!tokenResponse) return null

  await supabase
    .from('outlook_oauth_tokens')
    .update({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token || tokenData.refresh_token,
      expires_at: new Date(now.getTime() + tokenResponse.expires_in * 1000).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('staff_id', staffId)

  return tokenResponse.access_token
}

async function refreshAccessToken(supabase: any, refreshToken: string): Promise<TokenResponse | null> {
  try {
    const { data: secrets, error } = await supabase
      .from('vault.decrypted_secrets')
      .select('decrypted_secret')
      .eq('name', 'AZURE_CLIENT_SECRET')
      .single()

    if (error || !secrets) {
      console.error('Could not get Azure client secret:', error)
      return null
    }

    const params = new URLSearchParams({
      client_id: '86361e240f0f3c76dfb879c4dd1c5513',
      client_secret: secrets.decrypted_secret,
      scope: 'https://graph.microsoft.com/.default',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })

    const response = await fetch('https://login.microsoftonline.com/76393b16d7ce5e6e93bc78c8ea1b7b5c/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!response.ok) {
      console.error('Token refresh failed:', response.status, await response.text())
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}

async function sendCancellationEmail(booking: any) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return { success: false, error: 'missing_resend_api_key' }

  const meetingType = booking.scheduling_meeting_types
  const staffTimezone = booking.scheduling_staff_profiles?.timezone || 'UTC'
  const startTime = new Date(booking.start_time)
  const formattedDate = startTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: staffTimezone,
  })
  const formattedTime = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: staffTimezone,
  })

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #211f42;">
      <h1 style="color: #635CCD;">JOBZ CAFE</h1>
      <h2>Your session has been canceled</h2>
      <p>Hi ${booking.guest_name}, this confirms your <strong>${meetingType?.name || 'session'}</strong> on ${formattedDate} at ${formattedTime} has been canceled.</p>
      <p>There is no further action required.</p>
    </div>
  `

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: 'JOBZ CAFE <noreply@auth.jobzcafe.com>',
    to: [booking.guest_email],
    subject: `Canceled: Your JOBZ CAFE ${meetingType?.name || 'session'}`,
    html,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

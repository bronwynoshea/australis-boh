import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RescheduleRequest {
  bookingId: string
  startTime: string
  endTime: string
  guestTimezone?: string | null
  reason?: string
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
    const payload: RescheduleRequest = await req.json()
    if (!payload.bookingId || !payload.startTime || !payload.endTime) {
      return json({ error: 'Missing bookingId, startTime, or endTime' }, 400)
    }

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
      .eq('id', payload.bookingId)
      .single()

    if (bookingError || !booking) return json({ error: 'Booking not found' }, 404)
    if (booking.status === 'cancelled') return json({ error: 'Cancelled bookings cannot be rescheduled' }, 409)

    const newStart = new Date(payload.startTime)
    const newEnd = new Date(payload.endTime)
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime()) || newEnd <= newStart) {
      return json({ error: 'Invalid reschedule time range' }, 400)
    }

    const { data: conflicts, error: conflictError } = await supabase
      .from('scheduling_bookings')
      .select('id')
      .eq('staff_id', booking.staff_id)
      .eq('status', 'confirmed')
      .neq('id', booking.id)
      .lt('start_time', payload.endTime)
      .gt('end_time', payload.startTime)

    if (conflictError) throw conflictError
    if (conflicts && conflicts.length > 0) return json({ error: 'That time is no longer available' }, 409)

    const now = new Date().toISOString()
    const updates = {
      start_time: payload.startTime,
      end_time: payload.endTime,
      guest_timezone: payload.guestTimezone || booking.guest_timezone,
      rescheduled_at: now,
      rescheduled_by: 'guest',
      reschedule_reason: payload.reason || null,
      previous_start_time: booking.start_time,
      previous_end_time: booking.end_time,
      updated_at: now,
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('scheduling_bookings')
      .update(updates)
      .eq('id', booking.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    const calendarResult = await patchOutlookEvent(supabase, updatedBooking, booking)
    const emailResult = await sendRescheduleEmail(updatedBooking, booking)

    return json({
      success: true,
      booking: updatedBooking,
      outlook_synced: calendarResult.success,
      outlook_error: calendarResult.error,
      email_sent: emailResult.success,
      email_error: emailResult.error,
    })
  } catch (error) {
    console.error('Reschedule booking error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function patchOutlookEvent(supabase: any, updatedBooking: any, originalBooking: any) {
  const eventId = updatedBooking.external_event_id || updatedBooking.outlook_event_id
  if (!eventId || (updatedBooking.external_calendar_provider && updatedBooking.external_calendar_provider !== 'outlook')) {
    return { success: false, error: 'no_outlook_event' }
  }

  const { data: tokenData } = await supabase
    .from('outlook_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('staff_id', updatedBooking.staff_id)
    .eq('is_active', true)
    .single()

  if (!tokenData) return { success: false, error: 'no_tokens' }
  const accessToken = await getFreshAccessToken(supabase, updatedBooking.staff_id, tokenData)
  if (!accessToken) return { success: false, error: 'token_refresh_failed' }

  const timezone = originalBooking.scheduling_staff_profiles?.timezone || 'UTC'
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: `outlook.timezone="${timezone}"`,
    },
    body: JSON.stringify({
      start: { dateTime: updatedBooking.start_time, timeZone: timezone },
      end: { dateTime: updatedBooking.end_time, timeZone: timezone },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Outlook PATCH failed:', response.status, errorText)
    return { success: false, error: errorText || `Graph returned ${response.status}` }
  }

  await supabase
    .from('outlook_synced_events')
    .update({
      event_start_time: updatedBooking.start_time,
      event_end_time: updatedBooking.end_time,
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

async function sendRescheduleEmail(updatedBooking: any, originalBooking: any) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return { success: false, error: 'missing_resend_api_key' }

  const meetingType = originalBooking.scheduling_meeting_types
  const staffTimezone = originalBooking.scheduling_staff_profiles?.timezone || 'UTC'
  const guestTimezone = updatedBooking.guest_timezone || staffTimezone
  const startTime = new Date(updatedBooking.start_time)

  const formatDate = (date: Date, timeZone: string) => date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  })

  const formatTime = (date: Date, timeZone: string) => date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #211f42;">
      <h1 style="color: #635CCD;">JOBZ CAFE</h1>
      <h2>Your session has been rescheduled</h2>
      <p>Hi ${updatedBooking.guest_name}, your <strong>${meetingType?.name || 'session'}</strong> has a new time.</p>
      <div style="background: #f4f4f7; padding: 20px; border-radius: 12px;">
        <p><strong>New date:</strong> ${formatDate(startTime, guestTimezone)}</p>
        <p><strong>New time:</strong> ${formatTime(startTime, guestTimezone)}</p>
        ${guestTimezone !== staffTimezone ? `<p style="color: #666;">Staff time: ${formatTime(startTime, staffTimezone)}</p>` : ''}
      </div>
      <p>Your calendar invite has also been updated where calendar sync is connected.</p>
    </div>
  `

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: 'JOBZ CAFE <noreply@auth.jobzcafe.com>',
    to: [updatedBooking.guest_email],
    subject: `Rescheduled: Your JOBZ CAFE ${meetingType?.name || 'session'}`,
    html,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

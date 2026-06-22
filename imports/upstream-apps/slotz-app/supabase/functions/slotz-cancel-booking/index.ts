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
      requiredEnv('SLOTZ_SUPABASE_URL'),
      requiredEnv('SLOTZ_SUPABASE_ADMIN_KEY')
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
      .eq('name', 'SLOTZ_AZURE_CLIENT_SECRET')
      .single()

    if (error || !secrets) {
      console.error('Could not get Azure client secret:', error)
      return null
    }

    const params = new URLSearchParams({
      client_id: requiredEnv('SLOTZ_AZURE_CLIENT_ID'),
      client_secret: secrets.decrypted_secret,
      scope: 'offline_access User.Read Calendars.ReadWrite',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })

    const response = await fetch(`https://login.microsoftonline.com/${requiredEnv('SLOTZ_AZURE_TENANT_ID')}/oauth2/v2.0/token`, {
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
  const apiKey = Deno.env.get('SLOTZ_RESEND_API_KEY')
  if (!apiKey) return { success: false, error: 'missing_resend_api_key' }

  const meetingType = booking.scheduling_meeting_types
  const staffProfile = booking.scheduling_staff_profiles
  if (!meetingType?.name) return { success: false, error: 'missing_meeting_type' }
  if (!staffProfile?.full_name) return { success: false, error: 'missing_staff_profile' }
  if (!staffProfile?.email) return { success: false, error: 'missing_staff_email' }
  if (!staffProfile?.timezone) return { success: false, error: 'missing_staff_timezone' }
  const guestTimezone = booking.guest_timezone
  if (!guestTimezone) return { success: false, error: 'missing_guest_timezone' }

  const startTime = new Date(booking.start_time)
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

  const guestHtml = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background:#f7f4ff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#2f255f;">
      <div style="max-width:640px; margin:0 auto; padding:36px 20px;">
        <div style="background:#ffffff; border:1px solid #e7ddff; border-radius:28px; overflow:hidden; box-shadow:0 18px 48px rgba(99,92,205,0.12);">
          <div style="padding:34px;">
            <div style="font-size:13px; line-height:1; letter-spacing:0.18em; text-transform:uppercase; font-weight:800; color:#635ccd;">JOBZ CAFE&reg; | SLOTZ</div>
            <h1 style="margin:26px 0 10px 0; font-size:32px; line-height:1.16; font-weight:700; color:#2f255f;">Your session has been canceled</h1>
            <p style="margin:0 0 22px 0; font-size:17px; line-height:1.65; color:#514873;">Hi ${booking.guest_name}, this confirms your ${meetingType.name} with ${staffProfile.full_name} has been canceled.</p>
            <div style="padding:24px; border-radius:22px; background:#f4f0ff; border:1px solid #e8ddff;">
              <p style="margin:0 0 12px 0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Date:</strong> ${formatDate(startTime, guestTimezone)}</p>
              <p style="margin:0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Time:</strong> ${formatTime(startTime, guestTimezone)}</p>
            </div>
            <p style="margin:22px 0 0 0; font-size:15px; line-height:1.65; color:#514873;">There is no further action required.</p>
          </div>
        </div>
        <p style="text-align:center; margin:20px 0 0 0; color:#746b92; font-size:13px;">Powered by JOBZ CAFE&reg;</p>
      </div>
    </body>
    </html>
  `

  const staffHtml = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background:#f7f4ff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#2f255f;">
      <div style="max-width:640px; margin:0 auto; padding:36px 20px;">
        <div style="background:#ffffff; border:1px solid #e7ddff; border-radius:28px; overflow:hidden; box-shadow:0 18px 48px rgba(99,92,205,0.12);">
          <div style="padding:34px;">
            <div style="font-size:13px; line-height:1; letter-spacing:0.18em; text-transform:uppercase; font-weight:800; color:#635ccd;">JOBZ CAFE&reg; | SLOTZ</div>
            <h1 style="margin:26px 0 10px 0; font-size:32px; line-height:1.16; font-weight:700; color:#2f255f;">A session was canceled</h1>
            <p style="margin:0 0 22px 0; font-size:17px; line-height:1.65; color:#514873;">${booking.guest_name}'s ${meetingType.name} session has been canceled in SLOTZ.</p>
            <div style="padding:24px; border-radius:22px; background:#f4f0ff; border:1px solid #e8ddff;">
              <p style="margin:0 0 12px 0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Date:</strong> ${formatDate(startTime, staffProfile.timezone)}</p>
              <p style="margin:0 0 12px 0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Time:</strong> ${formatTime(startTime, staffProfile.timezone)}</p>
              <p style="margin:0; font-size:14px; line-height:1.6; color:#746b92;"><strong>Guest:</strong> ${booking.guest_email}</p>
            </div>
          </div>
        </div>
        <p style="text-align:center; margin:20px 0 0 0; color:#746b92; font-size:13px;">Powered by JOBZ CAFE&reg;</p>
      </div>
    </body>
    </html>
  `

  const resend = new Resend(apiKey)
  const guestEmail = await resend.emails.send({
    from: 'JOBZ CAFE\u00AE <noreply@auth.jobzcafe.com>',
    to: [booking.guest_email],
    subject: `Canceled: Your JOBZ CAFE\u00AE ${meetingType.name}`,
    html: guestHtml,
  })
  if (guestEmail.error) return { success: false, error: `guest_email_failed: ${guestEmail.error.message}` }

  const staffEmail = await resend.emails.send({
    from: 'JOBZ CAFE\u00AE <noreply@auth.jobzcafe.com>',
    to: [staffProfile.email],
    subject: `SLOTZ canceled: ${booking.guest_name} - ${meetingType.name}`,
    html: staffHtml,
  })
  if (staffEmail.error) return { success: false, error: `staff_email_failed: ${staffEmail.error.message}` }
  return { success: true }
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

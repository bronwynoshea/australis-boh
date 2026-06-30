import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'
import { upsertLoftVideoSessionForBooking } from '../_shared/slotzLoftBridge.ts'

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
      requiredEnv('SLOTZ_SUPABASE_URL'),
      requiredEnv('SLOTZ_SUPABASE_ADMIN_KEY')
    )

    const { data: booking, error: bookingError } = await supabase
      .from('scheduling_bookings')
      .select(`
        *,
        scheduling_meeting_types(*),
        scheduling_staff_profiles(*)
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
      .select(`
        *,
        scheduling_meeting_types(*),
        scheduling_staff_profiles(*)
      `)
      .single()

    if (updateError) throw updateError

    const loftResult = await upsertLoftVideoSessionForBooking(supabase, updatedBooking, {
      status: 'scheduled',
      previousBooking: booking,
    })
    const calendarResult = await patchOutlookEvent(supabase, updatedBooking, booking)
    const emailResult = await sendRescheduleEmail(updatedBooking, booking)

    return json({
      success: true,
      booking: updatedBooking,
      outlook_synced: calendarResult.success,
      outlook_error: calendarResult.error,
      email_sent: emailResult.success,
      email_error: emailResult.error,
      loft_video_session_id: loftResult.videoSessionId || null,
      loft_join_url: loftResult.joinUrl || null,
      loft_bridge_success: loftResult.success === true,
      loft_bridge_error: loftResult.error || null,
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

  const timezone = originalBooking.scheduling_staff_profiles?.timezone
  if (!timezone) return { success: false, error: 'missing_staff_timezone' }
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
      .eq('name', 'SLOTZ_AZURE_CLIENT_SECRET')
      .maybeSingle()

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

async function sendRescheduleEmail(updatedBooking: any, originalBooking: any) {
  const apiKey = Deno.env.get('SLOTZ_RESEND_API_KEY')
  if (!apiKey) return { success: false, error: 'missing_resend_api_key' }

  const meetingType = originalBooking.scheduling_meeting_types
  const staffProfile = originalBooking.scheduling_staff_profiles
  const guestTimezone = updatedBooking.guest_timezone
  if (!meetingType?.name) return { success: false, error: 'missing_meeting_type' }
  if (!staffProfile?.full_name) return { success: false, error: 'missing_staff_profile' }
  if (!staffProfile?.email) return { success: false, error: 'missing_staff_email' }
  if (!staffProfile?.timezone) return { success: false, error: 'missing_staff_timezone' }
  if (!guestTimezone) return { success: false, error: 'missing_guest_timezone' }
  const appUrl = Deno.env.get('SLOTZ_APP_URL')
  if (!appUrl) return { success: false, error: 'missing_app_url' }

  const startTime = new Date(updatedBooking.start_time)
  const originalStartTime = new Date(originalBooking.start_time)
  const manageUrl = `${appUrl}/#manage-${updatedBooking.id}`

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
          <div style="padding:34px 34px 20px 34px;">
            <div style="font-size:13px; line-height:1; letter-spacing:0.18em; text-transform:uppercase; font-weight:800; color:#635ccd;">JOBZ CAFE&reg; | SLOTZ</div>
            <h1 style="margin:26px 0 10px 0; font-size:32px; line-height:1.16; font-weight:700; color:#2f255f;">Your session has been rescheduled</h1>
            <p style="margin:0; font-size:17px; line-height:1.65; color:#514873;">Hi ${updatedBooking.guest_name}, your ${meetingType.name} with ${staffProfile.full_name} has a new time.</p>
          </div>

          <div style="margin:10px 34px 28px 34px; padding:24px; border-radius:22px; background:#f4f0ff; border:1px solid #e8ddff;">
            <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; font-weight:800; color:#635ccd; margin-bottom:16px;">New session details</div>
            <p style="margin:0 0 12px 0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Date:</strong> ${formatDate(startTime, guestTimezone)}</p>
            <p style="margin:0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Time:</strong> ${formatTime(startTime, guestTimezone)}</p>
          </div>

          <div style="padding:0 34px 34px 34px;">
            <p style="margin:0 0 22px 0; font-size:15px; line-height:1.65; color:#514873;">Your SLOTZ booking has been updated. Please use the manage link below for any future changes so staff are notified.</p>
            <a href="${manageUrl}" style="display:block; text-align:center; background:#635ccd; color:#ffffff; text-decoration:none; padding:16px 20px; border-radius:16px; font-weight:800; font-size:16px;">Manage Session</a>
            <p style="margin:22px 0 0 0; font-size:13px; line-height:1.6; color:#746b92;">Calendar invites are updated where staff calendar sync is connected. If you added a personal calendar reminder, moving that copy will not update SLOTZ.</p>
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
    to: [updatedBooking.guest_email],
    subject: `Rescheduled: Your JOBZ CAFE\u00AE ${meetingType.name}`,
    html: guestHtml,
  })

  if (guestEmail.error) return { success: false, error: `guest_email_failed: ${guestEmail.error.message}` }

  const staffHtml = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background:#f7f4ff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#2f255f;">
      <div style="max-width:640px; margin:0 auto; padding:36px 20px;">
        <div style="background:#ffffff; border:1px solid #e7ddff; border-radius:28px; overflow:hidden; box-shadow:0 18px 48px rgba(99,92,205,0.12);">
          <div style="padding:34px 34px 20px 34px;">
            <div style="font-size:13px; line-height:1; letter-spacing:0.18em; text-transform:uppercase; font-weight:800; color:#635ccd;">JOBZ CAFE&reg; | SLOTZ</div>
            <h1 style="margin:26px 0 10px 0; font-size:32px; line-height:1.16; font-weight:700; color:#2f255f;">A guest rescheduled</h1>
            <p style="margin:0; font-size:17px; line-height:1.65; color:#514873;">${updatedBooking.guest_name} moved their ${meetingType.name} session.</p>
          </div>

          <div style="margin:10px 34px 18px 34px; padding:24px; border-radius:22px; background:#f4f0ff; border:1px solid #e8ddff;">
            <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; font-weight:800; color:#635ccd; margin-bottom:16px;">Updated time</div>
            <p style="margin:0 0 12px 0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Date:</strong> ${formatDate(startTime, staffProfile.timezone)}</p>
            <p style="margin:0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Time:</strong> ${formatTime(startTime, staffProfile.timezone)}</p>
          </div>

          <div style="margin:0 34px 28px 34px; padding:18px 24px; border-radius:18px; background:#ffffff; border:1px solid #eee8ff;">
            <p style="margin:0; font-size:14px; line-height:1.6; color:#746b92;"><strong>Previous:</strong> ${formatDate(originalStartTime, staffProfile.timezone)} at ${formatTime(originalStartTime, staffProfile.timezone)}</p>
            <p style="margin:8px 0 0 0; font-size:14px; line-height:1.6; color:#746b92;"><strong>Guest:</strong> ${updatedBooking.guest_name} | ${updatedBooking.guest_email}</p>
          </div>

          <div style="padding:0 34px 34px 34px;">
            <p style="margin:0; font-size:15px; line-height:1.65; color:#514873;">SLOTZ has updated the booking record. Outlook sync has also been attempted where calendar sync is connected.</p>
          </div>
        </div>
        <p style="text-align:center; margin:20px 0 0 0; color:#746b92; font-size:13px;">Powered by JOBZ CAFE&reg;</p>
      </div>
    </body>
    </html>
  `

  const staffEmail = await resend.emails.send({
    from: 'JOBZ CAFE\u00AE <noreply@auth.jobzcafe.com>',
    to: [staffProfile.email],
    subject: `SLOTZ rescheduled: ${updatedBooking.guest_name} - ${meetingType.name}`,
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

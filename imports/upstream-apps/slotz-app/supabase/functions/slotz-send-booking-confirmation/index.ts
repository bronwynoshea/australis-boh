import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { absoluteBohUrl, upsertLoftVideoSessionForBooking } from '../_shared/slotzLoftBridge.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const normalizeText = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const normalizeEmail = (value: unknown) => normalizeText(value).toLowerCase()

const splitName = (fullName: string) => {
  const parts = fullName.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) {
    return { firstName: fullName, lastName: '' }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.at(-1) ?? '',
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function loadBookingWithRetry(supabaseClient: any, bookingId: string) {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= 6; attempt++) {
    const { data: booking, error } = await supabaseClient
      .from('scheduling_bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()

    if (booking) return booking
    lastError = error
    await wait(attempt * 250)
  }

  console.error('Booking lookup failed after trigger retry window:', lastError)
  throw new Error('Booking not found')
}

async function loadMeetingType(supabaseClient: any, meetingTypeId: string) {
  const { data, error } = await supabaseClient
    .from('scheduling_meeting_types')
    .select('*')
    .eq('id', meetingTypeId)
    .single()

  if (error || !data) throw new Error('Missing meeting type')
  return data
}

async function loadStaffProfile(supabaseClient: any, staffId: string) {
  const { data, error } = await supabaseClient
    .from('scheduling_staff_profiles')
    .select('*')
    .eq('id', staffId)
    .single()

  if (error || !data) throw new Error('Missing staff profile context')
  return data
}

async function upsertPatronPerson(supabaseClient: any, booking: any) {
  const email = normalizeEmail(booking.guest_email)
  const fullName = normalizeText(booking.guest_name)
  const phone = normalizeText(booking.guest_phone)

  if (!email || !email.includes('@')) throw new Error('Missing valid guest email for Patron contact')
  if (!fullName) throw new Error('Missing guest name for Patron contact')

  const { firstName, lastName } = splitName(fullName)
  let lookup = supabaseClient
    .from('patron_person')
    .select('id, first_name, last_name, email, phone, source, tenant_id')
    .eq('email', email)
  if (booking.tenant_id) lookup = lookup.eq('tenant_id', booking.tenant_id)

  const { data: existing, error: lookupError } = await lookup.maybeSingle()

  if (lookupError) throw new Error(`Patron contact lookup failed: ${lookupError.message}`)

  if (existing?.id) {
    const updates: Record<string, unknown> = {}

    if (!existing.first_name && firstName) updates.first_name = firstName
    if (!existing.last_name && lastName) updates.last_name = lastName
    if (!existing.phone && phone) updates.phone = phone
    if (!existing.source) updates.source = 'slotz_booking'

    if (Object.keys(updates).length === 0) return existing

    const { data: updated, error: updateError } = await supabaseClient
      .from('patron_person')
      .update(updates)
      .eq('id', existing.id)
      .select('id, email')
      .single()

    if (updateError) throw new Error(`Patron contact update failed: ${updateError.message}`)
    return updated
  }

  const { data: created, error: createError } = await supabaseClient
    .from('patron_person')
    .insert({
      tenant_id: booking.tenant_id || null,
      first_name: firstName || null,
      last_name: lastName || null,
      email,
      phone: phone || null,
      source: 'slotz_booking',
      app_context: 'patron',
    })
    .select('id, email')
    .single()

  if (createError) throw new Error(`Patron contact create failed: ${createError.message}`)
  return created
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bookingId } = await req.json()
    if (!bookingId) throw new Error('Missing bookingId')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('SLOTZ_RESEND_API_KEY')
    const appUrl = Deno.env.get('SLOTZ_APP_URL')

    if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase configuration')
    if (!resendApiKey) throw new Error('Missing SLOTZ_RESEND_API_KEY')
    if (!appUrl) throw new Error('Missing SLOTZ_APP_URL')
    if (appUrl.includes('localhost')) throw new Error('SLOTZ_APP_URL must be a public SLOTZ URL for guest emails')

    const supabaseClient = createClient(supabaseUrl, serviceKey)

    const booking = await loadBookingWithRetry(supabaseClient, bookingId)

    const meetingType = await loadMeetingType(supabaseClient, booking.meeting_type_id)
    const staffProfile = await loadStaffProfile(supabaseClient, booking.staff_id)
    const guestTimezone = booking.guest_timezone

    if (!meetingType?.name) throw new Error('Missing meeting type')
    if (!staffProfile?.full_name || !staffProfile?.email || !staffProfile?.timezone) {
      throw new Error('Missing staff profile context')
    }
    if (!guestTimezone) throw new Error('Missing guest timezone')

    const patronPerson = await upsertPatronPerson(supabaseClient, booking)
    const loftResult = await upsertLoftVideoSessionForBooking(supabaseClient, {
      ...booking,
      patron_person_id: patronPerson.id,
    })
    const loftJoinUrl = loftResult.success && loftResult.joinUrl ? absoluteBohUrl(loftResult.joinUrl) : ''

    const startTime = new Date(booking.start_time)
    const endTime = new Date(booking.end_time)
    const manageUrl = `${appUrl}/manage/${booking.id}`

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

    const sendEmail = async (to: string, subject: string, html: string) => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'JOBZ CAFE\u00AE <noreply@auth.jobzcafe.com>',
        to,
        subject,
        html,
      }),
    })

    const formatDateUTC = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
    const reminderTitle = `${meetingType.name} with ${staffProfile.full_name}`
    const reminderLocation = 'Online session'
    const sessionJoinUrl = loftJoinUrl || staffProfile.meeting_link || ''
    const reminderDetails = [
      `Your ${meetingType.name} with ${staffProfile.full_name} is confirmed.`,
      sessionJoinUrl ? `Join the session: ${sessionJoinUrl}` : '',
      'Need to reschedule or cancel? Use the Manage Session button in your SLOTZ confirmation email so your host is notified and the booking stays in sync.',
      'This calendar entry is a reminder only.'
    ].filter(Boolean).join('\n\n')
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(reminderTitle)}&dates=${formatDateUTC(startTime)}/${formatDateUTC(endTime)}&ctz=${encodeURIComponent(guestTimezone)}&details=${encodeURIComponent(reminderDetails)}&location=${encodeURIComponent(reminderLocation)}`
    const outlookCalendarUrl = `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(reminderTitle)}&startdt=${encodeURIComponent(startTime.toISOString())}&enddt=${encodeURIComponent(endTime.toISOString())}&body=${encodeURIComponent(reminderDetails)}&location=${encodeURIComponent(reminderLocation)}`

    const guestHtml = `
      <!DOCTYPE html>
      <html>
      <body style="margin:0; padding:0; background:#f7f4ff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; color:#2f255f;">
        <div style="max-width:640px; margin:0 auto; padding:36px 20px;">
          <div style="background:#ffffff; border:1px solid #e7ddff; border-radius:28px; overflow:hidden; box-shadow:0 18px 48px rgba(99,92,205,0.12);">
            <div style="padding:34px 34px 20px 34px;">
              <div style="font-size:13px; line-height:1; letter-spacing:0.18em; text-transform:uppercase; font-weight:800; color:#635ccd;">JOBZ CAFE&reg; | SLOTZ</div>
              <h1 style="margin:26px 0 10px 0; font-size:32px; line-height:1.16; font-weight:700; color:#2f255f;">Your session is booked</h1>
              <p style="margin:0; font-size:17px; line-height:1.65; color:#514873;">Hi ${booking.guest_name}, your ${meetingType.name} with ${staffProfile.full_name} is confirmed.</p>
            </div>

            <div style="margin:10px 34px 28px 34px; padding:24px; border-radius:22px; background:#f4f0ff; border:1px solid #e8ddff;">
              <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; font-weight:800; color:#635ccd; margin-bottom:16px;">Session details</div>
              <p style="margin:0 0 12px 0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Date:</strong> ${formatDate(startTime, guestTimezone)}</p>
              <p style="margin:0 0 12px 0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Time:</strong> ${formatTime(startTime, guestTimezone)}</p>
              <p style="margin:0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Duration:</strong> ${meetingType.duration_minutes} minutes</p>
            </div>

            <div style="padding:0 34px 34px 34px;">
              ${sessionJoinUrl ? `<a href="${sessionJoinUrl}" style="display:block; text-align:center; background:#635ccd; color:#ffffff; text-decoration:none; padding:16px 20px; border-radius:16px; font-weight:800; font-size:16px; margin-bottom:12px;">Join Personal Room</a>` : ''}
              <a href="${manageUrl}" style="display:block; text-align:center; background:#ffffff; color:#635ccd; text-decoration:none; padding:15px 20px; border-radius:16px; font-weight:800; font-size:16px; border:1px solid #d8ccff;">Manage Session</a>
              <div style="margin:22px 0 0 0; padding:20px; border-radius:20px; background:#fbf9ff; border:1px solid #eee8ff;">
                <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; font-weight:800; color:#635ccd; margin-bottom:12px;">Calendar reminder</div>
                <p style="margin:0 0 14px 0; font-size:14px; line-height:1.6; color:#514873;">Add this session to your calendar as a reminder. To make changes, use the SLOTZ manage link so the booking record stays correct.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="width:50%; padding-right:6px;">
                      <a href="${googleCalendarUrl}" style="display:block; text-align:center; background:#f4f0ff; color:#2f255f; text-decoration:none; padding:13px 14px; border-radius:14px; font-weight:800; font-size:14px; border:1px solid #d8ccff;">Google Calendar</a>
                    </td>
                    <td style="width:50%; padding-left:6px;">
                      <a href="${outlookCalendarUrl}" style="display:block; text-align:center; background:#f4f0ff; color:#2f255f; text-decoration:none; padding:13px 14px; border-radius:14px; font-weight:800; font-size:14px; border:1px solid #d8ccff;">Outlook Calendar</a>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="margin:22px 0 0 0; font-size:13px; line-height:1.6; color:#746b92;">Use the manage link for changes so SLOTZ can notify staff and keep the booking record correct.</p>
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
            <div style="padding:34px 34px 20px 34px;">
              <div style="font-size:13px; line-height:1; letter-spacing:0.18em; text-transform:uppercase; font-weight:800; color:#635ccd;">JOBZ CAFE&reg; | SLOTZ</div>
              <h1 style="margin:26px 0 10px 0; font-size:32px; line-height:1.16; font-weight:700; color:#2f255f;">New session booked</h1>
              <p style="margin:0; font-size:17px; line-height:1.65; color:#514873;">${booking.guest_name} booked a ${meetingType.name} session.</p>
            </div>

            <div style="margin:10px 34px 18px 34px; padding:24px; border-radius:22px; background:#f4f0ff; border:1px solid #e8ddff;">
              <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; font-weight:800; color:#635ccd; margin-bottom:16px;">Session details</div>
              <p style="margin:0 0 12px 0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Date:</strong> ${formatDate(startTime, staffProfile.timezone)}</p>
              <p style="margin:0; font-size:18px; line-height:1.45; color:#2f255f;"><strong>Time:</strong> ${formatTime(startTime, staffProfile.timezone)}</p>
            </div>

            <div style="margin:0 34px 28px 34px; padding:18px 24px; border-radius:18px; background:#ffffff; border:1px solid #eee8ff;">
              <p style="margin:0; font-size:14px; line-height:1.6; color:#746b92;"><strong>Guest:</strong> ${booking.guest_name} | ${booking.guest_email}</p>
              ${booking.agenda_notes ? `<p style="margin:8px 0 0 0; font-size:14px; line-height:1.6; color:#746b92;"><strong>Notes:</strong> ${booking.agenda_notes}</p>` : ''}
            </div>
          </div>
          <p style="text-align:center; margin:20px 0 0 0; color:#746b92; font-size:13px;">Powered by JOBZ CAFE&reg;</p>
        </div>
      </body>
      </html>
    `

    const guestEmailResponse = await sendEmail(booking.guest_email, `Booking confirmed: Your JOBZ CAFE\u00AE ${meetingType.name}`, guestHtml)
    if (!guestEmailResponse.ok) {
      const error = await guestEmailResponse.json()
      throw new Error(`Guest confirmation email failed: ${JSON.stringify(error)}`)
    }
    const guestEmail = await guestEmailResponse.json()

    const staffEmailResponse = await sendEmail(staffProfile.email, `New SLOTZ session: ${booking.guest_name} - ${meetingType.name}`, staffHtml)
    if (!staffEmailResponse.ok) {
      const error = await staffEmailResponse.json()
      throw new Error(`Staff notification email failed: ${JSON.stringify(error)}`)
    }
    const staffEmail = await staffEmailResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        guest_email_sent: true,
        staff_email_sent: true,
        loft_video_session_id: loftResult.videoSessionId || null,
        loft_join_url: loftResult.joinUrl || null,
        loft_bridge_success: loftResult.success === true,
        loft_bridge_error: loftResult.error || null,
        guest_email_id: guestEmail.id,
        staff_email_id: staffEmail.id,
        patron_person_id: patronPerson.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: unknown) {
    console.error('Email error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

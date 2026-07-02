import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REMINDER_TYPES = ['reminder_24h', 'reminder_1h']
const SEND_DELAY_MS = 350

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      requiredAnyEnv(['SUPABASE_URL', 'SLOTZ_SUPABASE_URL']),
      requiredAnyEnv(['SUPABASE_SERVICE_ROLE_KEY', 'SLOTZ_SUPABASE_ADMIN_KEY'])
    )

    const { data: jobs, error } = await supabase
      .from('scheduling_reminder_jobs')
      .select(`
        *,
        scheduling_bookings(
          *,
          scheduling_meeting_types(name, duration_minutes),
          scheduling_staff_profiles(full_name, email, timezone)
        )
      `)
      .eq('recipient_type', 'staff')
      .eq('status', 'pending')
      .in('job_type', REMINDER_TYPES)
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50)

    if (error) throw error
    if (!jobs?.length) return json({ success: true, processed: 0, sent: 0, failed: 0 })

    let sent = 0
    let failed = 0

    for (const job of jobs) {
      const claimed = await claimJob(supabase, job)
      if (!claimed) continue

      try {
        const messageId = await sendStaffReminder(job)
        await markJobSent(supabase, job, messageId)
        sent += 1
        await sleep(SEND_DELAY_MS)
      } catch (error) {
        await markJobFailed(supabase, job.id, error)
        failed += 1
      }
    }

    return json({ success: true, processed: jobs.length, sent, failed })
  } catch (error) {
    console.error('Staff reminder queue error:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})

async function claimJob(supabase: any, job: any) {
  const { data, error } = await supabase
    .from('scheduling_reminder_jobs')
    .update({
      status: 'processing',
      attempts: Number(job.attempts || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle()

  if (error) throw error
  return Boolean(data?.id)
}

async function sendStaffReminder(job: any) {
  const booking = job.scheduling_bookings
  if (!booking) throw new Error('Missing booking for reminder job')
  if (booking.status !== 'confirmed') throw new Error(`Booking is not confirmed: ${booking.status}`)

  const meetingType = booking.scheduling_meeting_types
  const staffProfile = booking.scheduling_staff_profiles
  if (!meetingType?.name) throw new Error('Missing meeting type')
  if (!staffProfile?.email || !staffProfile?.full_name || !staffProfile?.timezone) {
    throw new Error('Missing staff profile email, name, or timezone')
  }

  const startTime = new Date(booking.start_time)
  const formattedDate = formatDate(startTime, staffProfile.timezone)
  const formattedTime = formatTime(startTime, staffProfile.timezone)
  const reminderLabel = job.job_type === 'reminder_24h' ? 'tomorrow' : 'soon'

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f7f4ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#2f255f;">
      <div style="max-width:640px;margin:0 auto;padding:36px 20px;">
        <div style="background:#ffffff;border:1px solid #e7ddff;border-radius:28px;overflow:hidden;box-shadow:0 18px 48px rgba(99,92,205,0.12);">
          <div style="padding:34px;">
            <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;color:#635ccd;">JOBZ CAFE&reg; | SLOTZ</div>
            <h1 style="margin:26px 0 10px 0;font-size:30px;line-height:1.18;font-weight:700;color:#2f255f;">Session reminder</h1>
            <p style="margin:0;font-size:17px;line-height:1.65;color:#514873;">Hi ${escapeHtml(staffProfile.full_name)}, your ${escapeHtml(meetingType.name)} with ${escapeHtml(booking.guest_name)} is ${reminderLabel}.</p>
          </div>
          <div style="margin:0 34px 28px 34px;padding:24px;border-radius:22px;background:#f4f0ff;border:1px solid #e8ddff;">
            <p style="margin:0 0 12px 0;font-size:18px;line-height:1.45;color:#2f255f;"><strong>Date:</strong> ${formattedDate}</p>
            <p style="margin:0 0 12px 0;font-size:18px;line-height:1.45;color:#2f255f;"><strong>Time:</strong> ${formattedTime}</p>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#514873;"><strong>Guest:</strong> ${escapeHtml(booking.guest_name)} | ${escapeHtml(booking.guest_email)}</p>
            ${booking.guest_phone ? `<p style="margin:8px 0 0 0;font-size:15px;line-height:1.6;color:#514873;"><strong>Phone:</strong> ${escapeHtml(booking.guest_phone)}</p>` : ''}
            ${booking.agenda_notes ? `<p style="margin:8px 0 0 0;font-size:15px;line-height:1.6;color:#514873;"><strong>Notes:</strong> ${escapeHtml(booking.agenda_notes)}</p>` : ''}
          </div>
        </div>
        <p style="text-align:center;margin:20px 0 0 0;color:#746b92;font-size:13px;">Powered by JOBZ CAFE&reg;</p>
      </div>
    </body>
    </html>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requiredEnv('SLOTZ_RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'JOBZ CAFE <noreply@auth.jobzcafe.com>',
      to: staffProfile.email,
      subject: `Reminder: ${meetingType.name} with ${booking.guest_name}`,
      html,
    }),
  })

  const body = await response.json()
  if (!response.ok) throw new Error(`Resend API error: ${JSON.stringify(body)}`)
  return body.id || null
}

async function markJobSent(supabase: any, job: any, messageId: string | null) {
  const now = new Date().toISOString()
  const { error: jobError } = await supabase
    .from('scheduling_reminder_jobs')
    .update({ status: 'sent', provider_message_id: messageId, sent_at: now, updated_at: now })
    .eq('id', job.id)

  if (jobError) throw jobError

  await supabase.from('scheduling_email_events').insert({
    reminder_job_id: job.id,
    booking_id: job.booking_id,
    resend_message_id: messageId,
    event_type: 'reminder_sent',
    payload: { job_type: job.job_type, recipient_type: job.recipient_type },
  })
}

async function markJobFailed(supabase: any, jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const retryable = message.includes('rate_limit') || message.includes('429')
  console.error(`Staff reminder job ${jobId} failed:`, message)
  await supabase
    .from('scheduling_reminder_jobs')
    .update({
      status: retryable ? 'pending' : 'failed',
      last_error: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatDate(date: Date, timeZone: string) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone })
}

function formatTime(date: Date, timeZone: string) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function requiredAnyEnv(names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name)
    if (value) return value
  }
  throw new Error(`Missing one of ${names.join(', ')}`)
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char))
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

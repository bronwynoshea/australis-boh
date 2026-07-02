import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "https://esm.sh/resend@2.0.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CancellationRequest {
  bookingId: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Pattern B: Manual JWT authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const authClient = createClient(
      Deno.env.get('SLOTZ_SUPABASE_URL')!,
      Deno.env.get('SLOTZ_SUPABASE_PUBLISHABLE_KEY')!
    )

    const { data: { user }, error: authError } = await authClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { bookingId }: CancellationRequest = await req.json()

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'Missing bookingId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SLOTZ_SUPABASE_URL')!
    const supabaseSecretKey = Deno.env.get('SLOTZ_SUPABASE_ADMIN_KEY')!
    const supabase = createClient(supabaseUrl, supabaseSecretKey)

    // Fetch booking with meeting type and staff profile
    const { data: booking, error: bookingError } = await supabase
      .from('scheduling_bookings')
      .select(`
        *,
        scheduling_meeting_types!inner(
          id,
          name,
          duration_minutes
        ),
        scheduling_staff_profiles!inner(
          id,
          email,
          timezone
        )
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const meetingType = booking.scheduling_meeting_types
    const staffProfile = booking.scheduling_staff_profiles

    // Format date and time
    const startTime = new Date(booking.start_time)
    const formatDate = (date: Date, timezone: string) => {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: timezone
      })
    }

    const formatTime = (date: Date, timezone: string) => {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timezone
      })
    }

    const bookUrl = `${req.headers.get('origin')}/`
    const staffTimezone = staffProfile.timezone

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
          body { font-family: 'Inter', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9f9fb;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9f9fb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eee;">
                <tr>
                  <td style="padding: 48px;">
                    <div style="margin-bottom: 32px;">
                      <h1 style="color: #635CCD; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.06em;">JOBZ CAFE®</h1>
                    </div>
                    <div style="color: #1a1a1a; line-height: 1.6; font-size: 16px;">
                      <h2 style="font-size: 24px; font-weight: 900; margin-bottom: 20px; color: #111; letter-spacing: -0.02em;">Appointment Canceled</h2>
                      <p style="margin-bottom: 24px;">Hi ${booking.guest_name}, this email is to confirm that your <strong>${meetingType.name}</strong> session scheduled for ${formatDate(startTime, staffTimezone)} at ${formatTime(startTime, staffTimezone)} has been canceled.</p>
                      <p style="margin-bottom: 24px;">There is no further action required from you. If you believe this was in error, please contact us by replying to this email.</p>
                      <div style="margin-top: 32px; text-align: center;">
                        <a href="${bookUrl}" style="background-color: #635CCD; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; display: inline-block;">Book a New Session</a>
                      </div>
                      <p style="margin-top: 32px; font-size: 14px; color: #666;">We apologize for any inconvenience this may cause.</p>
                    </div>
                    <div style="margin-top: 48px; padding-top: 32px; border-top: 1px solid #f0f0f0; color: #999; font-size: 12px; text-align: center; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">
                      &copy; ${new Date().getFullYear()} JOBZ CAFE®. Seamless Intelligence.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `

    const resend = new Resend(Deno.env.get('SLOTZ_RESEND_API_KEY')!)

    const { data, error } = await resend.emails.send({
      from: 'JOBZ CAFE® <noreply@auth.jobzcafe.com>',
      to: [booking.guest_email],
      subject: `Canceled: Your JOBZ CAFE® ${meetingType.name}`,
      html,
    })

    if (error) {
      console.error('Resend API Error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Cancellation notice email sent:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error sending cancellation notice:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

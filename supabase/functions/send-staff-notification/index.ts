import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from "https://esm.sh/resend@2.0.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Global Deno environment types
declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StaffNotificationRequest {
  bookingId: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bookingId }: StaffNotificationRequest = await req.json()

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SB_SECRET_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
                      <h2 style="font-size: 24px; font-weight: 900; margin-bottom: 20px; color: #111;">New Entry Logged</h2>
                      <p>A new ${meetingType.name} has been added to the JOBZ CAFE® CHATZ Calendar.</p>
                      <div style="background: #f4f4f7; padding: 32px; border-radius: 24px; margin: 32px 0;">
                        <p style="margin: 0 0 16px 0;"><strong>Guest:</strong> ${booking.guest_name}</p>
                        <p style="margin: 0 0 16px 0;"><strong>Email:</strong> ${booking.guest_email}</p>
                        <p style="margin: 0 0 16px 0;"><strong>Time:</strong> ${formatDate(startTime, staffTimezone)} @ ${formatTime(startTime, staffTimezone)}</p>
                        ${booking.agenda_notes ? `<p style="margin: 0; font-size: 14px; color: #666; border-left: 4px solid #635CCD; padding-left: 16px;"><em>Agenda & Notes: ${booking.agenda_notes}</em></p>` : ''}
                      </div>
                      
                      <div style="background: #e8f4fd; padding: 24px; border-radius: 16px; margin: 24px 0; border-left: 4px solid #0078d4;">
                        <h3 style="margin: 0 0 12px 0; color: #0078d4; font-size: 16px; font-weight: 700;">🔗 Meeting Room Access</h3>
                        <p style="margin: 0; color: #333; font-size: 14px;">Access your personal meeting room via LOFT to host this session.</p>
                        <p style="margin: 8px 0 0 0; color: #666; font-size: 12px; font-style: italic;">Room will be available 2 minutes before session start</p>
                      </div>
                    </div>
                    <div style="margin-top: 48px; padding-top: 32px; border-top: 1px solid #f0f0f0; color: #999; font-size: 12px; text-align: center; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">
                      &copy; ${new Date().getFullYear()} JOBZ CAFE®. 
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

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
    
    const { data, error } = await resend.emails.send({
      from: 'JOBZ CAFE® <noreply@auth.jobzcafe.com>',
      to: [staffProfile.email],
      subject: `New Session: ${booking.guest_name}`,
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

    console.log('Staff notification email sent:', data)

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error sending staff notification:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

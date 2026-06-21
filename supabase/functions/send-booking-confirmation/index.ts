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

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SB_SECRET_KEY') ?? ''
    )

    // Fetch booking with related data
    const { data: booking, error } = await supabaseClient
      .from('scheduling_bookings')
      .select(`
        *,
        scheduling_meeting_types(*),
        scheduling_staff_profiles(*)
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      throw new Error('Booking not found')
    }

    const meetingType = booking.scheduling_meeting_types
    const staffProfile = booking.scheduling_staff_profiles

    // Format date/time
    const startTime = new Date(booking.start_time)
    const formattedDate = startTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: booking.timezone || 'UTC'
    })
    const formattedTime = startTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: booking.timezone || 'UTC'
    })

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'JOBZ CAFE® <noreply@auth.jobzcafe.com>',
        to: booking.guest_email,
        subject: `Booking Confirmed: ${meetingType.name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #211f42; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
              .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
              .details { background: #f7f7f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Booking Confirmed!</h1>
              </div>
              <div class="content">
                <p>Hi ${booking.guest_name},</p>
                <p>Your booking has been confirmed! We're looking forward to meeting with you.</p>
                
                <div class="details">
                  <h2 style="margin-top: 0;">📅 Meeting Details</h2>
                  <p><strong>Type:</strong> ${meetingType.name}</p>
                  <p><strong>Date:</strong> ${formattedDate}</p>
                  <p><strong>Time:</strong> ${formattedTime}</p>
                  <p><strong>Duration:</strong> ${meetingType.duration_minutes} minutes</p>
                  ${booking.agenda_notes ? `<p><strong>Notes:</strong> ${booking.agenda_notes}</p>` : ''}
                </div>

                ${staffProfile.meeting_link ? `
                <div class="details" style="background: #e8f4fd; border-left: 4px solid #0078d4;">
                  <h2 style="margin-top: 0;">🔗 Meeting Link</h2>
                  <p><strong>Join the staff member's personal meeting room:</strong></p>
                  <center>
                    <a href="${staffProfile.meeting_link}" class="button" style="background: #0078d4;">
                      Join Personal Room
                    </a>
                  </center>
                  <p style="margin-top: 15px; color: #666; font-size: 14px; text-align: center;">
                    Link will be activated 2 minutes before session start
                  </p>
                </div>
                ` : ''}

                <center>
                  <a href="${Deno.env.get('APP_URL')}/manage/${booking.id}" class="button">
                    Manage Booking
                  </a>
                </center>

                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  Need to make changes? Please cancel and rebook for now.
                </p>
              </div>
              <div class="footer">
                <p>Powered by JOBZCAFE™</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    })

    if (!resendResponse.ok) {
      const error = await resendResponse.json()
      throw new Error(`Resend API error: ${JSON.stringify(error)}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: unknown) {
    console.error('Email error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

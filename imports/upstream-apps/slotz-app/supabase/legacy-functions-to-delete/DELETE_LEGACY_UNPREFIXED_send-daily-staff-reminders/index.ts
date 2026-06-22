import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SECRET_KEY')!
    )

    // Get today's bookings in UTC
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // Fetch all confirmed bookings for today with guest and staff details
    const { data: bookings, error } = await supabase
      .from('scheduling_bookings')
      .select(`
        *,
        scheduling_meeting_types(name, duration_minutes),
        scheduling_staff_profiles(full_name, email, timezone)
      `)
      .eq('status', 'confirmed')
      .gte('start_time', startOfDay.toISOString())
      .lt('start_time', endOfDay.toISOString())

    if (error) {
      console.error('Error fetching bookings:', error)
      throw error
    }

    if (!bookings || bookings.length === 0) {
      console.log('No bookings found for today')
      return new Response(
        JSON.stringify({ success: true, message: 'No bookings to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group bookings by staff email
    const staffBookings = bookings.reduce((acc: Record<string, { staff_name: string; timezone: string; bookings: any[] }>, booking: any) => {
      const staffEmail = booking.scheduling_staff_profiles.email
      if (!acc[staffEmail]) {
        acc[staffEmail] = {
          staff_name: booking.scheduling_staff_profiles.full_name,
          timezone: booking.scheduling_staff_profiles.timezone,
          bookings: []
        }
      }
      acc[staffEmail].bookings.push(booking)
      return acc
    }, {})

    console.log(`📊 Found ${Object.keys(staffBookings).length} staff members with bookings today`)
    console.log(`👥 Staff emails: ${Object.keys(staffBookings).join(', ')}`)
    console.log(`📋 All bookings guest emails: ${bookings.map((b: any) => b.guest_email).join(', ')}`)

    // Send reminder emails to each staff member
    const emailPromises = Object.entries(staffBookings).map(async ([email, staffData]) => {
      const data = staffData as { staff_name: string; timezone: string; bookings: any[] }
      console.log(`📧 Preparing STAFF email for ${email} (${data.staff_name}) with ${data.bookings.length} booking(s)`)
      
      const startTime = new Date(data.bookings[0].start_time)
      const formattedDate = startTime.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: data.timezone
      })

      // Generate booking list HTML
      const bookingsHTML = data.bookings.map((booking: any) => {
        const bookingTime = new Date(booking.start_time)
        const formattedTime = bookingTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: data.timezone
        })
        
        return `
          <div style="background: #f4f4f7; padding: 20px; border-radius: 12px; margin: 16px 0; border-left: 4px solid #635CCD;">
            <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #211f42;">
              📅 ${formattedTime} - ${booking.scheduling_meeting_types.name}
            </p>
            <p style="margin: 0; font-size: 14px; color: #666;">
              Guest: ${booking.guest_name}
            </p>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #666;">
              Email: ${booking.guest_email}
            </p>
            ${booking.guest_phone ? `
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #666;">
                Phone: ${booking.guest_phone}
              </p>
            ` : ''}
            ${booking.agenda_notes ? `
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #666; font-style: italic; border-left: 3px solid #635CCD; padding-left: 12px;">
                Notes: ${booking.agenda_notes}
              </p>
            ` : ''}
          </div>
        `
      }).join('')

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #211f42; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #635CCD 0%, #8B5CF6 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .emphasis { background: #e8f4fd; padding: 16px; border-radius: 8px; border-left: 4px solid #0078d4; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Daily Schedule</h1>
              <p>Your appointments for ${formattedDate}</p>
            </div>
            <div class="content">
              <p>Hi ${data.staff_name},</p>
              
              <div class="emphasis">
                <p style="margin: 0; font-weight: 600; color: #0078d4;">
                  🎯 This should be your booked JOBZ appointments for the day to make sure that you recognize that these are the appointments that have come from the app.
                </p>
              </div>
              
              <p>You have the following appointment(s) today:</p>
              
              ${bookingsHTML}
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                Remember to access your meeting rooms via LOFT.
              </p>
            </div>
            <div class="footer">
              <p>Powered by JOBZ CAFE®</p>
            </div>
          </div>
        </body>
        </html>
      `

      // Send email via Resend
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'JOBZ CAFE® <noreply@auth.jobzcafe.com>',
          to: email,
          subject: `Daily Schedule: Your appointments for ${formattedDate}`,
          html,
        }),
      })

      if (!resendResponse.ok) {
        const error = await resendResponse.json()
        console.error(`❌ Failed to send STAFF email to ${email}:`, error)
        throw new Error(`Resend API error: ${JSON.stringify(error)}`)
      }

      console.log(`✅ Successfully sent STAFF email to ${email}`)
      return { email, success: true }
    })

    // Wait for all emails to be sent
    const results = await Promise.allSettled(emailPromises)
    
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log(`📊 STAFF email sending summary:`)
    console.log(`✅ Sent ${successful} staff reminders, ${failed} failed`)
    console.log(`📧 Total staff processed: ${Object.keys(staffBookings).length}`)
    console.log(`📋 Total bookings found: ${bookings.length}`)

    // Log detailed results for debugging
    results.forEach((result, index) => {
      const email = Object.keys(staffBookings)[index]
      if (result.status === 'fulfilled') {
        console.log(`✅ STAFF ${email}: SUCCESS`)
      } else {
        console.log(`❌ STAFF ${email}: FAILED - ${result.reason}`)
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_staff: Object.keys(staffBookings).length,
        successful,
        failed
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: unknown) {
    console.error('Daily staff reminders error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

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
      Deno.env.get('SB_SECRET_KEY')!
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
        scheduling_staff_profiles(full_name, meeting_link)
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

    // Group bookings by guest email and deduplicate
    const guestBookings = bookings.reduce((acc: Record<string, { guest_name: string; bookings: any[] }>, booking: any) => {
      const email = booking.guest_email
      if (!acc[email]) {
        acc[email] = {
          guest_name: booking.guest_name,
          bookings: []
        }
      }
      acc[email].bookings.push(booking)
      return acc
    }, {})

    console.log(`📊 Found ${Object.keys(guestBookings).length} unique guests with bookings today`)
    console.log(`👥 Guest emails: ${Object.keys(guestBookings).join(', ')}`)

    // Send reminder emails to each guest
    const emailPromises = Object.entries(guestBookings).map(async ([email, guestData]) => {
      const data = guestData as { guest_name: string; bookings: any[] }
      console.log(`📧 Preparing email for ${email} (${data.guest_name}) with ${data.bookings.length} booking(s)`)
      
      const startTime = new Date(data.bookings[0].start_time)
      const timezone = data.bookings[0].guest_timezone || 
                     data.bookings[0].scheduling_staff_profiles.timezone || 
                     'America/New_York'
      const formattedDate = startTime.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: timezone
      })

      // Generate booking list HTML
      const bookingsHTML = data.bookings.map((booking: any) => {
        const bookingTime = new Date(booking.start_time)
        const formattedTime = bookingTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: timezone
        })
        
        return `
          <div style="background: #f4f4f7; padding: 20px; border-radius: 12px; margin: 16px 0; border-left: 4px solid #635CCD;">
            <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #211f42;">
              📅 ${formattedTime} - ${booking.scheduling_meeting_types.name}
            </p>
            <p style="margin: 0; font-size: 14px; color: #666;">
              with ${booking.scheduling_staff_profiles.full_name}
            </p>
            ${booking.scheduling_staff_profiles.meeting_link ? `
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #0078d4;">
                🔗 Meeting link will activate 2 minutes before start time
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
            .emphasis { background: #fff3cd; padding: 16px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📅 Daily Reminder</h1>
              <p>Your appointments for ${formattedDate}</p>
            </div>
            <div class="content">
              <p>Hi ${data.guest_name},</p>
              
              <div class="emphasis">
                <p style="margin: 0; font-weight: 600; color: #856404;">
                  ⚠️ This is a reminder for your call with us today - this is the one and only reminder you'll receive.
                </p>
              </div>
              
              <p>You have the following appointment(s) today:</p>
              
              ${bookingsHTML}
              
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                Meeting links will be activated 2 minutes before your scheduled start time. Please join promptly to ensure your session starts on time.
              </p>
              
              <p style="margin-top: 20px; font-weight: 600;">We look forward to chatting with you!</p>
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
          subject: `Daily Reminder: Your appointment(s) today`,
          html,
        }),
      })

      if (!resendResponse.ok) {
        const error = await resendResponse.json()
        console.error(`❌ Failed to send email to ${email}:`, error)
        throw new Error(`Resend API error: ${JSON.stringify(error)}`)
      }

      console.log(`✅ Successfully sent email to ${email}`)
      return { email, success: true }
    })

    // Wait for all emails to be sent
    const results = await Promise.allSettled(emailPromises)
    
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log(`📊 Email sending summary:`)
    console.log(`✅ Sent ${successful} guest reminders, ${failed} failed`)
    console.log(`📧 Total guests processed: ${Object.keys(guestBookings).length}`)
    console.log(`📋 Total bookings found: ${bookings.length}`)

    // Log detailed results for debugging
    results.forEach((result, index) => {
      const email = Object.keys(guestBookings)[index]
      if (result.status === 'fulfilled') {
        console.log(`✅ ${email}: SUCCESS`)
      } else {
        console.log(`❌ ${email}: FAILED - ${result.reason}`)
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        total_guests: Object.keys(guestBookings).length,
        successful,
        failed
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: unknown) {
    console.error('Daily guest reminders error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

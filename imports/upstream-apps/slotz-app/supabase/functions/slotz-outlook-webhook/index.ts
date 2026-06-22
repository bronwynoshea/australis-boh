import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, clientstate',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify webhook subscription (validation token)
    const url = new URL(req.url)
    const validationToken = url.searchParams.get('validationToken')
    
    if (validationToken) {
      console.log('Validating webhook subscription')
      return new Response(validationToken, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

    // Handle notification
    const notification = await req.json()
    
    console.log('Received Outlook webhook notification:', JSON.stringify(notification, null, 2))

    const supabaseClient = createClient(
      requiredEnv('SLOTZ_SUPABASE_URL'),
      requiredEnv('SLOTZ_SUPABASE_ADMIN_KEY')
    )

    // Process each notification
    for (const item of notification.value || []) {
      const changeType = item.changeType
      const resourceData = item.resourceData
      
      console.log(`Processing ${changeType} notification:`, resourceData)

      // Find affected bookings by outlook_event_id
      if (resourceData?.id) {
        const { data: bookings, error } = await supabaseClient
          .from('scheduling_bookings')
          .select('*')
          .eq('outlook_event_id', resourceData.id)

        if (error) {
          console.error('Error finding booking:', error)
          continue
        }

        if (bookings && bookings.length > 0) {
          for (const booking of bookings) {
            if (changeType === 'deleted') {
              // Event was deleted in Outlook
              console.log(`Marking booking ${booking.id} as cancelled (deleted in Outlook)`)
              
              await supabaseClient
                .from('scheduling_bookings')
                .update({ 
                  status: 'cancelled',
                  outlook_event_id: null
                })
                .eq('id', booking.id)

              // Optionally send cancellation email
              // await sendCancellationEmail(booking)
              
            } else if (changeType === 'updated') {
              // Event was updated in Outlook
              console.log(`Booking ${booking.id} was updated in Outlook`)
              
              // Optionally fetch the updated event details and sync back
              // This requires the access token for the staff member
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202 // Accepted
      }
    )

  } catch (error: unknown) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

function requiredEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

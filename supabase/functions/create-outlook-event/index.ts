import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const bookingData = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SB_SECRET_KEY')!
    )

    console.log('📥 Received booking data:', bookingData.booking_id)

    // Get booking with related data
    const { data: booking, error: bookingError } = await supabase
      .from('scheduling_bookings')
      .select('*, scheduling_meeting_types(name), scheduling_staff_profiles(timezone)')
      .eq('id', bookingData.booking_id)
      .single()

    if (bookingError || !booking) {
      console.error('❌ Booking not found:', bookingError)
      throw new Error('Booking not found')
    }

    console.log('✅ Booking found:', booking.guest_name)

    // Check if sync is enabled
    const { data: syncConfig } = await supabase
      .from('outlook_calendar_sync')
      .select('is_enabled')
      .eq('staff_id', booking.staff_id)
      .single()

    if (!syncConfig?.is_enabled) {
      console.log(`⚠️ Outlook sync not enabled for staff ${booking.staff_id}`)
      return new Response(
        JSON.stringify({ success: true, outlook_synced: false, reason: 'sync_disabled' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Get OAuth tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('outlook_oauth_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('staff_id', booking.staff_id)
      .eq('is_active', true)
      .single()

    if (tokenError || !tokenData) {
      console.error('❌ No OAuth tokens:', tokenError)
      return new Response(
        JSON.stringify({ success: true, outlook_synced: false, reason: 'no_tokens' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Check if token expired or expiring soon (5 min buffer)
    let accessToken = tokenData.access_token
    const tokenExpiresAt = new Date(tokenData.expires_at)
    const now = new Date()
    const bufferMs = 5 * 60 * 1000

    if (tokenExpiresAt.getTime() - bufferMs < now.getTime()) {
      console.log('⏰ Token expired or expiring soon, refreshing...')
      
      const tokenResponse = await refreshAccessToken(tokenData.refresh_token)
      
      if (tokenResponse) {
        accessToken = tokenResponse.access_token
        
        await supabase
          .from('outlook_oauth_tokens')
          .update({
            access_token: tokenResponse.access_token,
            refresh_token: tokenResponse.refresh_token || tokenData.refresh_token,
            expires_at: new Date(now.getTime() + tokenResponse.expires_in * 1000).toISOString(),
            updated_at: now.toISOString()
          })
          .eq('staff_id', booking.staff_id)
          
        console.log('✅ Token refreshed successfully')
      } else {
        console.error('❌ Token refresh failed')
        return new Response(
          JSON.stringify({ success: false, error: 'Token refresh failed' }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    } else {
      console.log('✅ Token still valid')
    }

    // Create Outlook event
    console.log('📤 Creating Outlook event...')
    
    const eventId = await createOutlookEvent(
      accessToken,
      booking,
      booking.scheduling_meeting_types?.name || 'Meeting',
      booking.scheduling_staff_profiles?.timezone || 'UTC'
    )

    if (eventId) {
      await supabase
        .from('scheduling_bookings')
        .update({ external_event_id: eventId })
        .eq('id', bookingData.booking_id)
      
      console.log(`✅ Created Outlook event ${eventId}`)
      
      return new Response(
        JSON.stringify({ success: true, outlook_synced: true, event_id: eventId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      console.error('❌ Failed to create Outlook event')
      return new Response(
        JSON.stringify({ success: true, outlook_synced: false, reason: 'event_creation_failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error: unknown) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function createOutlookEvent(accessToken: string, booking: any, meetingTypeName: string, timezone: string) {
  const event = {
    subject: `${meetingTypeName} - ${booking.guest_name}`,
    body: {
      contentType: 'HTML',
      content: `
        <div style="font-family: Arial, sans-serif;">
          <h2>${meetingTypeName}</h2>
          <p><strong>Guest:</strong> ${booking.guest_name}</p>
          <p><strong>Email:</strong> ${booking.guest_email}</p>
          ${booking.guest_phone ? `<p><strong>Phone:</strong> ${booking.guest_phone}</p>` : ''}
          ${booking.agenda_notes ? `<p><strong>Notes:</strong></p><p>${booking.agenda_notes}</p>` : ''}
          <hr>
          <p style="color: #666; font-size: 12px;">Booking ID: ${booking.id}</p>
        </div>
      `
    },
    start: {
      dateTime: booking.start_time,
      timeZone: timezone
    },
    end: {
      dateTime: booking.end_time,
      timeZone: timezone
    },
    attendees: [
      {
        emailAddress: {
          address: booking.guest_email,
          name: booking.guest_name
        },
        type: "required"
      }
    ],
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness"
  }

  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/events", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Prefer': `outlook.timezone="${timezone}"` 
      },
      body: JSON.stringify(event)
    })

    if (response.ok) {
      const data = await response.json()
      return data.id
    }
    
    const errorText = await response.text()
    console.error('❌ Microsoft Graph API error:', response.status, errorText)
  } catch (error) {
    console.error('❌ Error calling Microsoft Graph:', error)
  }
  
  return null
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse | null> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SB_SECRET_KEY')!
    )

    // Get client secret from vault
    const { data: secrets, error } = await supabase
      .from('vault.decrypted_secrets')
      .select('decrypted_secret')
      .eq('name', 'AZURE_CLIENT_SECRET')
      .single()

    if (error || !secrets) {
      console.error('❌ Could not get client secret:', error)
      return null
    }

    const clientSecret = secrets.decrypted_secret
    const clientId = '86361e240f0f3c76dfb879c4dd1c5513'
    const tenantId = '76393b16d7ce5e6e93bc78c8ea1b7b5c'
    
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })

    console.log('🔄 Refreshing token with client secret...')

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    if (response.ok) {
      const data = await response.json()
      console.log('✅ Token refreshed successfully')
      return data
    }
    
    const errorText = await response.text()
    console.error('❌ Token refresh failed:', response.status, errorText)
    return null
  } catch (error) {
    console.error('❌ Token refresh error:', error)
    return null
  }
}
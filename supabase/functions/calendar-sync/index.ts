// Global type declarations for Deno environment
declare global {
  function serve(handler: (req: Request) => Promise<Response>): void
  
  namespace Deno {
    export const env: {
      get(key: string): string | undefined
    }
  }
  
  function createClient(url: string, key: string): any
}

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SyncConfig {
  staff_id: string
  is_enabled: boolean
  sync_interval_minutes: number
}

interface StaffProfile {
  id: string
  full_name: string
}

interface OutlookEvent {
  id: string
  subject?: string
  start: {
    dateTime: string
  }
  end: {
    dateTime: string
  }
  body?: {
    content?: string
  }
  location?: {
    displayName?: string
  }
  isAllDay?: boolean
}

interface Request {
  method: string
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SB_SECRET_KEY') ?? ''
    )

    console.log('Starting calendar sync...')

    // Get enabled sync configs
    const { data: syncConfigs, error: syncError } = await supabaseClient
      .from('outlook_calendar_sync')
      .select('*, scheduling_staff_profiles(id, email, timezone, full_name)')
      .eq('is_enabled', true)

    if (syncError) {
      console.error('Sync config error:', syncError)
      throw syncError
    }

    console.log(`Found ${syncConfigs?.length || 0} enabled sync configs`)

    const results = []
    const now = new Date()

    for (const syncConfig of syncConfigs || []) {
      try {
        const profile = syncConfig.scheduling_staff_profiles
        
        if (!profile) {
          console.log(`No profile found for sync config ${syncConfig.id}`)
          continue
        }

        // Get OAuth tokens
        const { data: tokenData, error: tokenError } = await supabaseClient
          .from('outlook_oauth_tokens')
          .select('access_token, refresh_token, expires_at')
          .eq('staff_id', profile.id)
          .eq('is_active', true)
          .single()

        if (tokenError || !tokenData) {
          console.log(`No active tokens for staff ${profile.id}`)
          continue
        }

        // ✅ FIX: Check if access token is ACTUALLY expired
        let accessToken = tokenData.access_token
        const expiresAt = new Date(tokenData.expires_at)

        // Only refresh if access token is expired (not just "will expire soon")
        if (expiresAt < now) {
          console.log(`❌ Access token expired for ${profile.full_name}, attempting refresh...`)
          
          if (!tokenData.refresh_token) {
            console.error(`No refresh token available for ${profile.full_name}`)
            
            // Update sync status to show user needs to reconnect
            await supabaseClient
              .from('outlook_calendar_sync')
              .update({
                last_sync_at: now.toISOString(),
                last_sync_status: 'error',
                last_sync_error: 'Token expired - please reconnect Outlook',
                updated_at: now.toISOString()
              })
              .eq('staff_id', profile.id)
            
            continue
          }
          
          const refreshed = await refreshAccessToken(tokenData.refresh_token)
          
          if (refreshed) {
            accessToken = refreshed.access_token
            
            await supabaseClient
              .from('outlook_oauth_tokens')
              .update({
                access_token: refreshed.access_token,
                refresh_token: refreshed.refresh_token || tokenData.refresh_token,
                expires_at: new Date(now.getTime() + refreshed.expires_in * 1000).toISOString(),
                last_used_at: now.toISOString(),
                updated_at: now.toISOString()
              })
              .eq('staff_id', profile.id)
              
            console.log(`✅ Token refreshed for ${profile.full_name}`)
          } else {
            console.error(`❌ Token refresh failed for ${profile.full_name}`)
            
            // Mark token as inactive so UI shows "disconnected"
            await supabaseClient
              .from('outlook_oauth_tokens')
              .update({
                is_active: false,
                updated_at: now.toISOString()
              })
              .eq('staff_id', profile.id)
            
            // Update sync status
            await supabaseClient
              .from('outlook_calendar_sync')
              .update({
                last_sync_at: now.toISOString(),
                last_sync_status: 'error',
                last_sync_error: 'Authentication failed - please reconnect Outlook',
                updated_at: now.toISOString()
              })
              .eq('staff_id', profile.id)
            
            continue
          }
        } else {
          console.log(`✅ Access token still valid for ${profile.full_name} (expires ${expiresAt.toISOString()})`)
          // Use existing token - no refresh needed
        }

        // Fetch Outlook events (next 90 days)
        const startDate = now.toISOString()
        const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
        
        const outlookEvents = await fetchOutlookEvents(accessToken, startDate, endDate)
        console.log(`Fetched ${outlookEvents.length} Outlook events for ${profile.full_name}`)

        // ✅ DELETE OLD EVENTS FIRST
        const { error: deleteError } = await supabaseClient
          .from('outlook_synced_events')
          .delete()
          .eq('staff_id', profile.id)
          .gte('event_start_time', startDate)

        if (deleteError) {
          console.error('Error deleting old events:', deleteError)
        } else {
          console.log('Old events deleted')
        }

        // ✅ INSERT NEW EVENTS
        let insertedCount = 0
        for (const event of outlookEvents) {
          const { error: insertError } = await supabaseClient
            .from('outlook_synced_events')
            .insert({
              staff_id: profile.id,
              outlook_event_id: event.id,
              event_subject: event.subject || 'Busy',
              event_start_time: event.start.dateTime,
              event_end_time: event.end.dateTime,
              event_body: event.body?.content || null,
              event_location: event.location?.displayName || null,
              is_all_day: event.isAllDay || false,
              sync_direction: 'outlook_to_local',
              sync_status: 'synced'
            })

          if (insertError) {
            console.error(`Error inserting event ${event.id}:`, insertError)
          } else {
            insertedCount++
          }
        }

        console.log(`✅ Inserted ${insertedCount} events for ${profile.full_name}`)

        // Update sync status
        await supabaseClient
          .from('outlook_calendar_sync')
          .update({
            last_sync_at: now.toISOString(),
            last_sync_status: 'success',
            last_sync_error: null,
            updated_at: now.toISOString()
          })
          .eq('staff_id', profile.id)

        results.push({
          staff_id: profile.id,
          staff_name: profile.full_name,
          success: true,
          events_synced: insertedCount,
          outlook_events_found: outlookEvents.length
        })

      } catch (error) {
        console.error(`Error syncing staff ${syncConfig.staff_id}:`, error)
        
        await supabaseClient
          .from('outlook_calendar_sync')
          .update({
            last_sync_at: now.toISOString(),
            last_sync_status: 'error',
            last_sync_error: error instanceof Error ? error.message : String(error),
            updated_at: now.toISOString()
          })
          .eq('staff_id', syncConfig.staff_id)

        results.push({
          staff_id: syncConfig.staff_id,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        total_staff_processed: results.length,
        results,
        synced_at: now.toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Calendar sync error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

async function refreshAccessToken(refreshToken: string) {
  const tokenEndpoint = `https://login.microsoftonline.com/${Deno.env.get('AZURE_TENANT_ID') || 'common'}/oauth2/v2.0/token`
  
  const params = new URLSearchParams({
    client_id: Deno.env.get('AZURE_CLIENT_ID') || '',
    client_secret: Deno.env.get('AZURE_CLIENT_SECRET') || '',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: 'User.Read Calendars.ReadWrite offline_access'
  })

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })

    if (response.ok) {
      return await response.json()
    }
    
    const errorText = await response.text()
    console.error('Token refresh failed:', response.status, errorText)
  } catch (error) {
    console.error('Token refresh error:', error)
  }
  
  return null
}

async function fetchOutlookEvents(accessToken: string, startDate: string, endDate: string) {
  try {
    const url = new URL('https://graph.microsoft.com/v1.0/me/calendar/calendarView')
    url.searchParams.append('startDateTime', startDate)
    url.searchParams.append('endDateTime', endDate)
    url.searchParams.append('$select', 'id,subject,start,end,body,location,showAs,isCancelled,isAllDay')
    url.searchParams.append('$orderby', 'start/dateTime')
    url.searchParams.append('$top', '500')

    const response = await fetch(url.toString(), {
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'outlook.timezone="UTC"'
      }
    })

    if (response.ok) {
      const data = await response.json()
      return data.value || []
    }
    
    const errorText = await response.text()
    console.error('Failed to fetch Outlook events:', response.status, errorText)
    return []
  } catch (error) {
    console.error('Error fetching Outlook events:', error)
    return []
  }
}
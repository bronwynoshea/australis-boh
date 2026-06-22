import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  showAs?: string
  isCancelled?: boolean
  isAllDay?: boolean
}

interface GoogleEvent {
  id: string
  summary?: string
  description?: string
  location?: string
  status?: string
  transparency?: string
  start: {
    dateTime?: string
    date?: string
  }
  end: {
    dateTime?: string
    date?: string
  }
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
      requiredAnyEnv(['SUPABASE_URL', 'SLOTZ_SUPABASE_URL']),
      requiredAnyEnv(['SUPABASE_SERVICE_ROLE_KEY', 'SLOTZ_SUPABASE_ADMIN_KEY'])
    )

    console.log('Starting calendar sync...')

    const requestedStaffId = await getRequestedStaffId(req, supabaseClient)

    // Get enabled sync configs
    let syncQuery = supabaseClient
      .from('outlook_calendar_sync')
      .select('*, scheduling_staff_profiles(id, email, timezone, full_name)')
      .eq('is_enabled', true)

    if (requestedStaffId) {
      syncQuery = syncQuery.eq('staff_id', requestedStaffId)
    }

    const { data: syncConfigs, error: syncError } = await syncQuery

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

        // Fetch Outlook events from the recent past through the next 90 days.
        // This keeps today's and in-progress events visible after a manual sync.
        const syncWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const startDate = syncWindowStart.toISOString()
        const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
        
        const outlookEvents = await fetchOutlookEvents(accessToken, startDate, endDate)
        console.log(`Fetched ${outlookEvents.length} Outlook events for ${profile.full_name}`)

        // ✅ Get our booking IDs to filter out events we created
        const { data: ourBookings } = await supabaseClient
          .from('scheduling_bookings')
          .select('id, external_event_id')
          .eq('staff_id', profile.id)
          .gte('start_time', startDate)
          .lte('start_time', endDate)

        const ourOutlookEventIds = new Set(
          (ourBookings || [])
            .filter((b: any) => b.external_event_id && b.external_calendar_provider === 'outlook')
            .map((b: any) => b.external_event_id)
        )

        // Filter out events we created
        const externalOutlookEvents = outlookEvents.filter((event: OutlookEvent) => {
          if (ourOutlookEventIds.has(event.id)) return false
          if (event.isCancelled) return false
          if (event.showAs === 'free') return false
          return true
        })
        console.log(`Filtered to ${externalOutlookEvents.length} external events (excluding ${ourOutlookEventIds.size} we created)`)

        // ✅ DELETE OLD EVENTS FIRST
        let { error: deleteError } = await supabaseClient
          .from('outlook_synced_events')
          .delete()
          .eq('staff_id', profile.id)
          .eq('calendar_provider', 'outlook')
          .gte('event_start_time', startDate)

        if (isMissingProviderColumnError(deleteError)) {
          console.log('Provider columns not installed yet; using legacy Outlook cleanup.')
          const legacyDelete = await supabaseClient
            .from('outlook_synced_events')
            .delete()
            .eq('staff_id', profile.id)
            .gte('event_start_time', startDate)
          deleteError = legacyDelete.error
        }

        if (deleteError) {
          console.error('Error deleting old events:', deleteError)
        } else {
          console.log('Old events deleted')
        }

        // ✅ INSERT NEW EVENTS
        let insertedCount = 0
        for (const event of externalOutlookEvents) {
          const insertPayload = {
            staff_id: profile.id,
            outlook_event_id: event.id,
            external_event_id: event.id,
            calendar_provider: 'outlook',
            event_subject: event.subject || 'Busy',
            event_start_time: event.start.dateTime,
            event_end_time: event.end.dateTime,
            event_body: event.body?.content || null,
            event_location: event.location?.displayName || null,
            is_all_day: event.isAllDay || false,
            sync_direction: 'outlook_to_local',
            sync_status: 'synced'
          }

          let { error: insertError } = await supabaseClient
            .from('outlook_synced_events')
            .insert(insertPayload)

          if (isMissingProviderColumnError(insertError)) {
            const { external_event_id: _externalEventId, calendar_provider: _calendarProvider, ...legacyPayload } = insertPayload
            const legacyInsert = await supabaseClient
              .from('outlook_synced_events')
              .insert(legacyPayload)
            insertError = legacyInsert.error
          }

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

    const googleResults = await syncGoogleCalendars(supabaseClient, requestedStaffId, now)
    results.push(...googleResults)

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
  const tokenEndpoint = `https://login.microsoftonline.com/${requiredEnv('SLOTZ_AZURE_TENANT_ID')}/oauth2/v2.0/token`
  
  const params = new URLSearchParams({
    client_id: requiredEnv('SLOTZ_AZURE_CLIENT_ID'),
    client_secret: requiredEnv('SLOTZ_AZURE_CLIENT_SECRET'),
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

async function syncGoogleCalendars(supabaseClient: any, requestedStaffId: string | null, now: Date) {
  const results = []

  try {
    let syncQuery = supabaseClient
      .from('google_calendar_sync')
      .select('*, scheduling_staff_profiles(id, email, timezone, full_name)')
      .eq('is_enabled', true)

    if (requestedStaffId) {
      syncQuery = syncQuery.eq('staff_id', requestedStaffId)
    }

    const { data: syncConfigs, error: syncError } = await syncQuery

    if (syncError) {
      if (String(syncError.message || '').includes('google_calendar_sync')) {
        console.log('Google calendar sync table not installed yet; skipping Google provider.')
        return results
      }
      throw syncError
    }

    console.log(`Found ${syncConfigs?.length || 0} enabled Google sync configs`)

    for (const syncConfig of syncConfigs || []) {
      try {
        const profile = syncConfig.scheduling_staff_profiles
        if (!profile) continue

        const { data: tokenData, error: tokenError } = await supabaseClient
          .from('google_oauth_tokens')
          .select('access_token, refresh_token, expires_at')
          .eq('staff_id', profile.id)
          .eq('is_active', true)
          .single()

        if (tokenError || !tokenData) {
          console.log(`No active Google tokens for staff ${profile.id}`)
          continue
        }

        let accessToken = tokenData.access_token
        const expiresAt = new Date(tokenData.expires_at)

        if (expiresAt < now) {
          if (!tokenData.refresh_token) {
            await markGoogleSyncError(supabaseClient, profile.id, now, 'Token expired - please reconnect Google Calendar')
            continue
          }

          const refreshed = await refreshGoogleAccessToken(tokenData.refresh_token)
          if (!refreshed) {
            await supabaseClient
              .from('google_oauth_tokens')
              .update({ is_active: false, updated_at: now.toISOString() })
              .eq('staff_id', profile.id)
            await markGoogleSyncError(supabaseClient, profile.id, now, 'Authentication failed - please reconnect Google Calendar')
            continue
          }

          accessToken = refreshed.access_token
          await supabaseClient
            .from('google_oauth_tokens')
            .update({
              access_token: refreshed.access_token,
              expires_at: new Date(now.getTime() + Number(refreshed.expires_in || 3600) * 1000).toISOString(),
              last_used_at: now.toISOString(),
              updated_at: now.toISOString()
            })
            .eq('staff_id', profile.id)
        }

        const syncWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const startDate = syncWindowStart.toISOString()
        const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
        const calendarId = syncConfig.sync_calendar_id || 'primary'
        const googleEvents = await fetchGoogleEvents(accessToken, calendarId, startDate, endDate)

        const { data: ourBookings } = await supabaseClient
          .from('scheduling_bookings')
          .select('id, external_event_id')
          .eq('staff_id', profile.id)
          .gte('start_time', startDate)
          .lte('start_time', endDate)

        const ourGoogleEventIds = new Set(
          (ourBookings || [])
            .filter((b: any) => b.external_event_id && b.external_calendar_provider === 'google')
            .map((b: any) => b.external_event_id)
        )

        const externalGoogleEvents = googleEvents.filter((event: GoogleEvent) => {
          if (ourGoogleEventIds.has(event.id)) return false
          if (event.status === 'cancelled') return false
          if (event.transparency === 'transparent') return false
          return true
        })

        const { error: deleteError } = await supabaseClient
          .from('outlook_synced_events')
          .delete()
          .eq('staff_id', profile.id)
          .eq('calendar_provider', 'google')
          .gte('event_start_time', startDate)

        if (deleteError) console.error('Error deleting old Google events:', deleteError)

        let insertedCount = 0
        for (const event of externalGoogleEvents) {
          const eventStart = event.start.dateTime || event.start.date
          const eventEnd = event.end.dateTime || event.end.date
          if (!eventStart || !eventEnd) continue

          const { error: insertError } = await supabaseClient
            .from('outlook_synced_events')
            .insert({
              staff_id: profile.id,
              outlook_event_id: event.id,
              external_event_id: event.id,
              external_calendar_id: calendarId,
              calendar_provider: 'google',
              event_subject: event.summary || 'Busy',
              event_start_time: eventStart,
              event_end_time: eventEnd,
              event_body: event.description || null,
              event_location: event.location || null,
              is_all_day: Boolean(event.start.date && !event.start.dateTime),
              sync_direction: 'outlook_to_local',
              sync_status: 'synced'
            })

          if (insertError) {
            console.error(`Error inserting Google event ${event.id}:`, insertError)
          } else {
            insertedCount++
          }
        }

        await supabaseClient
          .from('google_calendar_sync')
          .update({
            last_sync_at: now.toISOString(),
            last_sync_status: 'success',
            last_sync_error: null,
            updated_at: now.toISOString()
          })
          .eq('staff_id', profile.id)

        results.push({
          provider: 'google',
          staff_id: profile.id,
          staff_name: profile.full_name,
          success: true,
          events_synced: insertedCount,
          google_events_found: googleEvents.length
        })
      } catch (error) {
        console.error(`Error syncing Google staff ${syncConfig.staff_id}:`, error)
        await markGoogleSyncError(
          supabaseClient,
          syncConfig.staff_id,
          now,
          error instanceof Error ? error.message : String(error)
        )
        results.push({
          provider: 'google',
          staff_id: syncConfig.staff_id,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  } catch (error) {
    console.error('Google calendar sync skipped:', error)
  }

  return results
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const params = new URLSearchParams({
    client_id: requiredEnv('SLOTZ_GOOGLE_CLIENT_ID'),
    client_secret: requiredEnv('SLOTZ_GOOGLE_CLIENT_SECRET'),
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  })

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  if (!response.ok) {
    console.error('Google token refresh failed:', response.status, await response.text())
    return null
  }

  return await response.json()
}

async function fetchGoogleEvents(accessToken: string, calendarId: string, startDate: string, endDate: string) {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
  url.searchParams.set('timeMin', startDate)
  url.searchParams.set('timeMax', endDate)
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '500')

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (!response.ok) {
    console.error('Failed to fetch Google events:', response.status, await response.text())
    return []
  }

  const data = await response.json()
  return data.items || []
}

async function markGoogleSyncError(supabaseClient: any, staffId: string, now: Date, message: string) {
  await supabaseClient
    .from('google_calendar_sync')
    .update({
      last_sync_at: now.toISOString(),
      last_sync_status: 'error',
      last_sync_error: message,
      updated_at: now.toISOString()
    })
    .eq('staff_id', staffId)
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

function isMissingProviderColumnError(error: any) {
  if (!error) return false
  const message = String(error.message || error.details || '')
  return message.includes('calendar_provider') || message.includes('external_event_id')
}

async function getRequestedStaffId(req: Request, supabaseClient: any) {
  const authorization = req.headers.get('authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return null

  try {
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !userData?.user?.id) return null

    const { data: profile, error: profileError } = await supabaseClient
      .from('scheduling_staff_profiles')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Could not resolve staff profile for calendar sync:', profileError)
      return null
    }

    return profile?.id || null
  } catch (error) {
    console.error('Could not resolve requested staff sync scope:', error)
    return null
  }
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

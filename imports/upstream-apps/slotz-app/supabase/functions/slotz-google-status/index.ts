import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const supabaseUrl = requiredAnyEnv(['SUPABASE_URL', 'SLOTZ_SUPABASE_URL'])
    const adminKey = requiredEnv('SLOTZ_SUPABASE_ADMIN_KEY')

    const adminClient = createClient(supabaseUrl, adminKey)
    const authToken = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await adminClient.auth.getUser(authToken)
    if (userError || !user) return json({ error: 'Invalid staff session' }, 401)

    const { data: staffProfile, error: staffError } = await adminClient
      .from('scheduling_staff_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (staffError || !staffProfile) return json({ error: 'Staff profile not found' }, 403)

    const { data: googleToken, error: tokenError } = await adminClient
      .from('google_oauth_tokens')
      .select('account_username, expires_at, refresh_token_expires_at, is_active')
      .eq('staff_id', staffProfile.id)
      .eq('is_active', true)
      .maybeSingle()

    if (tokenError) throw tokenError

    const { data: sync, error: syncError } = await adminClient
      .from('google_calendar_sync')
      .select('is_enabled, last_sync_at, last_sync_status, last_sync_error')
      .eq('staff_id', staffProfile.id)
      .maybeSingle()

    if (syncError) throw syncError

    return json({
      connected: Boolean(googleToken?.is_active && sync?.is_enabled),
      accountEmail: googleToken?.account_username || null,
      expiresAt: googleToken?.expires_at || null,
      refreshTokenExpiresAt: googleToken?.refresh_token_expires_at || null,
      lastSyncAt: sync?.last_sync_at || null,
      lastSyncStatus: sync?.last_sync_status || null,
      lastSyncError: sync?.last_sync_error || null,
    })
  } catch (error) {
    console.error('Google status error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

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

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

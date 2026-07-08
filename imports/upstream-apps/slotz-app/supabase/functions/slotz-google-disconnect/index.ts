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

    const supabase = createClient(
      requiredAnyEnv(['SUPABASE_URL', 'SLOTZ_SUPABASE_URL']),
      requiredEnv('SLOTZ_SUPABASE_ADMIN_KEY')
    )
    const authToken = authHeader.replace(/^Bearer\s+/i, '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(authToken)
    if (userError || !user) return json({ error: 'Invalid staff session' }, 401)

    const { data: staffProfile, error: staffError } = await supabase
      .from('scheduling_staff_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (staffError || !staffProfile) return json({ error: 'Staff profile not found' }, 403)

    const now = new Date().toISOString()
    const { error: tokenError } = await supabase
      .from('google_oauth_tokens')
      .update({ is_active: false, updated_at: now })
      .eq('staff_id', staffProfile.id)

    if (tokenError) throw tokenError

    const { error: syncError } = await supabase
      .from('google_calendar_sync')
      .upsert({
        staff_id: staffProfile.id,
        is_enabled: false,
        last_sync_status: null,
        last_sync_error: null,
        updated_at: now,
      }, { onConflict: 'staff_id' })

    if (syncError) throw syncError

    return json({ success: true })
  } catch (error) {
    console.error('Google disconnect error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

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

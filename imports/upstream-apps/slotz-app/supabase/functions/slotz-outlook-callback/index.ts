import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method === 'POST') {
      const { code, state } = await req.json()
      if (!code || !state) return json({ error: 'Missing Outlook authorization code' }, 400)
      await completeOutlookConnection(String(code), String(state))
      return json({ success: true })
    }

    const url = new URL(req.url)
    const error = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')

    if (error) {
      console.error('Microsoft OAuth returned error:', error, errorDescription)
      const appUrl = await getAppUrlForCallback(req)
      return redirect(`${appUrl}?slotz_outlook=error`)
    }

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) {
      const appUrl = await getAppUrlForCallback(req)
      return redirect(`${appUrl}?slotz_outlook=error`)
    }

    const statePayload = await verifyState(state)
    const appUrl = getAppUrlFromState(statePayload)
    const staffId = String(statePayload.staffId || '')
    const createdAt = Number(statePayload.createdAt || 0)
    if (!staffId || !createdAt || Date.now() - createdAt > 10 * 60 * 1000) {
      throw new Error('Invalid or expired OAuth state')
    }

    const supabase = createClient(
      requiredAnyEnv(['SUPABASE_URL', 'SLOTZ_SUPABASE_URL']),
      requiredEnv('SLOTZ_SUPABASE_ADMIN_KEY')
    )
    const codeVerifier = String(statePayload.codeVerifier || '')
    if (!codeVerifier) throw new Error('Missing OAuth code verifier')

    await saveOutlookConnection(supabase, staffId, code, codeVerifier)

    return redirect(`${appUrl}?slotz_outlook=connected`)
  } catch (error) {
    console.error('Outlook callback error:', error)
    const reason = classifyCallbackError(error)
    await recordCallbackFailure(req, reason)
    const appUrl = await getAppUrlForCallback(req)
    return redirect(`${appUrl}?slotz_outlook=error&reason=${reason}`)
  }
})

async function completeOutlookConnection(code: string, state: string) {
  const statePayload = await verifyState(state)
  const staffId = String(statePayload.staffId || '')
  const createdAt = Number(statePayload.createdAt || 0)
  if (!staffId || !createdAt || Date.now() - createdAt > 10 * 60 * 1000) {
    throw new Error('Invalid or expired OAuth state')
  }

  const supabase = createClient(
    requiredAnyEnv(['SUPABASE_URL', 'SLOTZ_SUPABASE_URL']),
    requiredEnv('SLOTZ_SUPABASE_ADMIN_KEY')
  )
  const codeVerifier = String(statePayload.codeVerifier || '')
  if (!codeVerifier) throw new Error('Missing OAuth code verifier')

  await saveOutlookConnection(supabase, staffId, code, codeVerifier)
}

async function saveOutlookConnection(supabase: any, staffId: string, code: string, codeVerifier: string) {
  const { data: staffProfile, error: staffError } = await supabase
    .from('scheduling_staff_profiles')
    .select('tenant_id')
    .eq('id', staffId)
    .single()

  if (staffError || !staffProfile?.tenant_id) {
    throw new Error('Staff profile tenant was not found for Outlook connection')
  }

  const tenantId = staffProfile.tenant_id
  const tokenData = await exchangeCode(supabase, code, codeVerifier)
  const microsoftProfile = await fetchMicrosoftProfile(tokenData.access_token)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + Number(tokenData.expires_in || 3600) * 1000)
  const refreshExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  await supabase.from('outlook_oauth_tokens').update({ is_active: false }).eq('staff_id', staffId)

  const { error: tokenError } = await supabase
    .from('outlook_oauth_tokens')
    .upsert({
      staff_id: staffId,
      tenant_id: String(tenantId),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
      refresh_token_expires_at: refreshExpiresAt.toISOString(),
      account_id: microsoftProfile.id || microsoftProfile.userPrincipalName || microsoftProfile.mail,
      account_username: microsoftProfile.mail || microsoftProfile.userPrincipalName,
      account_name: microsoftProfile.displayName,
      token_type: tokenData.token_type || 'Bearer',
      scope: tokenData.scope || 'offline_access User.Read Calendars.ReadWrite',
      is_active: true,
      updated_at: now.toISOString(),
    }, { onConflict: 'staff_id' })

  if (tokenError) throw tokenError

  const { error: syncError } = await supabase
    .from('outlook_calendar_sync')
    .upsert({
      staff_id: staffId,
      tenant_id: tenantId,
      is_enabled: true,
      sync_interval_minutes: 1440,
      last_sync_status: null,
      last_sync_error: null,
      updated_at: now.toISOString(),
    }, { onConflict: 'staff_id' })

  if (syncError) throw syncError
}

function classifyCallbackError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (message.includes('state')) return 'state'
  if (message.includes('token exchange') || message.includes('aadsts') || message.includes('client_secret') || message.includes('authorization code')) return 'token_exchange'
  if (message.includes('refresh token')) return 'missing_refresh_token'
  if (message.includes('profile') || message.includes('graph')) return 'profile'
  if (message.includes('outlook_oauth_tokens')) return 'token_save'
  if (message.includes('outlook_calendar_sync')) return 'sync_save'
  if (message.includes('missing slotz_')) return 'missing_secret'
  return 'callback'
}

async function recordCallbackFailure(req: Request, reason: string) {
  try {
    const url = new URL(req.url)
    const state = url.searchParams.get('state')
    if (!state) return

    const statePayload = await verifyState(state)
    const staffId = String(statePayload.staffId || '')
    if (!staffId) return

    const supabase = createClient(
      requiredAnyEnv(['SUPABASE_URL', 'SLOTZ_SUPABASE_URL']),
      requiredEnv('SLOTZ_SUPABASE_ADMIN_KEY')
    )

    await supabase
      .from('outlook_calendar_sync')
      .upsert({
        staff_id: staffId,
        is_enabled: false,
        last_sync_status: 'error',
        last_sync_error: `outlook_callback_${reason}`,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'staff_id' })
  } catch (diagnosticError) {
    console.error('Could not record Outlook callback failure:', diagnosticError)
  }
}

async function exchangeCode(supabase: any, code: string, codeVerifier: string) {
  const params = new URLSearchParams({
    client_id: getAzureClientId(),
    client_secret: await getAzureClientSecret(supabase),
    code,
    code_verifier: codeVerifier,
    redirect_uri: getRedirectUri(),
    grant_type: 'authorization_code',
    scope: 'offline_access User.Read Calendars.ReadWrite',
  })

  const tenantId = getAzureTenantId()
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const body = await response.json()
  if (!response.ok) throw new Error(body.error_description || body.error || 'Token exchange failed')
  if (!body.refresh_token) throw new Error('Microsoft did not return a refresh token')
  return body
}

async function getAzureClientSecret(supabase: any) {
  const envSecret = Deno.env.get('SLOTZ_AZURE_CLIENT_SECRET')
  if (envSecret) return envSecret

  const { data, error } = await supabase
    .from('vault.decrypted_secrets')
    .select('decrypted_secret')
    .eq('name', 'SLOTZ_AZURE_CLIENT_SECRET')
    .single()

  if (error || !data?.decrypted_secret) throw new Error('Missing SLOTZ_AZURE_CLIENT_SECRET')
  return data.decrypted_secret
}

async function fetchMicrosoftProfile(accessToken: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message || 'Microsoft profile lookup failed')
  return body
}

async function verifyState(state: string): Promise<Record<string, unknown>> {
  const [payload, signature] = state.split('.')
  if (!payload || !signature) throw new Error('Malformed OAuth state')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(requiredEnv('SLOTZ_SUPABASE_ADMIN_KEY')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlDecode(signature),
    new TextEncoder().encode(payload)
  )
  if (!isValid) throw new Error('OAuth state signature mismatch')
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)))
}

function getRedirectUri() {
  return requiredEnv('SLOTZ_OUTLOOK_REDIRECT_URI')
}

function getAzureClientId() {
  return requiredEnv('SLOTZ_AZURE_CLIENT_ID')
}

function getAzureTenantId() {
  return requiredEnv('SLOTZ_AZURE_TENANT_ID')
}

async function getAppUrlForCallback(req: Request) {
  try {
    const state = new URL(req.url).searchParams.get('state')
    if (state) return getAppUrlFromState(await verifyState(state))
  } catch {
    // Fall through to the configured app URL so users still land back in SLOTZ.
  }

  return normalizeAllowedAppUrl(Deno.env.get('SLOTZ_APP_URL') || '')
}

function getAppUrlFromState(statePayload: Record<string, unknown>) {
  const appUrl = typeof statePayload.appUrl === 'string' ? statePayload.appUrl : Deno.env.get('SLOTZ_APP_URL') || ''
  return normalizeAllowedAppUrl(appUrl)
}

function normalizeAllowedAppUrl(value: string) {
  try {
    const url = new URL(value)
    const origin = url.origin
    const allowedOrigins = new Set([
      'https://slotz.boh.australis.cloud',
      'https://dev-slotz.boh.australis.cloud',
      'https://boh.australis.cloud',
      'https://dev-boh.australis.cloud',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'http://localhost:5180',
      'http://127.0.0.1:5180',
      'http://localhost:5189',
      'http://127.0.0.1:5189',
    ])

    if (!allowedOrigins.has(origin)) throw new Error('Unapproved SLOTZ app URL')
    return `${origin}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    throw new Error('Invalid SLOTZ app URL')
  }
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

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location } })
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

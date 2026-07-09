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
    const clientId = getAzureClientId()
    const tenantId = getAzureTenantId()
    const redirectUri = getRedirectUri()
    const appUrl = await getAppUrl(req)

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

    const codeVerifier = createCodeVerifier()
    const codeChallenge = await createCodeChallenge(codeVerifier)
    const state = await signState({ staffId: staffProfile.id, createdAt: Date.now(), codeVerifier, appUrl })
    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`)
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_mode', 'query')
    authUrl.searchParams.set('scope', 'offline_access User.Read Calendars.ReadWrite')
    authUrl.searchParams.set('prompt', 'select_account')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')

    return json({ authUrl: authUrl.toString() })
  } catch (error) {
    console.error('Outlook connect error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500)
  }
})

async function signState(payload: Record<string, unknown>) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const secret = requiredEnv('SLOTZ_SUPABASE_ADMIN_KEY')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload))
  return `${encodedPayload}.${base64UrlEncode(signature)}`
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

async function getAppUrl(req: Request) {
  const requestedAppUrl = await readRequestedAppUrl(req)
  return normalizeAllowedAppUrl(requestedAppUrl || req.headers.get('Origin') || Deno.env.get('SLOTZ_APP_URL') || '')
}

async function readRequestedAppUrl(req: Request) {
  try {
    const body = await req.clone().json()
    return typeof body?.appUrl === 'string' ? body.appUrl : null
  } catch {
    return null
  }
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

function base64UrlEncode(value: string | ArrayBuffer) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value)
  let binary = ''
  bytes.forEach((byte) => binary += String.fromCharCode(byte))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function createCodeVerifier() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes.buffer)
}

async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64UrlEncode(digest)
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

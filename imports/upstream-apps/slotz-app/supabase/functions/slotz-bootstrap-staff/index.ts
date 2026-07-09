import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const investorCallEmails = new Set([
  'alanum@jobzcafe.com',
  'boshea@jobzcafe.com',
])

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
    if (userError || !user?.email) return json({ error: 'Invalid staff session' }, 401)

    const email = user.email.trim().toLowerCase()
    const bohUser = await resolveActiveBohUser(adminClient, user.id, email)
    const fullName = resolveFullName(user, bohUser)
    const slug = await resolveUniqueSlug(adminClient, slugify(fullName))

    const { data: existingProfile, error: existingError } = await adminClient
      .from('scheduling_staff_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingError) throw existingError

    const profile = existingProfile || await createStaffProfile(adminClient, {
      userId: user.id,
      email,
      fullName,
      slug,
    })

    await ensureDefaultMeetingTypes(adminClient, profile.id, email)
    await ensureDefaultAvailability(adminClient, profile.id)

    return json({ profileId: profile.id })
  } catch (error) {
    console.error('SLOTZ staff bootstrap error:', error)
    return json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      typeof (error as any)?.status === 'number' ? (error as any).status : 500
    )
  }
})

async function createStaffProfile(adminClient: any, profile: { userId: string; email: string; fullName: string; slug: string }) {
  const { data, error } = await adminClient
    .from('scheduling_staff_profiles')
    .insert({
      user_id: profile.userId,
      full_name: profile.fullName,
      email: profile.email,
      slug: profile.slug,
      timezone: 'Australia/Sydney',
      app_context: 'cafe',
    })
    .select('id')
    .single()

  if (error) throw error
  return data
}

async function ensureDefaultMeetingTypes(adminClient: any, staffId: string, email: string) {
  const { data: existingTypes, error: existingError } = await adminClient
    .from('scheduling_meeting_types')
    .select('slug')
    .eq('staff_id', staffId)

  if (existingError) throw existingError

  const existingSlugs = new Set((existingTypes || []).map((type: { slug: string }) => type.slug))
  const defaults = [
    {
      staff_id: staffId,
      name: 'General Chat',
      slug: 'general-chat',
      description: 'A 25-minute structured conversation',
      duration_minutes: 25,
      buffer_minutes_after: 5,
      is_active: true,
    },
    {
      staff_id: staffId,
      name: 'Quick Chat',
      slug: 'quick-chat',
      description: 'Brief 15-minute check-in',
      duration_minutes: 15,
      buffer_minutes_after: 0,
      is_active: true,
    },
    {
      staff_id: staffId,
      name: 'Strategic Session',
      slug: 'strategic-session',
      description: 'In-depth 55-minute strategic planning session',
      duration_minutes: 55,
      buffer_minutes_after: 5,
      is_active: true,
    },
  ].filter(type => !existingSlugs.has(type.slug))

  if (investorCallEmails.has(email) && !existingSlugs.has('investor-call')) {
    defaults.push({
      staff_id: staffId,
      name: 'Investor Call',
      slug: 'investor-call',
      description: 'A 25-minute investor conversation',
      duration_minutes: 25,
      buffer_minutes_after: 5,
      is_active: true,
    })
  }

  if (defaults.length === 0) return

  const { error } = await adminClient.from('scheduling_meeting_types').insert(defaults)
  if (error) throw error
}

async function ensureDefaultAvailability(adminClient: any, staffId: string) {
  const { data: existingRules, error: existingError } = await adminClient
    .from('scheduling_availability_rules')
    .select('day_of_week')
    .eq('staff_id', staffId)

  if (existingError) throw existingError

  const existingDays = new Set((existingRules || []).map((rule: { day_of_week: number }) => rule.day_of_week))
  const defaults = [0, 1, 2, 3, 4, 5, 6]
    .filter(day => !existingDays.has(day))
    .map(day => ({
      staff_id: staffId,
      day_of_week: day,
      start_time: '07:00:00',
      end_time: '13:00:00',
      is_enabled: day >= 1 && day <= 5,
      timezone: 'Australia/Sydney',
    }))

  if (defaults.length === 0) return

  const { error } = await adminClient.from('scheduling_availability_rules').insert(defaults)
  if (error) throw error
}

async function resolveActiveBohUser(adminClient: any, authUserId: string, email: string) {
  const { data: linkedUser, error: linkedError } = await adminClient
    .from('boh_user')
    .select('id, auth_user_id, email, full_name, status')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (linkedError) throw linkedError

  const bohUser = linkedUser || await resolveBohUserByEmail(adminClient, email)

  if (!bohUser) {
    throw Object.assign(new Error('No active BOH user found for this email.'), { status: 403 })
  }

  if (String(bohUser.status || '').toLowerCase() !== 'active') {
    throw Object.assign(new Error('BOH user is not active for SLOTZ access.'), { status: 403 })
  }

  return bohUser
}

async function resolveBohUserByEmail(adminClient: any, email: string) {
  const { data, error } = await adminClient
    .from('boh_user')
    .select('id, auth_user_id, email, full_name, status')
    .ilike('email', email)
    .maybeSingle()

  if (error) throw error
  return data
}

function resolveFullName(user: any, bohUser: any) {
  if (typeof bohUser?.full_name === 'string' && bohUser.full_name.trim()) {
    return bohUser.full_name.trim()
  }

  const metadata = user.user_metadata || {}
  const name = metadata.full_name || metadata.name || metadata.display_name
  if (typeof name === 'string' && name.trim()) return name.trim()
  return titleCase((user.email || '').split('@')[0].replace(/[._-]+/g, ' '))
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'staff'
}

async function resolveUniqueSlug(adminClient: any, baseSlug: string) {
  const normalizedBase = baseSlug || 'staff'
  const candidates = [normalizedBase, ...Array.from({ length: 49 }, (_value, index) => `${normalizedBase}-${index + 2}`)]

  for (const candidate of candidates) {
    const { data, error } = await adminClient
      .from('scheduling_staff_profiles')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()

    if (error) throw error
    if (!data) return candidate
  }

  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
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

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

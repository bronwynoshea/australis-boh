// @ts-nocheck
import '@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseRest } from '../_shared/supabase.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeParent = (value: unknown): string | null => {
  if (value === null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const [, token] = authHeader.split(' ')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseSecretKey = Deno.env.get('SB_SECRET_KEY')

    if (!supabaseUrl || !supabaseSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const displayName = normalizeString(body.display_name) ?? normalizeString(body.name)
    const runtimeIdRaw = normalizeString(body.runtime_id) ?? (displayName ? slugify(displayName).replace(/-/g, '_') : null)
    if (!runtimeIdRaw) {
      return new Response(
        JSON.stringify({ error: 'runtime_id or display_name is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const canonicalId = normalizeString(body.canonical_id) ?? slugify(runtimeIdRaw.replace(/_/g, '-'))

    const overlayPayload: Record<string, unknown> = {
      runtime_id: runtimeIdRaw,
      canonical_id: canonicalId,
      display_name: displayName ?? runtimeIdRaw,
      section: normalizeString(body.section),
      parent_runtime_id: 'parent_runtime_id' in body ? normalizeParent(body.parent_runtime_id) : normalizeParent(body.parent),
      role: normalizeString(body.role),
      visibility: normalizeString(body.visibility) ?? 'visible',
      managed_by: normalizeString(body.managed_by) ?? 'central_command',
      is_system: 'is_system' in body ? Boolean(body.is_system) : false,
      is_archived: false
    }

    const response = await supabaseRest('/central_agents', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(overlayPayload)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return new Response(
        JSON.stringify({
          error: 'Failed to persist agent metadata',
          upstreamStatus: response.status,
          upstreamBody: errorText
        }),
        { status: 502, headers: corsHeaders }
      )
    }

    const rows = await response.json().catch(() => [])
    const saved = Array.isArray(rows) && rows.length > 0 ? rows[0] : overlayPayload

    return new Response(
      JSON.stringify({
        status: 'created',
        overlay: saved,
        created_by: user.id
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    )
  }
})

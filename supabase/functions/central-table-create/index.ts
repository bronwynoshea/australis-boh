// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Get user from Supabase JWT context
    const userId = req.headers.get('x-supabase-user-id')
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No user context' }),
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

    const name = normalizeString(body.name)
    if (!name) {
      return new Response(
        JSON.stringify({ error: 'name is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const sectionId = normalizeString(body.section_id)
    if (!sectionId) {
      return new Response(
        JSON.stringify({ error: 'section_id is required - table must belong to a section' }),
        { status: 400, headers: corsHeaders }
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

    // Verify section exists
    const { data: section, error: sectionError } = await supabaseAdmin
      .from('central_sections')
      .select('id')
      .eq('id', sectionId)
      .single()

    if (sectionError || !section) {
      return new Response(
        JSON.stringify({ error: 'Invalid section_id - section not found' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const payload = {
      name,
      description: normalizeString(body.description),
      section_id: sectionId,
      table_type: normalizeString(body.table_type) ?? 'kanban',
      owner_user_id: userId,
      metadata: {
        ...body.metadata,
        created_by_type: body.created_by_type || 'human'
      },
      created_by: userId
    }

    const { data: table, error: insertError } = await supabaseAdmin
      .from('central_tables')
      .insert(payload)
      .select()
      .single()

    if (insertError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to create table',
          details: insertError.message
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: 'created',
        table,
        created_by: userId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
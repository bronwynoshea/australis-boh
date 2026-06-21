// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { supabaseRest } from "../_shared/supabase.ts"

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Get user from Supabase JWT context (set by verify_jwt = true)
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

    const title = normalizeString(body.title)
    if (!title) {
      return new Response(
        JSON.stringify({ error: 'title is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const payload = {
      title,
      description: normalizeString(body.description),
      section_id: normalizeString(body.section_id),
      table_id: normalizeString(body.table_id),
      initiative_id: normalizeString(body.initiative_id),
      app_id: normalizeString(body.app_id),
      module_id: normalizeString(body.module_id),
      task_type: normalizeString(body.task_type) ?? 'task',
      priority: normalizeString(body.priority) ?? 'medium',
      governance_status: normalizeString(body.governance_status) ?? 'intake',
      executor_type: normalizeString(body.executor_type) ?? 'agent',
      assigned_role: normalizeString(body.assigned_role),
      assigned_agent_runtime_id: normalizeString(body.assigned_agent_runtime_id),
      acceptance_criteria: normalizeString(body.acceptance_criteria),
      due_at: body.due_at || null,
      metadata: {
        ...body.metadata,
        created_by_agent: body.created_by_agent || null, // Track if agent created it
        created_by_type: body.created_by_type || 'human' // 'human' or 'agent'
      },
      created_by: userId
    }

    const response = await supabaseRest('/central_task', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return new Response(
        JSON.stringify({
          error: 'Failed to create task',
          upstreamStatus: response.status,
          upstreamBody: errorText
        }),
        { status: 502, headers: corsHeaders }
      )
    }

    const rows = await response.json().catch(() => [])
    const task = Array.isArray(rows) && rows.length > 0 ? rows[0] : payload

    return new Response(
      JSON.stringify({
        ok: true,
        status: 'created',
        task,
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
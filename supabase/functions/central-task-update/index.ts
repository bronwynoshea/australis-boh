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

    const taskId = normalizeString(body.id)
    if (!taskId) {
      return new Response(
        JSON.stringify({ error: 'id is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Build update payload dynamically
    const updates: Record<string, unknown> = { updated_by: userId }

    if (body.title !== undefined) {
      const title = normalizeString(body.title)
      if (title) updates.title = title
    }
    if (body.description !== undefined) updates.description = normalizeString(body.description)
    if (body.priority !== undefined) updates.priority = normalizeString(body.priority)
    if (body.governance_status !== undefined) {
      updates.governance_status = normalizeString(body.governance_status)
      // Auto-update timestamps based on status
      if (updates.governance_status === 'assigned') {
        updates.dispatched_at = new Date().toISOString()
      }
      if (updates.governance_status === 'done') {
        updates.completed_at = new Date().toISOString()
      }
    }
    if (body.dispatch_state !== undefined) updates.dispatch_state = normalizeString(body.dispatch_state)
    if (body.executor_type !== undefined) updates.executor_type = normalizeString(body.executor_type)
    if (body.assigned_role !== undefined) updates.assigned_role = normalizeString(body.assigned_role)
    if (body.assigned_agent_runtime_id !== undefined) updates.assigned_agent_runtime_id = normalizeString(body.assigned_agent_runtime_id)
    if (body.assigned_user_id !== undefined) updates.assigned_user_id = body.assigned_user_id
    if (body.acceptance_criteria !== undefined) updates.acceptance_criteria = normalizeString(body.acceptance_criteria)
    if (body.blocked_reason !== undefined) updates.blocked_reason = normalizeString(body.blocked_reason)
    if (body.governance_notes !== undefined) updates.governance_notes = normalizeString(body.governance_notes)
    if (body.due_at !== undefined) updates.due_at = body.due_at
    if (body.is_archived !== undefined) updates.is_archived = Boolean(body.is_archived)
    if (body.metadata !== undefined) updates.metadata = body.metadata

    const response = await supabaseRest(`/central_task?id=eq.${taskId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return new Response(
        JSON.stringify({
          error: 'Failed to update task',
          upstreamStatus: response.status,
          upstreamBody: errorText
        }),
        { status: 502, headers: corsHeaders }
      )
    }

    const rows = await response.json().catch(() => [])
    const task = Array.isArray(rows) && rows.length > 0 ? rows[0] : null

    if (!task) {
      return new Response(
        JSON.stringify({ error: 'Task not found' }),
        { status: 404, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: 'updated',
        task,
        updated_by: userId
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
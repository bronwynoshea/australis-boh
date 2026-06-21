// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const [, token] = authHeader.split(' ')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseSecretKey = Deno.env.get('SB_SECRET_KEY')
    const cfClientId = Deno.env.get('CF_ACCESS_CLIENT_ID')
    const cfClientSecret = Deno.env.get('CF_ACCESS_CLIENT_SECRET')

    if (!supabaseUrl || !supabaseSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
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

    const taskId = body.task_id
    if (!taskId) {
      return new Response(
        JSON.stringify({ error: 'task_id is required' }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Fetch the task
    const { data: task, error: taskError } = await supabaseAdmin
      .from('central_tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return new Response(
        JSON.stringify({ error: 'Task not found', details: taskError?.message }),
        { status: 404, headers: corsHeaders }
      )
    }

    // Check if task is eligible for dispatch
    if (!task.assigned_agent_runtime_id) {
      return new Response(
        JSON.stringify({ error: 'Task has no assigned agent' }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (task.governance_status !== 'assigned' && task.governance_status !== 'ready') {
      return new Response(
        JSON.stringify({ error: `Task status '${task.governance_status}' is not eligible for dispatch` }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Update dispatch state to 'dispatched'
    await supabaseAdmin
      .from('central_tasks')
      .update({
        dispatch_state: 'dispatched',
        dispatched_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('id', taskId)

    // Spawn the agent via OpenClaw bridge
    if (!cfClientId || !cfClientSecret) {
      return new Response(
        JSON.stringify({ error: 'Cloudflare Access credentials not configured' }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Build task context for the agent
    const taskContext = `
**Task ID:** ${task.id}
**Title:** ${task.title}
**Description:** ${task.description || 'No description provided'}
${task.acceptance_criteria ? `**Acceptance Criteria:** ${task.acceptance_criteria}` : ''}
${task.priority ? `**Priority:** ${task.priority}` : ''}
${task.due_at ? `**Due Date:** ${task.due_at}` : ''}

Please complete this task and provide a summary of your work.
    `.trim()

    const spawnResponse = await fetch('https://orbit.jobzcafe.cloud/tools/invoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Access-Client-Id': cfClientId,
        'CF-Access-Client-Secret': cfClientSecret
      },
      body: JSON.stringify({
        tool: 'sessions_spawn',
        args: {
          agentId: task.assigned_agent_runtime_id,
          task: taskContext,
          timeoutSeconds: 1800, // 30 min default
          runtime: 'subagent'
        }
      })
    })

    const spawnResult = await spawnResponse.json().catch(() => ({
      ok: false,
      error: 'Failed to parse spawn response'
    }))

    if (spawnResponse.ok && (spawnResult.ok || spawnResult.sessionId)) {
      // Update task with running state and session ID
      await supabaseAdmin
        .from('central_tasks')
        .update({
          dispatch_state: 'running',
          started_at: new Date().toISOString(),
          metadata: {
            ...task.metadata,
            session_id: spawnResult.sessionId || spawnResult.result?.sessionId
          },
          updated_by: user.id
        })
        .eq('id', taskId)

      return new Response(
        JSON.stringify({
          ok: true,
          status: 'dispatched',
          task_id: taskId,
          agent_id: task.assigned_agent_runtime_id,
          session_id: spawnResult.sessionId || spawnResult.result?.sessionId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Revert dispatch state on failure
      await supabaseAdmin
        .from('central_tasks')
        .update({
          dispatch_state: 'failed',
          blocked_reason: `Dispatch failed: ${spawnResult.error || 'Unknown error'}`,
          updated_by: user.id
        })
        .eq('id', taskId)

      return new Response(
        JSON.stringify({
          error: 'Failed to dispatch agent',
          details: spawnResult.error || 'Unknown error',
          task_id: taskId
        }),
        { status: 502, headers: corsHeaders }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
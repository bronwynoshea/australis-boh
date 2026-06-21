// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Supabase validates JWT automatically (verify_jwt = true in config.toml)
    // Get user from request context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")

    if (!supabaseUrl || !supabaseSecretKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    // Parse query params from body
    const body = await req.json().catch(() => ({}))
    const {
      section_id,
      table_id,
      governance_status,
      dispatch_state,
      assigned_agent_runtime_id,
      executor_type,
      is_archived = false,
      limit = 100,
      offset = 0
    } = body

    // Build query
    let query = supabaseAdmin
      .from("central_task")
      .select("*")
      .eq("is_archived", is_archived)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    // Apply filters
    if (section_id) query = query.eq("section_id", section_id)
    if (table_id) query = query.eq("table_id", table_id)
    if (governance_status) query = query.eq("governance_status", governance_status)
    if (dispatch_state) query = query.eq("dispatch_state", dispatch_state)
    if (assigned_agent_runtime_id) query = query.eq("assigned_agent_runtime_id", assigned_agent_runtime_id)
    if (executor_type) query = query.eq("executor_type", executor_type)

    const { data: tasks, error: queryError } = await query

    if (queryError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch tasks", details: queryError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Get total count for pagination
    let countQuery = supabaseAdmin
      .from("central_task")
      .select("*", { count: "exact", head: true })
      .eq("is_archived", is_archived)

    if (section_id) countQuery = countQuery.eq("section_id", section_id)
    if (table_id) countQuery = countQuery.eq("table_id", table_id)
    if (governance_status) countQuery = countQuery.eq("governance_status", governance_status)
    if (dispatch_state) countQuery = countQuery.eq("dispatch_state", dispatch_state)
    if (assigned_agent_runtime_id) countQuery = countQuery.eq("assigned_agent_runtime_id", assigned_agent_runtime_id)
    if (executor_type) countQuery = countQuery.eq("executor_type", executor_type)

    const { count, error: countError } = await countQuery

    if (countError) {
      console.warn("Failed to get count:", countError)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        tasks: tasks || [],
        count: tasks?.length || 0,
        total_count: count || tasks?.length || 0,
        limit,
        offset
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
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
      section,
      visibility,
      is_archived = false,
      managed_by,
      limit = 100,
      offset = 0
    } = body

    // Build query
    let query = supabaseAdmin
      .from("central_agents")
      .select("*")
      .eq("is_archived", is_archived)
      .order("sort_order", { ascending: true })
      .order("display_name", { ascending: true })
      .limit(limit)
      .range(offset, offset + limit - 1)

    // Apply filters
    if (section) query = query.eq("section", section)
    if (visibility) query = query.eq("visibility", visibility)
    if (managed_by) query = query.eq("managed_by", managed_by)

    const { data: agents, error: queryError } = await query

    if (queryError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch agents", details: queryError.message }),
        { status: 500, headers: corsHeaders }
      )
    }

    // Get total count
    let countQuery = supabaseAdmin
      .from("central_agents")
      .select("*", { count: "exact", head: true })
      .eq("is_archived", is_archived)

    if (section) countQuery = countQuery.eq("section", section)
    if (visibility) countQuery = countQuery.eq("visibility", visibility)
    if (managed_by) countQuery = countQuery.eq("managed_by", managed_by)

    const { count, error: countError } = await countQuery

    if (countError) {
      console.warn("Failed to get count:", countError)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        agents: agents || [],
        count: agents?.length || 0,
        total_count: count || agents?.length || 0,
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
// @ts-nocheck
// Submit agent creation request (Rocket → Maverick)
import "https://esm.sh/@supabase/functions-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

function handleCors(req) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 })
  }
  return null
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST is allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const body = await req.json()
    const {
      requester_agent_id,
      requested_name,
      worker_type,
      section,
      priority = 'normal',
      justification,
      expected_duration,
      model_budget_tier = 'free',
      assigned_app,
      assigned_project,
      is_temporary = true
    } = body

    if (!requester_agent_id || !requested_name || !worker_type || !section || !justification) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2")
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('central_agent_creation_requests')
      .insert({
        requester_agent_id,
        requested_name,
        worker_type,
        section,
        priority,
        justification,
        expected_duration,
        model_budget_tier,
        assigned_app,
        assigned_project,
        is_temporary,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, request: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

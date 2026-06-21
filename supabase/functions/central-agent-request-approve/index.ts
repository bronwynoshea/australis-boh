// @ts-nocheck
// Approve or deny agent creation request (Maverick)
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
    const { request_id, action, resolved_by, resolution_notes, created_agent_id } = body

    if (!request_id || !action || !resolved_by) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: request_id, action, resolved_by" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!['approved', 'denied'].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Action must be 'approved' or 'denied'" }),
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

    const updates = {
      status: action,
      resolved_by,
      resolution_notes: resolution_notes || null,
      resolved_at: new Date().toISOString()
    }

    if (action === 'approved' && created_agent_id) {
      updates.created_agent_id = created_agent_id
    }

    const { data, error } = await supabase
      .from('central_agent_creation_requests')
      .update(updates)
      .eq('id', request_id)
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

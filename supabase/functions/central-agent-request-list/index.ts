// @ts-nocheck
// List agent creation requests (for Maverick's approval queue)
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
    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Only GET is allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'pending'
    const section = url.searchParams.get('section')

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

    let query = supabase
      .from('central_agent_creation_requests')
      .select('*')
      .eq('status', status)
      .order('requested_at', { ascending: false })

    if (section) {
      query = query.eq('section', section)
    }

    const { data, error } = await query

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ ok: true, requests: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

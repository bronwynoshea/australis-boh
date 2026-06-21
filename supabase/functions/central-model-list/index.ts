// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { supabaseRest } from "../_shared/supabase.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log('[central-model-list] Function called')
    console.log('[central-model-list] Method:', req.method)

    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Only GET is allowed" }),
        { status: 405, headers: corsHeaders }
      )
    }

    // Custom JWT validation - don't rely on legacy Supabase JWT verification
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[central-model-list] Missing or invalid Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    if (!token) {
      console.log('[central-model-list] No token in Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate JWT with Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      console.log('[central-model-list] Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      console.log('[central-model-list] Invalid JWT token')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-model-list] Authenticated user ID:', user.id)

    const response = await supabaseRest("/central_models?select=model_key,display_name,provider,provider_model_id,governance_status,visible_in_picker,is_default_for_new_agents,fallback_eligible,input_price_per_1m_tokens,output_price_per_1m_tokens,currency,sort_order,notes,created_at,updated_at&order=sort_order.asc,display_name.asc")
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      throw new Error(`Failed to load model catalog: ${response.status} ${errorText}`)
    }

    const models = await response.json().catch(() => [])

    return new Response(
      JSON.stringify({
        models: models,
        count: models.length,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    )
  }
})

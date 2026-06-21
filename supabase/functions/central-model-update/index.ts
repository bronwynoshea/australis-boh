// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { supabaseRest } from "../_shared/supabase.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeNumber = (value: unknown): number | null => {
  if (typeof value !== "number") return null
  return isNaN(value) ? null : value
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log('[central-model-update] Function called')
    console.log('[central-model-update] Method:', req.method)

    // Custom JWT validation - don't rely on legacy Supabase JWT verification
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[central-model-update] Missing or invalid Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    if (!token) {
      console.log('[central-model-update] No token in Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate JWT with Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      console.log('[central-model-update] Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      console.log('[central-model-update] Invalid JWT token')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-model-update] Authenticated user ID:', user.id)

    // Optional: Check admin allowlist for model catalog updates
    const adminEmails = Deno.env.get("CENTRAL_ADMIN_EMAILS")
    if (adminEmails) {
      const allowedEmails = adminEmails.split(",").map(e => e.trim().toLowerCase())
      if (!allowedEmails.includes(user.email!.toLowerCase())) {
        console.log('[central-model-update] User not in admin allowlist')
        return new Response(
          JSON.stringify({ error: "Forbidden: Model catalog updates require admin privileges" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    // Parse and validate request body
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const modelId = typeof body.id === "string" ? body.id.trim() : ""
    if (!modelId) {
      return new Response(
        JSON.stringify({ error: "id is required" }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('[central-model-update] User updating model:', modelId)

    const payload: Record<string, unknown> = {
      model_key: modelId
    }

    if ("display_name" in body) payload.display_name = normalizeString(body.display_name)
    if ("provider" in body) payload.provider = normalizeString(body.provider)
    if ("provider_model_id" in body) payload.provider_model_id = normalizeString(body.provider_model_id)
    if ("governance_status" in body) payload.governance_status = normalizeString(body.governance_status)
    if ("visible_in_picker" in body) payload.visible_in_picker = Boolean(body.visible_in_picker)
    if ("is_default_for_new_agents" in body) payload.is_default_for_new_agents = Boolean(body.is_default_for_new_agents)
    if ("fallback_eligible" in body) payload.fallback_eligible = Boolean(body.fallback_eligible)
    if ("sort_order" in body && typeof body.sort_order === "number") payload.sort_order = body.sort_order
    if ("notes" in body) payload.notes = normalizeString(body.notes)
    if ("input_price_per_1m_tokens" in body) payload.input_price_per_1m_tokens = normalizeNumber(body.input_price_per_1m_tokens)
    if ("output_price_per_1m_tokens" in body) payload.output_price_per_1m_tokens = normalizeNumber(body.output_price_per_1m_tokens)
    if ("currency" in body) payload.currency = normalizeString(body.currency)

    const response = await supabaseRest("/central_models", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return new Response(
        JSON.stringify({
          error: "Failed to persist model metadata",
          upstreamStatus: response.status,
          upstreamBody: errorText
        }),
        { status: 502, headers: corsHeaders }
      )
    }

    const rows = await response.json().catch(() => [])
    const saved = Array.isArray(rows) && rows.length > 0 ? rows[0] : payload

    return new Response(JSON.stringify({ status: "updated", model: saved }), {
      status: 200,
      headers: corsHeaders
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    )
  }
})

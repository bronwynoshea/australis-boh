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

const normalizeParent = (value: unknown): string | null => {
  if (value === null) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log('[central-agent-update] Function called')
    console.log('[central-agent-update] Method:', req.method)

    // Custom JWT validation - don't rely on legacy Supabase JWT verification
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[central-agent-update] Missing or invalid Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    if (!token) {
      console.log('[central-agent-update] No token in Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate JWT with Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      console.log('[central-agent-update] Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      console.log('[central-agent-update] Invalid JWT token')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-agent-update] Authenticated user ID:', user.id)

    // Parse and validate request body
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const runtimeIdRaw = typeof body.runtime_id === "string" ? body.runtime_id.trim() : ""
    if (!runtimeIdRaw) {
      return new Response(
        JSON.stringify({ error: "runtime_id is required" }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log('[central-agent-update] User updating agent:', runtimeIdRaw)

    const overlayPayload: Record<string, unknown> = {
      runtime_id: runtimeIdRaw
    }

    if ("canonical_id" in body) overlayPayload.canonical_id = normalizeString(body.canonical_id)
    if ("display_name" in body) overlayPayload.display_name = normalizeString(body.display_name)
    if ("section" in body) overlayPayload.section = normalizeString(body.section)

    if ("parent_runtime_id" in body) {
      overlayPayload.parent_runtime_id = normalizeParent(body.parent_runtime_id)
    } else if ("parent" in body) {
      overlayPayload.parent_runtime_id = normalizeParent(body.parent)
    }

    if ("role" in body) overlayPayload.role = normalizeString(body.role)
    if ("visibility" in body) overlayPayload.visibility = normalizeString(body.visibility)
    overlayPayload.managed_by = normalizeString(body.managed_by) ?? "central_command"
    overlayPayload.is_system = "is_system" in body ? Boolean(body.is_system) : undefined

    const response = await supabaseRest("/central_agents", {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(overlayPayload)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return new Response(
        JSON.stringify({
          error: "Failed to persist overlay metadata",
          upstreamStatus: response.status,
          upstreamBody: errorText
        }),
        { status: 502, headers: corsHeaders }
      )
    }

    const rows = await response.json().catch(() => [])
    const saved = Array.isArray(rows) && rows.length > 0 ? rows[0] : overlayPayload

    return new Response(JSON.stringify({ status: "updated", overlay: saved }), {
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

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/central-update-agent' \
    --header 'Authorization: Bearer <ANON_OR_AUTH_TOKEN>' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

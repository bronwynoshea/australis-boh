// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { supabaseRest } from "../_shared/supabase.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_DELETE_MODES = new Set(["archive", "hard_delete"])

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log('[central-agent-delete] Function called')
    console.log('[central-agent-delete] Method:', req.method)

    // Custom JWT validation - don't rely on legacy Supabase JWT verification
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[central-agent-delete] Missing or invalid Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    if (!token) {
      console.log('[central-agent-delete] No token in Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate JWT with Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      console.log('[central-agent-delete] Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      console.log('[central-agent-delete] Invalid JWT token')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-agent-delete] Authenticated user ID:', user.id)

    // Optional: Check admin allowlist for delete operations
    const adminEmails = Deno.env.get("CENTRAL_ADMIN_EMAILS")
    if (adminEmails) {
      const allowedEmails = adminEmails.split(",").map(e => e.trim().toLowerCase())
      if (!allowedEmails.includes(user.email!.toLowerCase())) {
        console.log('[central-agent-delete] User not in admin allowlist')
        return new Response(
          JSON.stringify({ error: "Forbidden: Delete operations require admin privileges" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    // Parse and validate request body
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({
          error: "Invalid JSON payload"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      )
    }

    const { runtime_id, delete_mode } = body

    console.log('[central-agent-delete] User deleting agent:', runtime_id, 'mode:', delete_mode)

    if (!runtime_id || typeof runtime_id !== "string" || runtime_id.trim() === "") {
      return new Response(
        JSON.stringify({
          error: "runtime_id is required and must be a non-empty string"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      )
    }

    if (!delete_mode || typeof delete_mode !== "string") {
      return new Response(
        JSON.stringify({
          error: "delete_mode is required"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      )
    }

    const normalizedMode = delete_mode.trim().toLowerCase()
    if (!ALLOWED_DELETE_MODES.has(normalizedMode)) {
      return new Response(
        JSON.stringify({
          error: "delete_mode must be one of: archive, hard_delete"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      )
    }

    if (normalizedMode === "hard_delete") {
      return new Response(
        JSON.stringify({
          error: "hard_delete is not implemented yet"
        }),
        {
          status: 501,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      )
    }

    const runtimeIdTrimmed = runtime_id.trim()
    const overlayPayload = {
      runtime_id: runtimeIdTrimmed,
      canonical_id: runtimeIdTrimmed,
      is_archived: true,
      archived_at: new Date().toISOString(),
      managed_by: "central_command"
    }

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
          error: "Failed to archive agent",
          details: errorText,
          upstreamStatus: response.status,
          upstreamBody: errorText
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      )
    }

    const rows = await response.json().catch(() => [])
    const archived = Array.isArray(rows) && rows.length > 0 ? rows[0] : overlayPayload

    const successResponse = {
      status: "archived",
      runtime_id: runtime_id.trim(),
      delete_mode: normalizedMode,
      overlay: archived
    }

    return new Response(JSON.stringify(successResponse), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    )
  }
})

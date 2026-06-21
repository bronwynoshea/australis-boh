// @ts-nocheck
// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface SessionCreateRequest {
  agentId: string
}

interface SessionCreateResponse {
  sessionId: string
  agentId: string
  createdAt: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log('[central-session-create] Function called')
    console.log('[central-session-create] Method:', req.method)

    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[central-session-create] Missing or invalid Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    if (!token) {
      console.log('[central-session-create] No token in Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      console.log('[central-session-create] Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      console.log('[central-session-create] Invalid JWT token')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-session-create] Authenticated user ID:', user.id)

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const agentId = typeof body.agentId === "string" ? body.agentId.trim() : ""
    if (!agentId) {
      return new Response(
        JSON.stringify({ error: "agentId is required" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const bridgeUrl = Deno.env.get("OPENCLAW_BRIDGE_URL")
    const bridgeToken = Deno.env.get("OPENCLAW_BRIDGE_TOKEN")
    
    if (!bridgeUrl) {
      console.error('[central-session-create] Missing OPENCLAW_BRIDGE_URL')
      return new Response(
        JSON.stringify({ error: "Server configuration error - missing bridge URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Generate stable session key
    const sessionKey = `chat-${user.id}-${agentId}-${Date.now()}`
    
    console.log('[central-session-create] Generated session key:', {
      sessionKey,
      agentId,
      userId: user.id
    })

    // Verify the agent exists by calling bridge-api
    try {
      const agentsUrl = `${bridgeUrl.replace(/\/$/, "")}/agents`
      const headers: Record<string, string> = {}
      if (bridgeToken) {
        headers["Authorization"] = `Bearer ${bridgeToken}`
      }
      
      const response = await fetch(agentsUrl, {
        method: "GET",
        headers,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[central-session-create] Failed to verify OpenClaw connection:', {
          status: response.status,
          error: errorText.substring(0, 200)
        })
        return new Response(
          JSON.stringify({
            error: "Failed to connect to OpenClaw",
            upstreamStatus: response.status
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const agentsData = await response.json()
      const agents = agentsData.agents || []
      const agentExists = agents.some((a: any) => a.id === agentId || a.runtime_id === agentId)
      
      console.log('[central-session-create] OpenClaw connection verified:', {
        totalAgents: agents.length,
        agentExists
      })

      if (!agentExists) {
        return new Response(
          JSON.stringify({ error: `Agent '${agentId}' not found` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

    } catch (fetchError) {
      console.error('[central-session-create] Network error:', fetchError.message)
      return new Response(
        JSON.stringify({
          error: "Network error while verifying OpenClaw connection",
          networkError: fetchError.message
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-session-create] Confirmed sessionId:', sessionKey)

    const sessionResponse: SessionCreateResponse = {
      sessionId: sessionKey,
      agentId: agentId,
      createdAt: new Date().toISOString()
    }

    return new Response(JSON.stringify(sessionResponse), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error('[central-session-create] Unexpected error:', {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

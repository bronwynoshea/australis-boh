// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { processBridgeResponseForUsage } from "../_shared/token-usage.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log('[central-agent-chat] Function called')
    console.log('[central-agent-chat] Method:', req.method)

    // Custom JWT validation - don't rely on legacy Supabase JWT verification
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[central-agent-chat] Missing or invalid Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    if (!token) {
      console.log('[central-agent-chat] No token in Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate JWT with Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      console.log('[central-agent-chat] Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      console.log('[central-agent-chat] Invalid JWT token')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-agent-chat] Authenticated user ID:', user.id)

    // Parse and validate request body
    const body = await req.json()
    const { agentId, message, sessionId } = body

    console.log('[central-agent-chat] Request payload:', {
      agentId,
      message,
      sessionId,
      fullBody: body
    })

    console.log('[central-agent-chat] User chatting with agent:', agentId)

    // Get OpenClaw Gateway token
    const gatewayToken = Deno.env.get("OPENCLAW_GATEWAY_API")
    if (!gatewayToken) {
      console.log('[central-agent-chat] Missing OPENCLAW_GATEWAY_API token')
      return new Response(
        JSON.stringify({ error: "Server configuration error - missing gateway token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const backendUrl = `https://orbit.jobzcafe.cloud/agents/${agentId}/chat`
    console.log('[central-agent-chat] Forwarding to backend:', {
      backendUrl,
      agentId,
      messageLength: message?.length || 0
    })

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        message
      })
    })

    const text = await response.text()
    
    // Check if response is HTML (error page) instead of JSON
    const contentType = response.headers.get("content-type") || ""
    if (contentType.includes("text/html")) {
      return new Response(
        JSON.stringify({
          error: "Gateway authentication failed - received HTML instead of JSON",
          upstreamStatus: response.status,
          upstreamContentType: contentType,
          upstreamBodyPreview: text.slice(0, 200),
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      )
    }

    // Try to parse as JSON
    let data
    try {
      data = JSON.parse(text)
      
      // Log response structure to identify token usage fields
      console.log("Agent chat bridge API response structure:", JSON.stringify(data, null, 2))
      
      // Check if response contains token usage information
      if (data.usage || data.tokens || data.token_usage || data.cost) {
        console.log("Token usage data found in agent chat response:", {
          usage: data.usage,
          tokens: data.tokens,
          token_usage: data.token_usage,
          cost: data.cost
        })
      }
      
      // Capture token usage if available
      await processBridgeResponseForUsage(data, {
        agentId: agentId,
        source: 'agent_chat'
      })
      
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          error: "Failed to parse API response as JSON",
          upstreamStatus: response.status,
          upstreamContentType: contentType,
          upstreamBodyPreview: text.slice(0, 500),
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

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    })

  } catch (err) {

    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    })

  }
})

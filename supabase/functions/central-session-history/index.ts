// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface SessionHistoryRequest {
  sessionId: string
  limit?: number
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const [, token] = authHeader.split(" ")
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")

    if (!supabaseUrl || !supabaseSecretKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json() as SessionHistoryRequest
    const sessionId = body.sessionId?.trim()
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required and must be a non-empty string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const gatewayToken = Deno.env.get("OPENCLAW_GATEWAY_API")
    
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Server configuration error - missing bridge credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Use tools/invoke endpoint to call sessions_history
    const backendUrl = `https://orbit.jobzcafe.cloud/tools/invoke`
    
    console.log('[central-session-history] Fetching history for session:', sessionId)

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gatewayToken}`,
        // Token in Authorization header above
      },
      body: JSON.stringify({
        tool: "sessions_history",
        sessionKey: sessionId,
        args: {
          sessionKey: sessionId,
          limit: body.limit || 50
        }
      })
    })

    const text = await response.text()
    const contentType = response.headers.get("content-type") || ""
    
    if (contentType.includes("text/html")) {
      return new Response(JSON.stringify({ error: "Bridge API authentication failed", upstreamStatus: response.status }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let data: any = null
    if (text) {
      try { 
        data = JSON.parse(text) 
      } catch {
        return new Response(JSON.stringify({ error: "Failed to parse bridge API response as JSON", upstreamStatus: response.status }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    // Handle the tools/invoke response format
    // The result is in data.result when successful
    const historyData = data?.result || data
    
    // If session not found or error, return empty history
    if (!response.ok || data?.ok === false) {
      console.log('[central-session-history] Session not found or error:', { status: response.status, data })
      return new Response(JSON.stringify({
        ok: true,
        sessionId,
        history: [],
        upstreamStatus: response.status,
        upstreamError: data?.error?.message || "Session not found",
        raw: data,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Extract messages from the history response
    const messages = Array.isArray(historyData?.history) ? historyData.history : 
                    Array.isArray(historyData?.messages) ? historyData.messages :
                    Array.isArray(historyData) ? historyData : []

    return new Response(JSON.stringify({
      ok: true,
      sessionId,
      history: messages,
      upstreamStatus: response.status,
      raw: data,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error('[central-session-history] Error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

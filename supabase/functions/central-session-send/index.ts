// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Authentication required", code: "AUTH_REQUIRED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error", code: "CONFIG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    
    if (error || !user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Authentication failed", code: "AUTH_FAILED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const body = await req.json()
    const { agentId, message, sessionId, timeoutSeconds = 60 } = body

    if (!message) {
      return new Response(
        JSON.stringify({ ok: false, error: "message required", code: "INVALID_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!sessionId) {
      return new Response(
        JSON.stringify({ ok: false, error: "sessionId required", code: "INVALID_REQUEST" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-session-send] Sending message:', { agentId, sessionId, messageLength: message.length, timeoutSeconds })

    const bridgeUrl = Deno.env.get("OPENCLAW_BRIDGE_URL")
    const bridgeToken = Deno.env.get("OPENCLAW_BRIDGE_TOKEN")
    
    if (!bridgeUrl) {
      return new Response(
        JSON.stringify({ ok: false, error: "Server configuration error - missing bridge URL", code: "CONFIG_ERROR" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const endpoint = `${bridgeUrl.replace(/\/$/, "")}/api/v1/sessions/${encodeURIComponent(sessionId)}/message`
    
    console.log('[central-session-send] Calling bridge-api:', endpoint)

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }
    if (bridgeToken) {
      headers["Authorization"] = `Bearer ${bridgeToken}`
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: message,
        agentId: agentId || "main"
      })
    })

    const data = await response.json()
    console.log('[central-session-send] Response:', { status: response.status, ok: data?.ok })

    if (!response.ok || !data.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: data.error || "Bridge-api request failed",
          code: data.code || "BRIDGE_ERROR",
          upstreamStatus: response.status
        }),
        { status: response.ok ? 400 : response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(JSON.stringify({
      ok: true,
      sessionId: sessionId,
      agentId,
      response: data.text || data.summary || "No response",
      runId: data.runId,
      raw: data
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    console.error('[central-session-send] Error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

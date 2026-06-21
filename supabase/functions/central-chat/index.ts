// @ts-nocheck
// OpenClaw Chat - Uses bridge-api for agent communication
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    
    if (error || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const body = await req.json()
    const { agentId, message, sessionId, history = [] } = body

    if (!agentId || !message) {
      return new Response(
        JSON.stringify({ error: "agentId and message required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const bridgeUrl = Deno.env.get("OPENCLAW_BRIDGE_URL")
    const bridgeToken = Deno.env.get("OPENCLAW_BRIDGE_TOKEN")
    
    if (!bridgeUrl) {
      return new Response(
        JSON.stringify({ error: "Server configuration error - missing bridge URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Build the full message with history context
    const fullMessage = history.length > 0 
      ? `Previous context:\n${history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}\n\nCurrent message: ${message}`
      : message

    const baseUrl = bridgeUrl.replace(/\/$/, "")
    
    // If we have a sessionId, send message to session
    // Otherwise, spawn a new agent
    const isNewSession = !sessionId
    const endpoint = isNewSession 
      ? `${baseUrl}/api/v1/agents/${encodeURIComponent(agentId)}/spawn`
      : `${baseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/message`
    
    const payload = isNewSession
      ? { task: fullMessage }
      : { message: fullMessage, agentId }
    
    console.log(`[chat] Calling bridge-api:`, { endpoint, isNewSession, messageLength: message.length })

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }
    if (bridgeToken) {
      headers["Authorization"] = `Bearer ${bridgeToken}`
    }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    })

    console.log('[chat] Bridge-api response status:', resp.status)

    const data = await resp.json()

    if (!resp.ok || !data.ok) {
      return new Response(
        JSON.stringify({ 
          error: data.error || "Bridge-api request failed", 
          upstreamStatus: resp.status,
          details: data
        }),
        { status: resp.ok ? 400 : resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[chat] Success:', { sessionId: data.sessionId, hasText: !!data.text })

    return new Response(JSON.stringify({
      ok: true,
      response: data.text || data.summary || "No response",
      sessionId: data.sessionId || sessionId,
      runId: data.runId,
      raw: data
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err) {
    console.error('[chat] Error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log('[central-agent-spawn] Function called')
    console.log('[central-agent-spawn] Method:', req.method)

    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

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
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-agent-spawn] Authenticated user ID:', user.id)

    const body = await req.json()
    const { agentId, task, timeoutSeconds = 300 } = body

    console.log('[central-agent-spawn] User spawning agent:', agentId)

    if (!agentId || typeof agentId !== "string" || agentId.trim() === "") {
      return new Response(
        JSON.stringify({ error: "agentId is required and must be a non-empty string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const bridgeUrl = Deno.env.get("OPENCLAW_BRIDGE_URL")
    const bridgeToken = Deno.env.get("OPENCLAW_BRIDGE_TOKEN")
    
    if (!bridgeUrl) {
      console.log('[central-agent-spawn] Missing OPENCLAW_BRIDGE_URL')
      return new Response(
        JSON.stringify({ error: "Server configuration error - missing bridge URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const spawnUrl = `${bridgeUrl.replace(/\/$/, "")}/api/v1/agents/${encodeURIComponent(agentId.trim())}/spawn`

    console.log('[central-agent-spawn] Calling bridge-api:', { spawnUrl, taskLength: task?.length || 0 })

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }
    if (bridgeToken) {
      headers["Authorization"] = `Bearer ${bridgeToken}`
    }

    const response = await fetch(spawnUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        task: task?.trim() || "Initialize agent"
      })
    })

    const data = await response.json()
    console.log('[central-agent-spawn] Bridge-api response:', JSON.stringify(data, null, 2))

    if (!response.ok || !data.ok) {
      return new Response(JSON.stringify({
        error: data.error || "Bridge-api request failed",
        upstreamStatus: response.status,
        raw: data
      }), {
        status: response.ok ? 400 : response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    return new Response(JSON.stringify({
      ok: true,
      sessionId: data.sessionId || null,
      agentId: agentId,
      text: data.text,
      runId: data.runId,
      result: data
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err) {
    console.error('[central-agent-spawn] Error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

// @ts-nocheck
import "https://esm.sh/@supabase/functions-js@2"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { supabaseRest } from "../_shared/supabase.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log('[central-agent-list] Function called')
    console.log('[central-agent-list] Method:', req.method)

    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[central-agent-list] Missing or invalid Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    if (!token) {
      console.log('[central-agent-list] No token in Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      console.log('[central-agent-list] Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      console.log('[central-agent-list] Invalid JWT token')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-agent-list] Authenticated user ID:', user.id)

    // Get all agents from database first
    const dbResponse = await supabaseRest("/central_agents?select=runtime_id,canonical_id,display_name,section,parent_runtime_id,role,visibility,managed_by,is_system,is_archived,vps_sync_status,model_key,created_at,updated_at")
    if (!dbResponse.ok) {
      const errorText = await dbResponse.text().catch(() => "")
      throw new Error(`Failed to load Central Command agents: ${dbResponse.status} ${errorText}`)
    }

    const dbAgents = await dbResponse.json()
    console.log('[central-agent-list] DB agents count:', dbAgents?.length || 0)

    // Try to get VPS agents via bridge-api (optional - don't fail if VPS is down)
    let vpsAgents = []
    const bridgeUrl = Deno.env.get("OPENCLAW_BRIDGE_URL")
    const bridgeToken = Deno.env.get("OPENCLAW_BRIDGE_TOKEN")
    
    if (bridgeUrl) {
      try {
        console.log('[central-agent-list] Fetching upstream API via bridge...')
        const agentsUrl = `${bridgeUrl.replace(/\/$/, "")}/agents`
        
        const headers: Record<string, string> = {}
        if (bridgeToken) {
          headers["Authorization"] = `Bearer ${bridgeToken}`
        }
        
        const upstream = await fetch(agentsUrl, {
          method: "GET",
          headers,
        })

        if (upstream.ok) {
          const data = await upstream.json()
          vpsAgents = data.agents ?? []
          console.log('[central-agent-list] VPS agents count:', vpsAgents.length)
        } else {
          console.log('[central-agent-list] VPS fetch failed:', upstream.status)
        }
      } catch (vpsError) {
        console.log('[central-agent-list] VPS error:', vpsError.message)
      }
    }

    // Create VPS agent map
    const vpsMap = new Map()
    for (const agent of vpsAgents) {
      const runtimeId = (agent.runtime_id || agent.id || "").toString().trim()
      if (runtimeId) {
        vpsMap.set(runtimeId, agent)
      }
    }

    // Merge: Start with DB agents, add VPS data if available
    const mergedAgents = dbAgents
      .filter((dbAgent) => dbAgent.is_archived !== true)
      .map((dbAgent) => {
        const runtimeId = dbAgent.runtime_id?.trim()
        const vpsAgent = vpsMap.get(runtimeId)

        return {
          ...vpsAgent, // VPS data as base (if exists)
          runtime_id: runtimeId,
          canonical_id: dbAgent.canonical_id ?? vpsAgent?.canonical_id ?? runtimeId,
          display_name: dbAgent.display_name ?? vpsAgent?.display_name ?? runtimeId,
          section: dbAgent.section ?? vpsAgent?.section,
          parent: dbAgent.parent_runtime_id ?? vpsAgent?.parent ?? vpsAgent?.parent_agent_id ?? null,
          role: dbAgent.role ?? vpsAgent?.role,
          visibility: dbAgent.visibility ?? vpsAgent?.visibility,
          managed_by: dbAgent.managed_by ?? vpsAgent?.metadata?.managed_by ?? 'central-command',
          is_system: dbAgent.is_system ?? vpsAgent?.metadata?.kind === "system" ?? false,
          is_archived: dbAgent.is_archived ?? false,
          vps_sync_status: dbAgent.vps_sync_status ?? (vpsAgent ? 'synced' : 'pending'),
          model_key: dbAgent.model_key ?? vpsAgent?.model_key,
          created_at: dbAgent.created_at,
          updated_at: dbAgent.updated_at
        }
      })

    console.log('[central-agent-list] Merged agents count:', mergedAgents.length)

    return new Response(
      JSON.stringify({
        agents: mergedAgents,
        count: mergedAgents.length,
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
    console.error('[central-agent-list] Error:', err)
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

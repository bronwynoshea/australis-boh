// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, handleCors } from "../_shared/cors.ts"

interface AgentConfig {
  runtime_id: string
  display_name: string
  section: string
  parent_runtime_id?: string
  role?: string
  model_key?: string
  visibility: string
  metadata: Record<string, any>
  github_branch_name?: string
  workspace_path?: string
  file_generation_options: Record<string, any>
  vps_config_version?: number
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log('[central-agent-vps-sync] Function called')
    console.log('[central-agent-vps-sync] Method:', req.method)

    // Custom JWT validation - don't rely on legacy Supabase JWT verification
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[central-agent-vps-sync] Missing or invalid Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    if (!token) {
      console.log('[central-agent-vps-sync] No token in Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate JWT with Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      console.log('[central-agent-vps-sync] Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      console.log('[central-agent-vps-sync] Invalid JWT token')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-agent-vps-sync] Authenticated user ID:', user.id)

    // Check admin allowlist if configured
    const adminEmails = Deno.env.get("CENTRAL_ADMIN_EMAILS")
    if (adminEmails) {
      const allowedEmails = adminEmails.split(",").map(e => e.trim().toLowerCase())
      if (!allowedEmails.includes(user.email!.toLowerCase())) {
        console.log('[central-agent-vps-sync] User not in admin allowlist')
        return new Response(
          JSON.stringify({ error: "Forbidden: VPS sync requires admin privileges" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    // Get Cloudflare Access credentials for OpenClaw API
    const gatewayToken = Deno.env.get("OPENCLAW_GATEWAY_API")
    
    
    if (!clientId || !clientSecret) {
      console.log('[central-agent-vps-sync] Missing Cloudflare credentials')
      return new Response(
        JSON.stringify({ error: "Server configuration error - missing Cloudflare credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Create Supabase client with user context for RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SB_PUBLISHABLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! }
        }
      }
    )

    // Get agents pending VPS sync
    const { data: pendingAgents, error: fetchError } = await supabaseClient
      .from('central_agents_pending_vps_sync')
      .select('*')

    if (fetchError) {
      console.error('Error fetching pending agents:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending agents' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!pendingAgents || pendingAgents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No agents pending sync' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const results = []

    for (const agent of pendingAgents) {
      try {
        // Generate agent configuration file content
        const configContent = generateAgentConfig(agent)
        
        // Write agent config to OpenClaw via the gateway API
        // We use the gateway config endpoint to add/update the agent
        const vpsResult = await syncAgentToOpenClaw(agent, configContent, clientId, clientSecret)
        
        if (!vpsResult.success) {
          throw new Error(vpsResult.error || "Failed to sync agent to OpenClaw")
        }
        
        // Mark sync as completed in Supabase
        const { error: updateError } = await supabaseClient
          .from('central_agents')
          .update({
            vps_sync_status: 'synced',
            vps_synced_at: new Date().toISOString(),
            vps_config_version: (agent.vps_config_version || 0) + 1,
            vps_file_path: vpsResult.filePath
          })
          .eq('runtime_id', agent.runtime_id)

        if (updateError) {
          throw updateError
        }

        results.push({
          runtime_id: agent.runtime_id,
          status: 'success',
          vps_file_path: vpsResult.filePath,
          message: vpsResult.message
        })

      } catch (error) {
        console.error(`Failed to sync agent ${agent.runtime_id}:`, error)
        
        // Mark sync as failed
        await supabaseClient
          .from('central_agents')
          .update({
            vps_sync_status: 'failed',
            vps_last_error: error.message
          })
          .eq('runtime_id', agent.runtime_id)

        results.push({
          runtime_id: agent.runtime_id,
          status: 'failed',
          error: error.message
        })
      }
    }

    const allSucceeded = results.every(r => r.status === 'success')
    
    return new Response(
      JSON.stringify({ 
        message: allSucceeded ? 'VPS sync completed successfully' : 'VPS sync completed with errors',
        results 
      }),
      { 
        status: allSucceeded ? 200 : 207,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    )

  } catch (error) {
    console.error('[central-agent-vps-sync] Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
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

function generateAgentConfig(agent: AgentConfig): string {
  const config = {
    agent: {
      id: agent.runtime_id,
      name: agent.display_name,
      section: agent.section,
      parent: agent.parent_runtime_id,
      role: agent.role,
      model: agent.model_key,
      visibility: agent.visibility,
      metadata: agent.metadata,
      github: {
        branch: agent.github_branch_name,
        workspace: agent.workspace_path
      },
      file_generation: agent.file_generation_options
    },
    version: (agent.vps_config_version || 0) + 1,
    deployed_at: new Date().toISOString()
  }

  return JSON.stringify(config, null, 2)
}

async function syncAgentToOpenClaw(
  agent: AgentConfig, 
  configContent: string, 
  clientId: string, 
  clientSecret: string
): Promise<{ success: boolean; filePath?: string; message?: string; error?: string }> {
  
  const vpsFilePath = `/opt/openclaw/agents/${agent.runtime_id}.json`
  
  try {
    // Strategy: Use the OpenClaw gateway config API to update agent configuration
    // This requires the gateway to have config.apply or config.patch enabled
    
    console.log(`[VPS Sync] Syncing agent ${agent.runtime_id} to OpenClaw`)
    
    // First, try to use the config.patch endpoint via tools/invoke
    // This applies a partial config update to the gateway
    const configUrl = `https://orbit.jobzcafe.cloud/tools/invoke`
    
    // Build the agent configuration for OpenClaw
    const agentConfig = {
      agents: {
        [agent.runtime_id]: {
          name: agent.display_name,
          model: agent.model_key || "openai/gpt-5.2-codex",
          role: agent.role,
          // Add any other agent-specific config
        }
      }
    }
    
    const response = await fetch(configUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gatewayToken}`,
        // Token in Authorization header above
      },
      body: JSON.stringify({
        tool: "gateway",
        action: "config.patch",
        args: {
          patch: agentConfig
        }
      })
    })

    const responseText = await response.text()
    let data
    
    try {
      data = JSON.parse(responseText)
    } catch {
      data = { rawText: responseText }
    }

    if (!response.ok) {
      console.error(`[VPS Sync] Config patch failed:`, { status: response.status, data })
      
      // If config.patch is not available, fall back to writing a file
      // This requires the OpenClaw workspace to be accessible
      return await writeAgentFileFallback(agent, configContent, clientId, clientSecret)
    }

    console.log(`[VPS Sync] Successfully synced agent ${agent.runtime_id}`)
    
    return {
      success: true,
      filePath: vpsFilePath,
      message: "Agent configuration updated via gateway config API"
    }
    
  } catch (error) {
    console.error(`[VPS Sync] Error syncing agent ${agent.runtime_id}:`, error)
    
    // Try fallback method
    return await writeAgentFileFallback(agent, configContent, clientId, clientSecret)
  }
}

async function writeAgentFileFallback(
  agent: AgentConfig, 
  configContent: string, 
  clientId: string, 
  clientSecret: string
): Promise<{ success: boolean; filePath?: string; message?: string; error?: string }> {
  
  // Fallback: Try to use exec to write the file
  // Note: This may not work depending on gateway sandbox settings
  
  const vpsFilePath = `/opt/openclaw/agents/${agent.runtime_id}.json`
  
  console.log(`[VPS Sync] Attempting fallback file write for ${agent.runtime_id}`)
  
  try {
    const execUrl = `https://orbit.jobzcafe.cloud/tools/invoke`
    
    // Escape the config content for shell
    const escapedContent = configContent
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
    
    const response = await fetch(execUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gatewayToken}`,
        // Token in Authorization header above
      },
      body: JSON.stringify({
        tool: "exec",
        args: {
          command: `mkdir -p /opt/openclaw/agents && echo "${escapedContent}" > ${vpsFilePath} && cat ${vpsFilePath}`,
          timeout: 10
        }
      })
    })

    const responseText = await response.text()
    let data
    
    try {
      data = JSON.parse(responseText)
    } catch {
      data = { rawText: responseText }
    }

    // Check tools/invoke response format
    if (data?.ok === false || !response.ok) {
      console.error(`[VPS Sync] Fallback write failed:`, { status: response.status, data })
      return {
        success: false,
        error: data?.error?.message || `Failed to write agent file: ${response.status}`
      }
    }

    console.log(`[VPS Sync] Successfully wrote agent file ${vpsFilePath}`)
    
    return {
      success: true,
      filePath: vpsFilePath,
      message: "Agent configuration written via exec fallback"
    }
    
  } catch (error) {
    console.error(`[VPS Sync] Fallback error:`, error)
    return {
      success: false,
      error: `Both primary and fallback sync methods failed: ${error.message}`
    }
  }
}

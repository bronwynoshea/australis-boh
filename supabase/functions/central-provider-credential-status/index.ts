// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"

const ADMIN_EMAIL_ALLOWLIST = (Deno.env.get("CENTRAL_ADMIN_EMAILS") || "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean)

interface ProviderCredentialStatus {
  provider_id: string
  configured: boolean
  activated?: boolean
  requires_restart?: boolean
  last_updated?: string
  status?: 'configured' | 'missing' | 'failing' | 'configured_pending_restart'
  error?: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    if (req.method !== "GET") {
      return new Response(
        JSON.stringify({ error: "Only GET is allowed" }),
        { status: 405, headers: corsHeaders }
      )
    }

    const authHeader = req.headers.get("Authorization") || ""
    const [, token] = authHeader.split(" ")
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing bearer token" }),
        { status: 401, headers: corsHeaders }
      )
    }

    const user = await getSupabaseUser(token)
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: corsHeaders }
      )
    }

    const lowerEmail = (user.email || "").toLowerCase()
    if (!ADMIN_EMAIL_ALLOWLIST.includes(lowerEmail)) {
      return new Response(
        JSON.stringify({ error: "You are not authorized to view provider credentials" }),
        { status: 403, headers: corsHeaders }
      )
    }

    // Query bridge API for provider credential status
    const gatewayToken = Deno.env.get("OPENCLAW_GATEWAY_API")
    

    if (!clientId || !clientSecret) {
      console.error("[central-provider-credential-status] Missing bridge credentials")
      return new Response(
        JSON.stringify({ error: "Bridge service not configured" }),
        { status: 503, headers: corsHeaders }
      )
    }

    const bridgeUrl = "https://orbit.jobzcafe.cloud/api/v1/providers/credentials/status"
    
    try {
      const bridgeResponse = await fetch(bridgeUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${gatewayToken}`,
          // Token in Authorization header above
        }
      })

      if (!bridgeResponse.ok) {
        const errorText = await bridgeResponse.text().catch(() => "Unknown bridge error")
        console.error("[central-provider-credential-status] Bridge error", {
          status: bridgeResponse.status,
          error: errorText
        })
        return new Response(
          JSON.stringify({ 
            error: "Failed to fetch credential status",
            details: `Bridge service returned ${bridgeResponse.status}`
          }),
          { status: 502, headers: corsHeaders }
        )
      }

      const bridgeData = await bridgeResponse.json()
      
      // Transform bridge response to our expected format
      const providerStatuses: ProviderCredentialStatus[] = (bridgeData.providers || []).map((provider: any) => ({
        provider_id: provider.provider_id,
        configured: provider.configured || false,
        activated: provider.activated || false,
        requires_restart: provider.requires_restart || false,
        last_updated: provider.last_updated,
        status: provider.requires_restart ? 'configured_pending_restart' : 
                provider.configured ? 'configured' : 'missing',
        error: provider.error
      }))

      console.log("[central-provider-credential-status] Status fetched successfully", {
        count: providerStatuses.length,
        requestedBy: user.email,
        timestamp: new Date().toISOString()
      })

      return new Response(JSON.stringify({
        providers: providerStatuses,
        count: providerStatuses.length,
        updated_at: new Date().toISOString()
      }), {
        status: 200,
        headers: corsHeaders
      })
    } catch (bridgeError) {
      console.error("[central-provider-credential-status] Bridge connection failed", bridgeError)
      return new Response(
        JSON.stringify({ 
          error: "Secure vault unavailable",
          details: "Failed to connect to credential storage service"
        }),
        { status: 503, headers: corsHeaders }
      )
    }
  } catch (error) {
    console.error("[central-provider-credential-status] Unexpected error", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    )
  }
})

async function getSupabaseUser(accessToken: string) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
  const SUPABASE_SECRET_KEY = Deno.env.get("SB_SECRET_KEY")
  
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error("[getSupabaseUser] Missing Supabase configuration")
    return null
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "apikey": SUPABASE_SECRET_KEY
      }
    })

    if (!response.ok) {
      console.error("[getSupabaseUser] Failed to validate token", response.status)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("[getSupabaseUser] Error validating user", error)
    return null
  }
}

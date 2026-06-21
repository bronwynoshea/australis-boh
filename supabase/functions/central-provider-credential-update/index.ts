// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"

const ADMIN_EMAIL_ALLOWLIST = (Deno.env.get("CENTRAL_ADMIN_EMAILS") || "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean)

interface ProviderCredentialPayload {
  provider_id?: string
  credential?: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST is allowed" }),
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
        JSON.stringify({ error: "You are not authorized to update provider credentials" }),
        { status: 403, headers: corsHeaders }
      )
    }

    const payload = await req.json().catch(() => null) as ProviderCredentialPayload | null
    if (!payload || typeof payload !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const providerId = typeof payload.provider_id === "string" ? payload.provider_id.trim() : ""
    const credential = typeof payload.credential === "string" ? payload.credential.trim() : ""

    if (!providerId) {
      return new Response(
        JSON.stringify({ error: "provider_id is required" }),
        { status: 400, headers: corsHeaders }
      )
    }

    if (!credential) {
      return new Response(
        JSON.stringify({ error: "credential is required" }),
        { status: 400, headers: corsHeaders }
      )
    }

    // Wire to OpenClaw bridge secure runtime credential vault
    // NOTE: After successful storage, OpenClaw service requires manual restart to pick up new credentials
    // No automatic reload mechanism exists in the current bridge API
    const gatewayToken = Deno.env.get("OPENCLAW_GATEWAY_API")
    

    if (!clientId || !clientSecret) {
      console.error("[central-provider-credential-update] Missing bridge credentials")
      return new Response(
        JSON.stringify({ error: "Bridge service not configured" }),
        { status: 503, headers: corsHeaders }
      )
    }

    const bridgeUrl = `https://orbit.jobzcafe.cloud/api/v1/providers/${encodeURIComponent(providerId)}/credentials`
    
    try {
      const bridgeResponse = await fetch(bridgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${gatewayToken}`,
          // Token in Authorization header above
        },
        body: JSON.stringify({
          provider_id: providerId,
          credential: credential,
          updated_by: user.email,
          timestamp: new Date().toISOString()
        })
      })

      if (!bridgeResponse.ok) {
        const errorText = await bridgeResponse.text().catch(() => "Unknown bridge error")
        console.error("[central-provider-credential-update] Bridge error", {
          status: bridgeResponse.status,
          error: errorText,
          providerId
        })
        return new Response(
          JSON.stringify({ 
            error: "Failed to store credential in secure vault",
            details: `Bridge service returned ${bridgeResponse.status}`
          }),
          { status: 502, headers: corsHeaders }
        )
      }

      console.log("[central-provider-credential-update] Credential stored successfully", {
        providerId,
        submittedBy: user.email,
        timestamp: new Date().toISOString()
      })

      const responseBody = {
        status: "configured_pending_restart",
        provider_id: providerId,
        configured: true,
        activated: false,
        requires_restart: true,
        updated_at: new Date().toISOString(),
        message: "Credential securely stored in runtime vault. Service restart required for activation."
      }

      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: corsHeaders
      })
    } catch (bridgeError) {
      console.error("[central-provider-credential-update] Bridge connection failed", bridgeError)
      return new Response(
        JSON.stringify({ 
          error: "Secure vault unavailable",
          details: "Failed to connect to credential storage service"
        }),
        { status: 503, headers: corsHeaders }
      )
    }
  } catch (error) {
    console.error("[central-provider-credential-update] Unexpected error", error)
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

// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseKey = Deno.env.get("SB_SECRET_KEY")
  const gatewayToken = Deno.env.get("OPENCLAW_GATEWAY_API")

  const healthReport = {
    timestamp: new Date().toISOString(),
    status: "healthy",
    supabase: {
      configured: !!(supabaseUrl && supabaseKey),
      url: supabaseUrl ? "CONFIGURED" : "MISSING"
    },
    gateway: {
      configured: !!gatewayToken,
      token: gatewayToken ? "CONFIGURED" : "MISSING",
      status: "unknown"
    }
  }

  if (gatewayToken) {
    try {
      const response = await fetch("https://orbit.jobzcafe.cloud/health", {
        headers: {
          "Authorization": `Bearer ${gatewayToken}`
        }
      })
      healthReport.gateway.status = response.ok ? "healthy" : "unhealthy"
    } catch (error) {
      healthReport.gateway.status = "error"
    }
  } else {
    healthReport.gateway.status = "unconfigured"
  }

  return new Response(
    JSON.stringify({ health: healthReport }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }}
  )
})

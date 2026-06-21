// @ts-nocheck
import "@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders, handleCors } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface TokenUsageRecord {
  runtime_id?: string
  provider: string
  model_key: string
  provider_model_id: string
  input_tokens: number
  output_tokens: number
  source?: string
  notes?: string
}

interface TokenUsageResponse {
  status: string
  record?: any
  error?: string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    console.log('[central-token-usage] Function called')
    console.log('[central-token-usage] Method:', req.method)

    // Custom JWT validation - don't rely on legacy Supabase JWT verification
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log('[central-token-usage] Missing or invalid Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const [, token] = authHeader.split(" ")
    if (!token) {
      console.log('[central-token-usage] No token in Authorization header')
      return new Response(
        JSON.stringify({ error: "Unauthorized: No token provided" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validate JWT with Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseSecretKey = Deno.env.get("SB_SECRET_KEY")
    
    if (!supabaseUrl || !supabaseSecretKey) {
      console.log('[central-token-usage] Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      console.log('[central-token-usage] Invalid JWT token')
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('[central-token-usage] Authenticated user ID:', user.id)

    // Optional: Check admin allowlist for token usage operations (sensitive data)
    const adminEmails = Deno.env.get("CENTRAL_ADMIN_EMAILS")
    if (adminEmails) {
      const allowedEmails = adminEmails.split(",").map(e => e.trim().toLowerCase())
      if (!allowedEmails.includes(user.email!.toLowerCase())) {
        console.log('[central-token-usage] User not in admin allowlist')
        return new Response(
          JSON.stringify({ error: "Forbidden: Token usage operations require admin privileges" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    const method = req.method

    if (method === "POST") {
      return await handlePost(req)
    } else if (method === "GET") {
      return await handleGet(req)
    } else {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: corsHeaders }
      )
    }
  } catch (error) {
    console.error("[central-token-usage] Token usage error:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      }),
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

async function handlePost(req: Request): Promise<Response> {
  const body = await req.json() as TokenUsageRecord

  // Validate required fields
  if (!body.provider || typeof body.provider !== "string") {
    return new Response(
      JSON.stringify({ error: "provider is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (!body.model_key || typeof body.model_key !== "string") {
    return new Response(
      JSON.stringify({ error: "model_key is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (!body.provider_model_id || typeof body.provider_model_id !== "string") {
    return new Response(
      JSON.stringify({ error: "provider_model_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (typeof body.input_tokens !== "number" || body.input_tokens < 0) {
    return new Response(
      JSON.stringify({ error: "input_tokens must be a non-negative number" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  if (typeof body.output_tokens !== "number" || body.output_tokens < 0) {
    return new Response(
      JSON.stringify({ error: "output_tokens must be a non-negative number" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  // Prepare payload for database
  const payload: Record<string, unknown> = {
    runtime_id: body.runtime_id || null,
    provider: body.provider.trim(),
    model_key: body.model_key.trim(),
    provider_model_id: body.provider_model_id.trim(),
    input_tokens: Math.floor(body.input_tokens),
    output_tokens: Math.floor(body.output_tokens),
    source: body.source || 'agent_chat',
    notes: body.notes || null
  }

  // Use service role to bypass RLS
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SB_SECRET_KEY")!

  const response = await fetch(`${supabaseUrl}/rest/v1/central_token_usage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Prefer": "return=representation"
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    console.error("Failed to persist token usage:", response.status, errorText)
    return new Response(
      JSON.stringify({
        error: "Failed to persist token usage",
        upstreamStatus: response.status,
        upstreamBody: errorText
      }),
      { status: 502, headers: corsHeaders }
    )
  }

  const rows = await response.json().catch(() => [])
  const saved = Array.isArray(rows) && rows.length > 0 ? rows[0] : payload

  const responseData: TokenUsageResponse = {
    status: "recorded",
    record: saved
  }

  return new Response(JSON.stringify(responseData), {
    status: 201,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  })
}

async function handleGet(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const modelKey = url.searchParams.get("model_key")
  const runtimeId = url.searchParams.get("runtime_id")
  const provider = url.searchParams.get("provider")
  const limit = parseInt(url.searchParams.get("limit") || "100")
  const offset = parseInt(url.searchParams.get("offset") || "0")

  // Build query
  let selectQuery = "/central_token_usage?select=*,central_models!inner(display_name,provider,provider_model_id,input_price_per_1m_tokens,output_price_per_1m_tokens,currency)"
  let queryParams: string[] = []

  // Add filters
  if (modelKey) {
    queryParams.push(`model_key=eq.${encodeURIComponent(modelKey)}`)
  }
  if (runtimeId) {
    queryParams.push(`runtime_id=eq.${encodeURIComponent(runtimeId)}`)
  }
  if (provider) {
    queryParams.push(`provider=eq.${encodeURIComponent(provider)}`)
  }

  // Add ordering and pagination
  queryParams.push("order=occurred_at.desc")
  queryParams.push(`limit=${limit}`)
  queryParams.push(`offset=${offset}`)

  if (queryParams.length > 0) {
    selectQuery += "&" + queryParams.join("&")
  }

  // Use service role to bypass RLS
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SB_SECRET_KEY")!

  const response = await fetch(`${supabaseUrl}/rest/v1${selectQuery}`, {
    method: "GET",
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`
    }
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(`Failed to fetch token usage: ${response.status} ${errorText}`)
  }

  const usageRecords = await response.json().catch(() => [])

  // Get total count for pagination
  let countQuery = "/central_token_usage?count=exact&head=true"
  if (queryParams.length > 0) {
    // Remove order/limit/offset for count
    const countParams = queryParams.filter(p => !p.startsWith("order=") && !p.startsWith("limit=") && !p.startsWith("offset="))
    if (countParams.length > 0) {
      countQuery += "&" + countParams.join("&")
    }
  }

  const countResponse = await fetch(`${supabaseUrl}/rest/v1${countQuery}`, {
    method: "HEAD",
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`
    }
  })

  const totalCount = parseInt(countResponse.headers.get("content-range")?.split("/")[1] || "0")

  return new Response(JSON.stringify({
    records: usageRecords,
    count: usageRecords.length,
    total_count: totalCount,
    limit,
    offset
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  })
}

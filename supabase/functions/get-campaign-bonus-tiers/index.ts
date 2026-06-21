// supabase/functions/get-campaign-bonus-tiers/index.ts
// @ts-nocheck  // this runs in Deno's Edge runtime

import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",   // BOH / internal
  "http://localhost:3001",   // marketing site local
  "https://boh.jobzcafe.com",
  "https://jobzcafe.com",
  "https://www.jobzcafe.com",
];

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    // CORS preflight
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // JWT Authentication check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized - Missing Authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SB_PUBLISHABLE_KEY");
  const secretKey = Deno.env.get("SB_SECRET_KEY");

  if (!supabaseUrl || !publishableKey || !secretKey) {
    console.error("[get-campaign-bonus-tiers] Missing env vars");
    return new Response(
      JSON.stringify({ error: "Server misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Validate JWT token
  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await authClient.auth.getUser();

  if (authError || !user) {
    console.error("[get-campaign-bonus-tiers] Unauthorized:", authError);
    return new Response(
      JSON.stringify({ error: "Unauthorized - Invalid or expired token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response(
      JSON.stringify({ error: "Missing required query parameter: slug" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const client = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  try {
    // 1. Find the active campaign by slug
    const { data: campaign, error: campaignError } = await client
      .from("boh_campaign_banner")
      .select("id, slug, status")
      .eq("slug", slug)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (campaignError) {
      console.error("[get-campaign-bonus-tiers] Campaign lookup error", campaignError);
      return new Response(
        JSON.stringify([]),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!campaign) {
      // No active campaign for this slug 
      return new Response(
        JSON.stringify([]),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Load tiers for this campaign
    const { data: tiers, error: tiersError } = await client
      .from("boh_campaign_bonus_tier")
      .select("label, bonus_percent, day_date, queue_boost_weight")
      .eq("campaign_id", campaign.id)
      .order("day_date", { ascending: true });

    if (tiersError) {
      console.error("[get-campaign-bonus-tiers] Tier lookup error", tiersError);
      return new Response(
        JSON.stringify([]),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Return ONLY the array of tiers (or empty array) so the frontend can use Array.isArray()
    return new Response(
      JSON.stringify(tiers ?? []),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[get-campaign-bonus-tiers] Unexpected error", err);
    return new Response(
      JSON.stringify({ error: "Unexpected server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

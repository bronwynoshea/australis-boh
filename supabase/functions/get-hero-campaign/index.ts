// supabase/functions/get-hero-campaign/index.ts
// @ts-nocheck
//
// Edge Function to return the active marketing hero campaign banner
// for a given location (default: 'sunset-hero') from the BOH database.
//
// REFACTORED: Uses shared auth, CORS, and response helpers
// SECURITY: Uses shared requireUser helper for JWT validation

import { requireUser } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, successResponse, errorResponse } from "../_shared/responses.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const location = url.searchParams.get("location") ?? "sunset-hero";

    // Authenticate user (shared helper)
    const auth = await requireUser(req);
    if (!auth.success) {
      console.error("[get-hero-campaign] Auth failed:", auth.error);
      return jsonResponse(req, { error: auth.error }, auth.status);
    }

    const { serviceClient: supabase } = auth;

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("boh_campaign_banner")
      .select("headline, body, status, starts_at, ends_at, location")
      .eq("location", location)
      .eq("location", "sunset-hero")
      .eq("status", "active")
      .lte("starts_at", nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .maybeSingle();

    if (error || !data) {
      return successResponse(req, { enabled: false });
    }

    return successResponse(req, {
      enabled: true,
      headline: data.headline ?? null,
      body: data.body ?? null,
      endsAt: data.ends_at ?? null,
    });
  } catch (err) {
    console.error("[get-hero-campaign] Unexpected error", err);
    return errorResponse(req, "Unexpected error", 500);
  }
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req.headers.get("origin")) });
  }

  if (req.method !== "POST") {
    return json(req, { error: "method_not_allowed" }, 405);
  }

  try {
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      // Ignore JSON parse errors; body remains null
    }

    // Log the payload safely
    console.log("[loft-daily-join-hook] Received webhook", {
      timestamp: new Date().toISOString(),
      body: body ? JSON.stringify(body).slice(0, 500) : null,
    });

    return json(req, { ok: true }, 200);
  } catch (error) {
    console.error("[loft-daily-join-hook] Unexpected error:", error);
    return json(req, { ok: true }, 200);
  }
});

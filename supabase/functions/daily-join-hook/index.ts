import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildCorsHeaders, handleCors, jsonResponse } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const cors = handleCors(req, { allowMethods: ["POST", "OPTIONS"] });
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "method_not_allowed" }, 405, { allowMethods: ["POST", "OPTIONS"] });
  }

  try {
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      // Daily may send an empty or non-JSON probe; treat it as accepted.
    }

    console.log("[daily-join-hook] Daily room join webhook", {
      timestamp: new Date().toISOString(),
      userAgent: req.headers.get("user-agent"),
      dailySignaturePresent: req.headers.has("x-daily-signature"),
      bodyPreview: body ? JSON.stringify(body).slice(0, 1000) : null,
    });

    return jsonResponse(req, { ok: true }, 200, { allowMethods: ["POST", "OPTIONS"] });
  } catch (error) {
    console.error("[daily-join-hook] Unexpected error", error);
    // Return 200 so Daily does not retry/spam on logging failures.
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        ...buildCorsHeaders(req, { allowMethods: ["POST", "OPTIONS"] }),
        "Content-Type": "application/json",
      },
    });
  }
});

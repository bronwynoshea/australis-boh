import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { validateJwt } from "../_shared/auth.ts";

const HANDOFF_TYPE = "CELLAR_BOH_EMBED_HANDOFF";

function getEnvVars() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SB_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceKey =
    Deno.env.get("SB_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SERVICE_ROLE_KEY");

  if (!supabaseUrl || !publishableKey || !serviceKey) return null;
  return { supabaseUrl, publishableKey, serviceKey };
}

Deno.serve(async (request) => {
  const cors = handleCors(request, { allowMethods: ["POST", "OPTIONS"] });
  if (cors) return cors;

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "CELLAR_METHOD_NOT_ALLOWED" }, 405);
  }

  const env = getEnvVars();
  if (!env) {
    return jsonResponse(request, { error: "CELLAR_BOH_SERVICE_CONFIG_MISSING" }, 500);
  }

  const { user, error: authError } = await validateJwt(
    request,
    env.supabaseUrl,
    env.publishableKey,
  );
  if (authError || !user?.id) {
    return jsonResponse(request, { error: "CELLAR_BOH_AUTH_REQUIRED" }, 401);
  }

  const serviceClient = createClient(env.supabaseUrl, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: bohUser, error: bohUserError } = await serviceClient
    .from("boh_user")
    .select("id, email, status, app_context")
    .eq("auth_user_id", user.id)
    .eq("app_context", "boh")
    .maybeSingle();

  if (bohUserError) {
    return jsonResponse(request, { error: bohUserError.message }, 400);
  }
  if (!bohUser?.id || bohUser.status === "inactive") {
    return jsonResponse(request, { error: "CELLAR_BOH_STAFF_ACCESS_REQUIRED" }, 403);
  }

  const email = String(bohUser.email ?? user.email ?? "").trim().toLowerCase();
  if (!email) {
    return jsonResponse(request, { error: "CELLAR_BOH_STAFF_EMAIL_REQUIRED" }, 400);
  }

  const { data: linkData, error: linkError } =
    await serviceClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError) {
    return jsonResponse(request, { error: linkError.message }, 400);
  }

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) {
    return jsonResponse(request, { error: "CELLAR_BOH_HANDOFF_TOKEN_MISSING" }, 500);
  }

  return jsonResponse(request, {
    cellar_boh_embed_handoff: {
      type: HANDOFF_TYPE,
      email,
      token_hash: tokenHash,
      expires_in_seconds: 300,
    },
  });
});

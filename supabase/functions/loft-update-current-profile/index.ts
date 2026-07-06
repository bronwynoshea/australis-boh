/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveBohLoftIdentity } from "../_shared/loftIdentity.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get("origin")) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json(req, { error: "server_not_configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const supabaseAuthed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuthed.auth.getUser();
    if (userError || !user) return json(req, { error: "not_authenticated" }, 401);

    const body = (await req.json().catch(() => ({}))) as { avatarUrl?: string | null; defaultBgId?: string | null };
    const identity = await resolveBohLoftIdentity(supabaseAdmin, user.id);
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ("avatarUrl" in body) updates.avatar_url = typeof body.avatarUrl === "string" && body.avatarUrl.trim() ? body.avatarUrl.trim() : null;
    // There is no canonical BOH replacement for legacy profile.default_bg_id yet.
    // Accept the field to keep old clients harmless while profile is removed.

    if (Object.keys(updates).length > 1) {
      const { error: updateError } = await supabaseAdmin
        .from("boh_user")
        .update(updates)
        .eq("id", identity.bohUserId);
      if (updateError) return json(req, { error: "boh_user_update_failed", details: updateError }, 500);
    }

    return json(req, { success: true });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

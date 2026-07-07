/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveBohLoftIdentity } from "../_shared/loftIdentity.ts";

type Body = {
  loftRoomId?: string;
  loft_room_id?: string;
};

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

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(req, { error: "server_not_configured" }, 500);
    }

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

    if (userError || !user) {
      return json(req, { error: "not_authenticated" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const loftRoomId = String(body.loftRoomId || body.loft_room_id || "").trim();
    if (!loftRoomId) return json(req, { error: "missing_loft_room_id" }, 400);

    const identity = await resolveBohLoftIdentity(supabaseAdmin, user.id);

    const { data: member, error: memberError } = await supabaseAdmin
      .from("loft_room_member")
      .select("role")
      .eq("loft_room_id", loftRoomId)
      .eq("boh_user_id", identity.bohUserId)
      .maybeSingle();

    if (memberError) {
      return json(req, { error: "member_lookup_failed", details: memberError }, 500);
    }

    const role = String(member?.role || "").toLowerCase();
    const isHostish = role === "host" || role === "cohost";
    if (!isHostish) {
      return json(req, { error: "forbidden" }, 403);
    }

    const nowIso = new Date().toISOString();
    const { data: updatedRoom, error: updateError } = await supabaseAdmin
      .from("loft_room")
      .update({ is_open: true, opened_at: nowIso })
      .eq("id", loftRoomId)
      .select("*")
      .maybeSingle();

    if (updateError || !updatedRoom) {
      return json(req, { error: "room_update_failed", details: updateError }, 500);
    }

    return json(req, { room: updatedRoom });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

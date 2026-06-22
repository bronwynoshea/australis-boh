/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profile")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile?.id) {
      return json(req, { error: "profile_not_found" }, 400);
    }

    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("loft_room_member")
      .update({ is_active: false, left_at: nowIso })
      .eq("loft_room_id", loftRoomId)
      .eq("profile_id", profile.id);

    if (updateError) {
      return json(req, { error: "member_update_failed", details: updateError }, 500);
    }

    const { data: room } = await supabaseAdmin
      .from("loft_room")
      .select("id, host_profile_id")
      .eq("id", loftRoomId)
      .maybeSingle();

    if (room?.host_profile_id === profile.id) {
      const { error: waitlistError } = await supabaseAdmin
        .from("loft_room_waitlist")
        .delete()
        .eq("loft_room_id", loftRoomId);

      if (waitlistError) {
        return json(req, { error: "waitlist_clear_failed", details: waitlistError }, 500);
      }
    }

    return json(req, { success: true });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

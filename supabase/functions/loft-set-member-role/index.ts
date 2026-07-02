/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

type Body = {
  loftRoomId?: string;
  loft_room_id?: string;
  profileId?: string;
  userId?: string;
  role?: string;
};

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function normalizeRole(raw: unknown): "listener" | "speaker" | "cohost" | "host" {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "host" || v === "cohost" || v === "speaker" || v === "listener") return v as any;
  return "listener";
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

    const targetProfileIdRaw = String(body.profileId || "").trim();
    const targetUserIdRaw = String(body.userId || "").trim();
    if (!targetProfileIdRaw && !targetUserIdRaw) return json(req, { error: "missing_profile_id" }, 400);

    const role = normalizeRole(body.role);

    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from("profile")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (callerProfileError || !callerProfile?.id) {
      return json(req, { error: "profile_not_found" }, 400);
    }

    const callerProfileId = callerProfile.id;

    const { data: callerMember, error: callerMemberError } = await supabaseAdmin
      .from("loft_room_member")
      .select("role")
      .eq("loft_room_id", loftRoomId)
      .eq("profile_id", callerProfileId)
      .maybeSingle();

    if (callerMemberError) {
      return json(req, { error: "member_lookup_failed", details: callerMemberError }, 500);
    }

    const callerRole = String(callerMember?.role || "").toLowerCase();
    const isHostish = callerRole === "host" || callerRole === "cohost";
    if (!isHostish) {
      return json(req, { error: "forbidden" }, 403);
    }

    // Prevent changing host role via this endpoint.
    if (role === "host") {
      return json(req, { error: "cannot_assign_host" }, 400);
    }

    let targetProfileId = targetProfileIdRaw;
    if (!targetProfileId && targetUserIdRaw) {
      const { data: targetProfile, error: targetProfileErr } = await supabaseAdmin
        .from('profile')
        .select('id')
        .eq('user_id', targetUserIdRaw)
        .maybeSingle();
      if (targetProfileErr || !targetProfile?.id) {
        return json(req, { error: 'target_profile_not_found' }, 400);
      }
      targetProfileId = targetProfile.id;
    }

    const { data: targetMember, error: targetMemberLookupError } = await supabaseAdmin
      .from("loft_room_member")
      .select("id")
      .eq("loft_room_id", loftRoomId)
      .eq("profile_id", targetProfileId)
      .maybeSingle();

    if (targetMemberLookupError) {
      return json(req, { error: "target_lookup_failed", details: targetMemberLookupError }, 500);
    }

    if (!targetMember?.id) {
      const { error: insertError } = await supabaseAdmin
        .from("loft_room_member")
        .insert({
          loft_room_id: loftRoomId,
          profile_id: targetProfileId,
          role,
          is_hand_raised: false,
          hand_raised_at: null,
        });

      if (insertError) {
        return json(req, { error: "target_insert_failed", details: insertError }, 500);
      }

      return json(req, { success: true, role });
    }

    const { error: updateError } = await supabaseAdmin
      .from("loft_room_member")
      .update({ role, is_hand_raised: false, hand_raised_at: null })
      .eq("id", targetMember.id);

    if (updateError) {
      return json(req, { error: "target_update_failed", details: updateError }, 500);
    }

    return json(req, { success: true, role });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

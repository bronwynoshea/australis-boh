/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { hydrateLoftMemberIdentities, identityForMemberRow, resolveBohLoftIdentity } from "../_shared/loftIdentity.ts";

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

    if (!supabaseUrl || !serviceRoleKey) {
      return json(req, { error: "server_not_configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const jwt = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(jwt);

    if (userError || !user) {
      return json(req, { error: "not_authenticated" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const loftRoomId = String(body.loftRoomId || body.loft_room_id || "").trim();
    if (!loftRoomId) return json(req, { error: "missing_loft_room_id" }, 400);

    const identity = await resolveBohLoftIdentity(supabaseAdmin, user.id);

    const { data: roomRow, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .select("host_boh_user_id, host_patron_person_id")
      .eq("id", loftRoomId)
      .maybeSingle();

    if (roomError || !roomRow) {
      return json(req, { error: "room_lookup_failed", details: roomError }, 500);
    }

    const { data: callerMember, error: callerMemberError } = await supabaseAdmin
      .from("loft_room_member")
      .select("role")
      .eq("loft_room_id", loftRoomId)
      .eq("boh_user_id", identity.bohUserId)
      .maybeSingle();

    if (callerMemberError) {
      return json(req, { error: "member_lookup_failed", details: callerMemberError }, 500);
    }

    const normalizedRole = String(callerMember?.role || "").toLowerCase();
    const isHost = String(roomRow.host_boh_user_id || "") === identity.bohUserId;
    const isAuthorized = isHost || normalizedRole === "cohost";
    if (!isAuthorized) {
      return json(req, { error: "forbidden" }, 403);
    }

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("loft_room_member")
      .select("boh_user_id, patron_person_id, guest_label, role, joined_at, is_hand_raised, hand_raised_at")
      .eq("loft_room_id", loftRoomId)
      .eq("is_hand_raised", true)
      .order("hand_raised_at", { ascending: true, nullsLast: false });

    if (rowsError) {
      return json(req, { error: "list_failed", details: rowsError }, 500);
    }

    const identityMap = await hydrateLoftMemberIdentities(supabaseAdmin, rows || []);

    const requests = (rows || [])
      .map((r: any) => {
        const details = identityForMemberRow(identityMap, r);
        if (!details) return null;
        return {
          profileId: null,
          bohUserId: r?.boh_user_id ? String(r.boh_user_id) : undefined,
          patronPersonId: r?.patron_person_id ? String(r.patron_person_id) : undefined,
          guestLabel: r?.guest_label ? String(r.guest_label) : undefined,
          userId: details.userId,
          displayName: details.displayName,
          avatarUrl: details.avatarUrl,
          role: r?.role || 'listener',
          joinedAt: r?.joined_at,
          handRaisedAt: r?.hand_raised_at,
        };
      })
      .filter(Boolean)
      .slice(0, 50);

    return json(req, { requests });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

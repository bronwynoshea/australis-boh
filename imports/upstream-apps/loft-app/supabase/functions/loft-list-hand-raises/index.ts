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

    const { data: profileRow, error: profileError } = await supabaseAdmin
      .from("profile")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profileRow?.id) {
      return json(req, { error: "profile_not_found" }, 400);
    }

    const profileId = profileRow.id;

    const { data: roomRow, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .select("host_profile_id")
      .eq("id", loftRoomId)
      .maybeSingle();

    if (roomError || !roomRow?.host_profile_id) {
      return json(req, { error: "room_lookup_failed", details: roomError }, 500);
    }

    const { data: callerMember, error: callerMemberError } = await supabaseAdmin
      .from("loft_room_member")
      .select("role")
      .eq("loft_room_id", loftRoomId)
      .eq("profile_id", profileId)
      .maybeSingle();

    if (callerMemberError) {
      return json(req, { error: "member_lookup_failed", details: callerMemberError }, 500);
    }

    const normalizedRole = String(callerMember?.role || "").toLowerCase();
    const isHostProfile = String(roomRow.host_profile_id) === profileId;
    const isAuthorized = isHostProfile || normalizedRole === "cohost";
    if (!isAuthorized) {
      return json(req, { error: "forbidden" }, 403);
    }

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("loft_room_member")
      .select("profile_id, role, joined_at, is_hand_raised, hand_raised_at")
      .eq("loft_room_id", loftRoomId)
      .eq("is_hand_raised", true)
      .order("hand_raised_at", { ascending: true, nullsLast: false });

    if (rowsError) {
      return json(req, { error: "list_failed", details: rowsError }, 500);
    }

    const profileIds = Array.from(
      new Set((rows || []).map((r: any) => String(r?.profile_id || '')).filter(Boolean))
    );

    const profileDetailsById = new Map<
      string,
      { userId?: string; displayName: string; avatarUrl?: string }
    >();

    if (profileIds.length > 0) {
      const { data: profiles, error: profileErr } = await supabaseAdmin
        .from('profile')
        .select('id, user_id, display_name, full_name, email, avatar_url')
        .in('id', profileIds);

      if (profileErr) {
        return json(req, { error: 'profile_lookup_failed', details: profileErr }, 500);
      }

      (profiles || []).forEach((p: any) => {
        const pid = p?.id ? String(p.id) : '';
        if (!pid) return;
        const emailLocal = p?.email ? String(p.email).split('@')[0] : '';
        const displayName =
          String(p?.display_name || '').trim() ||
          String(p?.full_name || '').trim() ||
          emailLocal ||
          'Guest';
        profileDetailsById.set(pid, {
          userId: p?.user_id ? String(p.user_id) : undefined,
          displayName,
          avatarUrl: p?.avatar_url || undefined,
        });
      });
    }

    const requests = (rows || [])
      .map((r: any) => {
        const profileId = r?.profile_id ? String(r.profile_id) : '';
        const details = profileId ? profileDetailsById.get(profileId) : undefined;
        if (!profileId || !details) return null;
        return {
          profileId,
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

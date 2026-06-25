/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

type Body = {
  filter?: string;
  includeEnded?: boolean;
};

type ProfileRow = {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  personal_room_slug?: string | null;
};

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function hostName(profile?: ProfileRow | null): string {
  if (!profile) return "";
  return (
    profile.display_name ||
    profile.full_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    ""
  );
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

    const byUserId = await supabaseAdmin
      .from("profile")
      .select("id, is_loft_admin, user_type_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const profile = byUserId.data?.id
      ? byUserId.data
      : (await supabaseAdmin.from("profile").select("id, is_loft_admin, user_type_id").eq("id", user.id).maybeSingle()).data;

    if (!profile?.id) {
      return json(req, { error: "profile_not_found" }, 400);
    }

    const { data: bohUser, error: bohUserError } = await supabaseAdmin
      .from("boh_user")
      .select("id, tenant_id")
      .eq("auth_user_id", user.id)
      .eq("app_context", "boh")
      .maybeSingle();

    if (bohUserError || !bohUser?.tenant_id) {
      return json(req, { error: "tenant_not_found" }, 403);
    }

    const tenantId = String(bohUser.tenant_id);

    const body = (await req.json().catch(() => ({}))) as Body;
    const filter = String(body.filter || "all").toLowerCase();
    const includeEnded = !!body.includeEnded;
    const visibleStatuses = includeEnded ? ["live", "scheduled", "ended"] : ["live", "scheduled"];
    const isAdmin = profile.is_loft_admin === true || Number(profile.user_type_id) === 5;

    let roomQuery = supabaseAdmin
      .from("loft_room")
      .select(`
        *,
        profile!loft_room_host_profile_id_fkey (
          id,
          display_name,
          full_name,
          first_name,
          last_name,
          avatar_url,
          personal_room_slug
        )
      `)
      .in("status", visibleStatuses)
      .order("status", { ascending: true })
      .order("scheduled_start_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    roomQuery = roomQuery.eq("tenant_id", tenantId);

    let callerMemberRoomIds = new Set<string>();
    let rsvpRoomIds = new Set<string>();

    const { data: callerMemberships, error: callerMembershipError } = await supabaseAdmin
      .from("loft_room_member")
      .select("loft_room_id")
      .eq("profile_id", profile.id);

    if (callerMembershipError) {
      return json(req, { error: "member_lookup_failed", details: callerMembershipError }, 500);
    }

    callerMemberRoomIds = new Set(
      (callerMemberships || []).map((row: any) => row.loft_room_id).filter(Boolean),
    );

    const { data: callerRsvps, error: callerRsvpError } = await supabaseAdmin
      .from("loft_room_rsvp")
      .select("loft_room_id")
      .eq("profile_id", profile.id)
      .eq("status", "going");

    if (callerRsvpError) {
      return json(req, { error: "rsvp_lookup_failed", details: callerRsvpError }, 500);
    }

    rsvpRoomIds = new Set(
      (callerRsvps || []).map((row: any) => row.loft_room_id).filter(Boolean),
    );

    if (filter === "mine") {
      roomQuery = roomQuery.eq("host_profile_id", profile.id);
    } else if (filter === "registered") {
      const ids = [...rsvpRoomIds];
      if (ids.length === 0) return json(req, { rooms: [] });
      roomQuery = roomQuery.in("id", ids);
    }

    const { data: rooms, error: roomsError } = await roomQuery;
    if (roomsError) return json(req, { error: "room_lookup_failed", details: roomsError }, 500);

    const accessibleRooms =
      (filter === "all"
        ? (rooms || []).filter((room: any) => {
            const visibility = String(room.visibility || "").toLowerCase();
            const isPersonalRoom = Array.isArray(room.tags) && room.tags.includes("personal-room");
            if (isPersonalRoom && !isAdmin) return false;
            return (
              visibility === "public" ||
              visibility === "unlisted" ||
              room.host_profile_id === profile.id ||
              callerMemberRoomIds.has(room.id) ||
              rsvpRoomIds.has(room.id)
            );
          })
        : rooms || []
      ).filter((room: any) => {
        const isPersonalRoom = Array.isArray(room.tags) && room.tags.includes("personal-room");
        if (!isPersonalRoom) return true;
        if (filter === "mine") return room.host_profile_id === profile.id;
        return isAdmin;
      });

    const roomIds = accessibleRooms.map((room: any) => room.id).filter(Boolean);
    const memberCounts = new Map<string, number>();

    if (roomIds.length > 0) {
      const { data: members } = await supabaseAdmin
        .from("loft_room_member")
        .select("loft_room_id")
        .in("loft_room_id", roomIds);

      (members || []).forEach((row: any) => {
        if (!row.loft_room_id) return;
        memberCounts.set(row.loft_room_id, (memberCounts.get(row.loft_room_id) || 0) + 1);
      });
    }

    const normalized = accessibleRooms.map((room: any) => {
      const host = room.profile as ProfileRow | null;
      const { profile: _profile, ...rest } = room;
      return {
        ...rest,
        host_name: hostName(host) || room.host_name || "",
        host_avatar_url: host?.avatar_url || null,
        host_personal_room_slug: host?.personal_room_slug || null,
        guest_join_code: room.invite_code || null,
        participant_count: room.participant_count ?? memberCounts.get(room.id) ?? 0,
        is_registered: rsvpRoomIds.has(room.id),
      };
    });

    return json(req, { rooms: normalized });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

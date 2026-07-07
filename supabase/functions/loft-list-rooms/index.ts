/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { canonicalName, resolveBohLoftIdentity } from "../_shared/loftIdentity.ts";

type Body = {
  filter?: string;
  includeEnded?: boolean;
};

type HostRow = { id: string; first_name?: string | null; last_name?: string | null; avatar_url?: string | null };

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function hostName(host?: HostRow | null, type: "boh_user" | "patron_person" = "boh_user"): string {
  if (!host) return "";
  return canonicalName(host, type);
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

    const identity = await resolveBohLoftIdentity(supabaseAdmin, user.id);
    const tenantId = identity.tenantId;

    const body = (await req.json().catch(() => ({}))) as Body;
    const filter = String(body.filter || "all").toLowerCase();
    const includeEnded = !!body.includeEnded;
    const visibleStatuses = includeEnded ? ["live", "scheduled", "ended"] : ["live", "scheduled"];
    const isAdmin = identity.isLoftAdmin === true || Number(identity.userTypeId) === 5;

    let roomQuery = supabaseAdmin
      .from("loft_room")
      .select("*")
      .in("status", visibleStatuses)
      .eq("tenant_id", tenantId)
      .order("status", { ascending: true })
      .order("scheduled_start_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    const { data: callerMemberships, error: callerMembershipError } = await supabaseAdmin
      .from("loft_room_member")
      .select("loft_room_id")
      .eq("boh_user_id", identity.bohUserId);

    if (callerMembershipError) {
      return json(req, { error: "member_lookup_failed", details: callerMembershipError }, 500);
    }

    const callerMemberRoomIds = new Set(
      (callerMemberships || []).map((row: any) => row.loft_room_id).filter(Boolean),
    );

    const { data: callerRsvps, error: callerRsvpError } = await supabaseAdmin
      .from("loft_room_rsvp")
      .select("loft_room_id")
      .eq("boh_user_id", identity.bohUserId)
      .eq("status", "going");

    if (callerRsvpError) {
      return json(req, { error: "rsvp_lookup_failed", details: callerRsvpError }, 500);
    }

    const rsvpRoomIds = new Set(
      (callerRsvps || []).map((row: any) => row.loft_room_id).filter(Boolean),
    );

    if (filter === "mine") {
      roomQuery = roomQuery.eq("host_boh_user_id", identity.bohUserId);
    } else if (filter === "registered") {
      const ids = [...rsvpRoomIds];
      if (ids.length === 0) return json(req, { rooms: [] });
      roomQuery = roomQuery.in("id", ids);
    }

    const { data: rooms, error: roomsError } = await roomQuery;
    if (roomsError) return json(req, { error: "room_lookup_failed", details: roomsError }, 500);

    const isCallerHost = (room: any) => room.host_boh_user_id === identity.bohUserId;

    const accessibleRooms =
      (filter === "all"
        ? (rooms || []).filter((room: any) => {
            const visibility = String(room.visibility || "").toLowerCase();
            const isPersonalRoom = Array.isArray(room.tags) && room.tags.includes("personal-room");
            if (isPersonalRoom && !isAdmin) return false;
            return (
              visibility === "public" ||
              visibility === "unlisted" ||
              isCallerHost(room) ||
              callerMemberRoomIds.has(room.id) ||
              rsvpRoomIds.has(room.id)
            );
          })
        : rooms || []
      ).filter((room: any) => {
        const isPersonalRoom = Array.isArray(room.tags) && room.tags.includes("personal-room");
        if (!isPersonalRoom) return true;
        if (filter === "mine") return isCallerHost(room);
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

    const hostBohUserIds = Array.from(new Set(accessibleRooms.map((room: any) => String(room.host_boh_user_id || "")).filter(Boolean)));
    const hostPatronPersonIds = Array.from(new Set(accessibleRooms.map((room: any) => String(room.host_patron_person_id || "")).filter(Boolean)));
    const bohHostById = new Map<string, HostRow>();
    const patronHostById = new Map<string, HostRow>();

    if (hostBohUserIds.length > 0) {
      const { data: hostRows, error: hostRowsError } = await supabaseAdmin
        .from("boh_user")
        .select("id, first_name, last_name, avatar_url")
        .in("id", hostBohUserIds);
      if (hostRowsError) return json(req, { error: "host_lookup_failed", details: hostRowsError }, 500);
      (hostRows || []).forEach((row: HostRow) => bohHostById.set(String(row.id), row));
    }

    if (hostPatronPersonIds.length > 0) {
      const { data: hostRows, error: hostRowsError } = await supabaseAdmin
        .from("patron_person")
        .select("id, first_name, last_name")
        .in("id", hostPatronPersonIds);
      if (hostRowsError) return json(req, { error: "host_lookup_failed", details: hostRowsError }, 500);
      (hostRows || []).forEach((row: HostRow) => patronHostById.set(String(row.id), row));
    }

    const normalized = accessibleRooms.map((room: any) => {
      const bohHost = room.host_boh_user_id ? bohHostById.get(String(room.host_boh_user_id)) : null;
      const patronHost = room.host_patron_person_id ? patronHostById.get(String(room.host_patron_person_id)) : null;
      return {
        ...room,
        host_name: bohHost ? hostName(bohHost, "boh_user") : patronHost ? hostName(patronHost, "patron_person") : "",
        host_avatar_url: bohHost?.avatar_url || null,
        host_personal_room_slug: null,
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

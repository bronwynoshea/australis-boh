/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function displayName(profile: any): string {
  return (
    profile?.full_name ||
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.email ||
    "Loft member"
  );
}

async function getCallerProfile(supabaseAdmin: any, userId: string) {
  const byUserId = await supabaseAdmin
    .from("profile")
    .select("id, user_type_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (byUserId.data?.id) return byUserId.data;

  const byProfileId = await supabaseAdmin
    .from("profile")
    .select("id, user_type_id")
    .eq("id", userId)
    .maybeSingle();

  return byProfileId.data;
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

    const callerProfile = await getCallerProfile(supabaseAdmin, user.id);
    if (!callerProfile?.id || Number(callerProfile.user_type_id) !== 5) {
      return json(req, { error: "superadmin_access_required" }, 403);
    }

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profile")
      .select(`
        id,
        user_id,
        email,
        display_name,
        full_name,
        first_name,
        last_name,
        can_use_personal_room,
        personal_room_id,
        personal_room_slug,
        updated_at
      `)
      .or("can_use_personal_room.eq.true,personal_room_id.not.is.null")
      .order("display_name", { ascending: true, nullsFirst: false });

    if (profileError) {
      return json(req, { error: "profile_lookup_failed", details: profileError }, 500);
    }

    const roomIds = (profiles || []).map((profile: any) => profile.personal_room_id).filter(Boolean);
    const roomById = new Map<string, any>();

    if (roomIds.length > 0) {
      const { data: rooms, error: roomError } = await supabaseAdmin
        .from("loft_room")
        .select("id, title, status, is_open, invite_code, updated_at, created_at")
        .in("id", roomIds);

      if (roomError) {
        return json(req, { error: "room_lookup_failed", details: roomError }, 500);
      }

      (rooms || []).forEach((room: any) => {
        if (room?.id) roomById.set(room.id, room);
      });
    }

    const personalTables = (profiles || []).map((profile: any) => {
      const room = profile.personal_room_id ? roomById.get(profile.personal_room_id) : null;
      return {
        profile_id: profile.id,
        user_id: profile.user_id || null,
        email: profile.email || null,
        display_name: displayName(profile),
        can_use_personal_room: !!profile.can_use_personal_room,
        personal_room_id: profile.personal_room_id || null,
        personal_room_slug: profile.personal_room_slug || null,
        invite_code: room?.invite_code || null,
        room_title: room?.title || null,
        room_status: room?.status || null,
        is_open: room?.is_open ?? false,
        room_updated_at: room?.updated_at || null,
        profile_updated_at: profile.updated_at || null,
      };
    });

    return json(req, { personalTables });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

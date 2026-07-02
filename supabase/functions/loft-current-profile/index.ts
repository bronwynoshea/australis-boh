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

function displayName(profile: any, email?: string | null): string {
  return (
    profile?.display_name ||
    profile?.full_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    email ||
    "Loft member"
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

    const selectProfile =
      "id, display_name, full_name, first_name, last_name, avatar_url, default_bg_id, can_host_loft, can_use_personal_room, personal_room_slug, personal_room_id, is_loft_admin, user_type_id";
    const byUserId = await supabaseAdmin
      .from("profile")
      .select(selectProfile)
      .eq("user_id", user.id)
      .maybeSingle();
    const byProfileId = byUserId.data?.id
      ? { data: null, error: null }
      : await supabaseAdmin.from("profile").select(selectProfile).eq("id", user.id).maybeSingle();

    const profile = byUserId.data?.id ? byUserId.data : byProfileId.data;
    const profileError = byUserId.error || byProfileId.error;

    if (profileError) {
      return json(req, { error: "profile_lookup_failed" }, 500);
    }

    if (!profile?.id) {
      return json(req, { error: "profile_not_found" }, 404);
    }

    const canCreateLoftRooms = !!profile.can_host_loft || !!profile.is_loft_admin || Number(profile.user_type_id) === 5;
    const canUsePersonalRoom = !!profile.can_use_personal_room;

    return json(req, {
      user: { id: user.id, email: user.email ?? null },
      profile: {
        id: profile.id,
        name: displayName(profile, user.email),
        avatarUrl: profile.avatar_url ?? null,
        defaultBgId: profile.default_bg_id ?? null,
        can_host_loft: !!profile.can_host_loft,
        can_create_loft_rooms: canCreateLoftRooms,
        canCreateLoftRooms,
        can_use_personal_room: canUsePersonalRoom,
        canUsePersonalRoom,
        personal_room_slug: canUsePersonalRoom ? profile.personal_room_slug ?? null : null,
        personalRoomSlug: canUsePersonalRoom ? profile.personal_room_slug ?? null : null,
        personal_room_id: canUsePersonalRoom ? profile.personal_room_id ?? null : null,
        personalRoomId: canUsePersonalRoom ? profile.personal_room_id ?? null : null,
        is_loft_admin: !!profile.is_loft_admin,
        user_type_id: profile.user_type_id ?? null,
      },
    });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

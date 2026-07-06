/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { canonicalName } from "../_shared/loftIdentity.ts";

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
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const supabaseAuthed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !user) return json(req, { error: "not_authenticated" }, 401);

    const { data: bohUser, error: bohUserError } = await supabaseAdmin
      .from("boh_user")
      .select("id, auth_user_id, email, first_name, last_name, avatar_url")
      .eq("auth_user_id", user.id)
      .eq("app_context", "boh")
      .maybeSingle();
    if (bohUserError) return json(req, { error: "boh_user_lookup_failed" }, 500);
    if (!bohUser?.id) return json(req, { error: "boh_user_not_found" }, 404);

    const name = canonicalName(bohUser, "boh_user");
    const { data: personalRoom } = await supabaseAdmin
      .from("loft_room")
      .select("id, invite_code, slug")
      .eq("host_boh_user_id", bohUser.id)
      .eq("room_origin", "personal")
      .neq("status", "deleted")
      .maybeSingle();

    return json(req, {
      user: { id: user.id, email: user.email ?? bohUser.email ?? null },
      profile: {
        id: bohUser.id,
        profileId: null,
        bohUserId: bohUser.id,
        name,
        avatarUrl: bohUser.avatar_url ?? null,
        defaultBgId: null,
        can_host_loft: true,
        can_create_loft_rooms: true,
        canCreateLoftRooms: true,
        can_use_personal_room: !!personalRoom?.id,
        canUsePersonalRoom: !!personalRoom?.id,
        personal_room_slug: personalRoom?.invite_code ?? personalRoom?.slug ?? null,
        personalRoomSlug: personalRoom?.invite_code ?? personalRoom?.slug ?? null,
        personal_room_id: personalRoom?.id ?? null,
        personalRoomId: personalRoom?.id ?? null,
        is_loft_admin: false,
        user_type_id: null,
      },
    });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveBohLoftIdentity, resolveLoftSupabaseServerKeys } from "../_shared/loftIdentity.ts";

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
    const serverKeys = resolveLoftSupabaseServerKeys((name) => Deno.env.get(name));
    if (!supabaseUrl || !serverKeys) return json(req, { error: "server_not_configured" }, 500);
    const { serviceRoleKey, publishableKey } = serverKeys;

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const supabaseAuthed = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !user) return json(req, { error: "not_authenticated" }, 401);

    const identity = await resolveBohLoftIdentity(supabaseAdmin, user.id);
    const { data: personalRoom, error: personalRoomError } = await supabaseAdmin
      .from("loft_room")
      .select("id, invite_code")
      .eq("host_boh_user_id", identity.bohUserId)
      .eq("room_origin", "personal")
      .neq("status", "deleted")
      .limit(1)
      .maybeSingle();
    if (personalRoomError) return json(req, { error: "personal_room_lookup_failed" }, 500);

    return json(req, {
      user: { id: user.id, email: user.email ?? null },
      profile: {
        id: identity.bohUserId,
        profileId: null,
        bohUserId: identity.bohUserId,
        name: identity.displayName,
        avatarUrl: identity.avatarUrl ?? null,
        defaultBgId: null,
        can_host_loft: !!identity.canHostLoft,
        can_create_loft_rooms: !!identity.canHostLoft,
        canCreateLoftRooms: !!identity.canHostLoft,
        can_use_personal_room: !!personalRoom?.id,
        canUsePersonalRoom: !!personalRoom?.id,
        personal_room_slug: personalRoom?.invite_code ?? null,
        personalRoomSlug: personalRoom?.invite_code ?? null,
        personal_room_id: personalRoom?.id ?? null,
        personalRoomId: personalRoom?.id ?? null,
        is_loft_admin: !!identity.isLoftAdmin,
        user_type_id: identity.userTypeId ?? null,
      },
    });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
  });
}

const PERSONAL_ROOM_TAG = "personal-room";

const hasPersonalRoomTag = (room: { tags?: unknown } | null) =>
  Array.isArray(room?.tags) && room.tags.includes(PERSONAL_ROOM_TAG);

async function findPersonalRoomByInviteCode(supabaseAdmin: any, inviteCode: string) {
  const roomLookup = await supabaseAdmin
    .from("loft_room")
    .select("id, title, is_open, opened_at, invite_code, host_profile_id, tags")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  const room = roomLookup.data;
  if (roomLookup.error || !room) {
    return { room: null, roomError: roomLookup.error, hostProfileId: null };
  }

  if (hasPersonalRoomTag(room)) {
    return { room, roomError: null, hostProfileId: room.host_profile_id ?? null };
  }

  const ownerLookup = await supabaseAdmin
    .from("profile")
    .select("id, personal_room_id")
    .eq("personal_room_id", room.id)
    .maybeSingle();

  if (ownerLookup.error || !ownerLookup.data?.personal_room_id) {
    return { room: null, roomError: ownerLookup.error, hostProfileId: null };
  }

  return { room, roomError: null, hostProfileId: ownerLookup.data.id ?? room.host_profile_id ?? null };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get('origin')) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    console.log('[loft-get-personal-room-by-slug] Request received');
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.log('[loft-get-personal-room-by-slug] Server not configured');
      return json(req, { error: "server_not_configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('[loft-get-personal-room-by-slug] Parsing request body');
    const body = await req.json().catch((e) => {
      console.log('[loft-get-personal-room-by-slug] Failed to parse JSON:', e);
      return {};
    });
    const { slug } = body;

    console.log('[loft-get-personal-room-by-slug] Slug:', slug);

    if (!slug) {
      console.log('[loft-get-personal-room-by-slug] No slug provided');
      return json(req, { error: "slug_required" }, 400);
    }

    const normalizedSlug = String(slug).trim();
    const normalizedCode = normalizedSlug.toUpperCase();

    // External guest links use loft_room.invite_code. Member/host vanity slugs belong to profile.
    console.log('[loft-get-personal-room-by-slug] Looking up room invite code:', normalizedCode);
    let { room, roomError, hostProfileId } = await findPersonalRoomByInviteCode(supabaseAdmin, normalizedCode);

    if (!room) {
      console.log('[loft-get-personal-room-by-slug] Invite code not found; checking legacy profile slug');
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profile")
        .select("id, display_name, personal_room_id")
        .eq("personal_room_slug", normalizedSlug)
        .maybeSingle();

      console.log('[loft-get-personal-room-by-slug] Legacy profile lookup result:', { profile, profileError });

      if (profileError || !profile) {
        console.log('[loft-get-personal-room-by-slug] Personal room not found');
        return json(req, { error: "personal_room_not_found", message: "No Personal Room found with this guest link" }, 404);
      }

      if (!profile.personal_room_id) {
        console.log('[loft-get-personal-room-by-slug] Profile has no personal room ID');
        return json(req, { error: "personal_room_not_created", message: "This user has not created their Personal Room yet" }, 404);
      }

      hostProfileId = profile.id;
      console.log('[loft-get-personal-room-by-slug] Looking up legacy profile room:', profile.personal_room_id);
      const legacyRoom = await supabaseAdmin
        .from("loft_room")
        .select("id, title, is_open, opened_at, invite_code, host_profile_id, tags")
        .eq("id", profile.personal_room_id)
        .maybeSingle();
      room = legacyRoom.data;
      roomError = legacyRoom.error;
    }

    console.log('[loft-get-personal-room-by-slug] Room lookup result:', { room, roomError });

    if (roomError || !room) {
      console.log('[loft-get-personal-room-by-slug] Room not found');
      return json(req, { error: "room_not_found" }, 404);
    }

    console.log('[loft-get-personal-room-by-slug] Success, returning room:', room.id);
    return json(req, {
      roomId: room.id,
      title: room.title,
      isOpen: room.is_open === true,
      openedAt: room.opened_at ?? null,
      inviteCode: room.invite_code ?? null,
      hostProfileId: hostProfileId ?? room.host_profile_id ?? null,
    });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

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

const cleanCode = (value: unknown) =>
  String(value || '').trim().replace(/[^a-z0-9-_]/gi, '');

const displayHostName = (profile: any, fallback = 'Host') => {
  const candidates = [
    profile?.display_name,
    profile?.full_name,
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' '),
    fallback,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() || 'Host';
};

async function getTenantId(supabaseAdmin: any, tenantSlug: string) {
  if (!tenantSlug) return null;
  const { data, error } = await supabaseAdmin
    .from("boh_tenant")
    .select("id")
    .eq("slug", tenantSlug)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id as string;
}

async function getHostProfile(supabaseAdmin: any, hostProfileId: string | null) {
  if (!hostProfileId) return null;
  const { data } = await supabaseAdmin
    .from("profile")
    .select("id, display_name, full_name, first_name, last_name")
    .eq("id", hostProfileId)
    .maybeSingle();
  return data ?? null;
}

async function findPersonalRoomByInviteCode(supabaseAdmin: any, inviteCode: string, tenantId: string | null) {
  let query = supabaseAdmin
    .from("loft_room")
    .select("id, title, is_open, opened_at, invite_code, host_profile_id, tags, tenant_id")
    .ilike("invite_code", inviteCode);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const roomLookup = await query.maybeSingle();
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SECRET_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(req, { error: "server_not_configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const slug = cleanCode(body.slug);
    const tenantSlug = cleanCode(body.tenantSlug).toLowerCase();

    if (!slug) return json(req, { error: "slug_required" }, 400);

    const tenantId = await getTenantId(supabaseAdmin, tenantSlug);
    const inviteCode = slug.toUpperCase();
    let { room, roomError, hostProfileId } = await findPersonalRoomByInviteCode(supabaseAdmin, inviteCode, tenantId);

    if (!room) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profile")
        .select("id, display_name, full_name, first_name, last_name, personal_room_id")
        .eq("personal_room_slug", slug)
        .maybeSingle();

      if (profileError || !profile) {
        return json(req, { error: "personal_room_not_found", message: "No Personal Room found with this guest link" }, 404);
      }

      if (!profile.personal_room_id) {
        return json(req, { error: "personal_room_not_created", message: "This user has not created their Personal Room yet" }, 404);
      }

      hostProfileId = profile.id;
      const legacyRoom = await supabaseAdmin
        .from("loft_room")
        .select("id, title, is_open, opened_at, invite_code, host_profile_id, tags, tenant_id")
        .eq("id", profile.personal_room_id)
        .maybeSingle();
      room = legacyRoom.data;
      roomError = legacyRoom.error;
    }

    if (roomError || !room) return json(req, { error: "room_not_found" }, 404);

    const hostProfile = await getHostProfile(supabaseAdmin, hostProfileId ?? room.host_profile_id ?? null);
    const hostName = displayHostName(hostProfile);

    return json(req, {
      roomId: room.id,
      title: room.title || `${hostName}'s Personal Table`,
      hostName,
      isOpen: room.is_open === true,
      openedAt: room.opened_at ?? null,
      inviteCode: room.invite_code ?? null,
      hostProfileId: hostProfileId ?? room.host_profile_id ?? null,
    });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

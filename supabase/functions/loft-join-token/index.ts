import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

type JoinTokenBody = {
  loftRoomId?: string;
  loft_room_id?: string;
  appContext?: string;
};

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
  });
}

function isDailyRoomAlreadyExists(resp: Response, body: unknown) {
  if (resp.status === 409) return true;
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body || {});
  return resp.status === 400 && /room named .* already exists/i.test(bodyText);
}

function normalizeAppContext(raw: unknown): string {
  const v = String(raw || "cafe").toLowerCase();
  if (v === "journey" || v === "coach" || v === "mentor" || v === "cafe") return v;
  return "cafe";
}

function normalizeVisibility(raw: unknown): "public" | "unlisted" | "private" {
  const v = String(raw || "public").toLowerCase();
  if (v === "private") return "private";
  if (v === "unlisted") return "unlisted";
  return "public";
}

async function createDailyMeetingToken(params: {
  dailyApiKey: string;
  roomName: string;
  userId: string;
  userName: string;
  isOwner: boolean;
}) {
  const { dailyApiKey, roomName, userId, userName, isOwner } = params;

  const resp = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dailyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_id: userId,
        user_name: userName,
        is_owner: isOwner,
        enable_prejoin_ui: false,
        // ✅ NO custom userData here - Daily.co doesn't support it in token
      },
    }),
  });

  const jsonBody = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(
      `daily_token_error_${resp.status}: ${JSON.stringify(jsonBody)}`,
    );
  }

  return jsonBody;
}

async function ensureDailyRoom(params: {
  dailyApiKey: string;
  name: string;
}) {
  const { dailyApiKey, name } = params;

  const resp = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dailyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      privacy: "private",
    }),
  });

  const jsonBody = await resp.json().catch(() => ({}));
  if (isDailyRoomAlreadyExists(resp, jsonBody)) return { name };

  if (!resp.ok) {
    throw new Error(
      `daily_room_create_error_${resp.status}: ${JSON.stringify(jsonBody)}`,
    );
  }

  return jsonBody;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get('origin')) });

  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SECRET_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(req, { error: "server_not_configured" }, 500);
    }
    if (!dailyApiKey) {
      return json(req, { error: "daily_not_configured" }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as JoinTokenBody;
    const loftRoomId = String(body.loftRoomId || body.loft_room_id || "").trim();
    if (!loftRoomId) return json(req, { error: "missing_loft_room_id" }, 400);

    const appContext = body.appContext ? normalizeAppContext(body.appContext) : null;
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

    let roomQuery = supabaseAdmin
      .from("loft_room")
      .select("id, app_context, tenant_id, host_profile_id, title, daily_room_name, is_recorded, visibility, status, scheduled_start_at, started_at, is_open, opened_at")
      .eq("id", loftRoomId);

    if (appContext) {
      roomQuery = roomQuery.eq("app_context", appContext);
    }

    const { data: room, error: roomError } = await roomQuery.single();

    if (roomError || !room) {
      return json(req, { error: "room_not_found", details: roomError }, 404);
    }

    const visibility = normalizeVisibility((room as any)?.visibility);

    const isAuthenticated = !userError && !!user;
    if (!isAuthenticated) {
      return json(req, { error: "not_authenticated" }, 401);
    }

    const authedUser = user!;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profile")
      .select("id, display_name, full_name, first_name, last_name, email, avatar_url")
      .eq("user_id", authedUser.id)
      .single();

    if (profileError || !profile) {
      return json(req, { error: "profile_not_found" }, 400);
    }

    const { data: bohUser, error: bohUserError } = await supabaseAdmin
      .from("boh_user")
      .select("id, tenant_id")
      .eq("auth_user_id", authedUser.id)
      .eq("app_context", "boh")
      .maybeSingle();

    if (bohUserError || !bohUser?.tenant_id) {
      return json(req, { error: "tenant_not_found" }, 403);
    }

    const tenantId = String(bohUser.tenant_id);
    const roomTenantId = (room as any)?.tenant_id ? String((room as any).tenant_id) : "";

    if (!roomTenantId || roomTenantId !== tenantId) {
      return json(req, { error: "room_not_found" }, 404);
    }

    const profileId = String((profile as any)?.id || "");
    const hostProfileId = String((room as any)?.host_profile_id || "");
    const isOwner = !!profileId && !!hostProfileId && profileId === hostProfileId;

    let memberRole: string | null = null;
    if (!isOwner) {
      const { data: memberRow } = await supabaseAdmin
        .from('loft_room_member')
        .select('role')
        .eq('loft_room_id', room.id)
        .eq('profile_id', profile.id)
        .maybeSingle();
      memberRole = memberRow?.role ? String(memberRow.role) : null;
    }

    let isRoomOpen = !!(room as any)?.is_open;
    const rawStartedAt = (room as any)?.started_at;
    const hasHostStarted = !!rawStartedAt && !Number.isNaN(new Date(String(rawStartedAt)).getTime());

    if (isOwner) {
      const nowIso = new Date().toISOString();
      const updates: Record<string, any> = {};

      if (!hasHostStarted) {
        updates.started_at = nowIso;
        (room as any).started_at = nowIso;
      }
      if (!isRoomOpen) {
        updates.is_open = true;
        updates.opened_at = nowIso;
        (room as any).is_open = true;
        (room as any).opened_at = nowIso;
        isRoomOpen = true;
      }
      if (String((room as any)?.status || '').toLowerCase() !== 'live') {
        updates.status = 'live';
        (room as any).status = 'live';
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('loft_room')
          .update(updates)
          .eq('id', room.id);
      }
    }

    if (!isOwner && !isRoomOpen) {
      return json(req, { error: 'room_not_open_yet', message: 'Please wait for the host to open the room' }, 403);
    }

    if (hasHostStarted && String((room as any)?.status || '').toLowerCase() !== 'live') {
      try {
        await supabaseAdmin
          .from('loft_room')
          .update({ status: 'live' })
          .eq('id', room.id);
        (room as any).status = 'live';
      } catch {
        // ignore
      }
    }

    if (!isOwner && visibility === "private") {
      const { data: member, error: memberError } = await supabaseAdmin
        .from("loft_room_member")
        .select("id")
        .eq("loft_room_id", room.id)
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (memberError) {
        return json(req, { error: "member_lookup_failed", details: memberError }, 500);
      }

      if (!member) {
        return json(req, { error: "not_invited" }, 403);
      }
    }

    const { data: memberRows, error: memberRowsError } = await supabaseAdmin
      .from('loft_room_member')
      .select(`
        profile_id,
        role,
        is_hand_raised,
        profile:profile_id (
          id,
          user_id,
          display_name,
          full_name,
          first_name,
          last_name,
          email,
          avatar_url
        )
      `)
      .eq('loft_room_id', room.id);

    if (memberRowsError) {
      return json(req, { error: 'member_hydration_failed', details: memberRowsError }, 500);
    }

    const deriveDisplayName = (row: any) => {
      if (!row) return 'Guest';
      const emailLocal = row.email ? String(row.email).split('@')[0] : '';
      const nameFromParts = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
      return (
        String(row.display_name || '').trim() ||
        String(row.full_name || '').trim() ||
        nameFromParts ||
        emailLocal ||
        'Guest'
      );
    };

    const members = (memberRows || []).map((row: any) => {
      const profileRow = row?.profile || {};
      const displayName = deriveDisplayName(profileRow);
      return {
        profileId: String(row?.profile_id || ''),
        userId: profileRow?.user_id ? String(profileRow.user_id) : undefined,
        displayName,
        avatarUrl: profileRow?.avatar_url || undefined,
        role: String(row?.role || 'listener'),
        isHandRaised: !!row?.is_hand_raised,
      };
    }).filter((m: any) => m.profileId);

    const hostDisplayName = deriveDisplayName(profile);

    const currentUserProfile = {
      profileId: String(profile.id),
      userId: authedUser.id,
      displayName: hostDisplayName,
      avatarUrl: profile?.avatar_url || null,
      isHost: isOwner,
    };

    await ensureDailyRoom({
      dailyApiKey,
      name: room.daily_room_name,
    });

    const tokenResp = await createDailyMeetingToken({
      dailyApiKey,
      roomName: room.daily_room_name,
      userId: authedUser.id,
      userName: hostDisplayName,
      isOwner,
    });

    return json(req, {
      dailyRoomName: room.daily_room_name,
      token: tokenResp.token,
      role: isOwner ? "host" : (memberRole || "listener"),
      isRecorded: !!room.is_recorded,
      roomTitle: room.title,
      scheduledStartAt: (room as any)?.scheduled_start_at ?? undefined,
      hostProfileId,
      members,
      currentUserProfile,
      hostDetails: {
        profileId: profileId,
        userId: authedUser.id,
        displayName: hostDisplayName,
        avatarUrl: profile?.avatar_url || null,
        isHost: true,
      },
    });
  } catch (e) {
    console.error('[loft-join-token] Error:', e);
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});
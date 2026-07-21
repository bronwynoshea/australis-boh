import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { canonicalName, hydrateLoftMemberIdentities, identityForMemberRow, resolveBohLoftIdentity, resolveLoftSupabaseServerKeys } from "../_shared/loftIdentity.ts";

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

async function resolveHostDetails(supabaseAdmin: any, room: any, fallbackIdentity: any, fallbackAuthUserId: string) {
  const hostBohUserId = String(room?.host_boh_user_id || '');
  if (hostBohUserId) {
    const { data: host, error } = await supabaseAdmin
      .from('boh_user')
      .select('id, auth_user_id, first_name, last_name, full_name, display_name, avatar_url')
      .eq('id', hostBohUserId)
      .maybeSingle();
    if (error) throw new Error(`host_boh_user_lookup_failed: ${error.message}`);
    if (host?.id) {
      return {
        profileId: null,
        userId: host.auth_user_id ? String(host.auth_user_id) : undefined,
        displayName: canonicalName(host, 'boh_user'),
        bohUserId: String(host.id),
        avatarUrl: host.avatar_url || null,
        isHost: true,
      };
    }
  }

  const hostPatronPersonId = String(room?.host_patron_person_id || '');
  if (hostPatronPersonId) {
    const { data: host, error } = await supabaseAdmin
      .from('patron_person')
      .select('id, first_name, last_name')
      .eq('id', hostPatronPersonId)
      .maybeSingle();
    if (error) throw new Error(`host_patron_lookup_failed: ${error.message}`);
    if (host?.id) {
      return {
        profileId: null,
        patronPersonId: String(host.id),
        displayName: canonicalName(host, 'patron_person'),
        isHost: true,
      };
    }
  }

  return {
    profileId: null,
    userId: fallbackAuthUserId,
    displayName: fallbackIdentity.displayName,
    bohUserId: fallbackIdentity.bohUserId,
    avatarUrl: fallbackIdentity.avatarUrl || null,
    isHost: true,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get('origin')) });

  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serverKeys = resolveLoftSupabaseServerKeys((name) => Deno.env.get(name));
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

    if (!supabaseUrl || !serverKeys) {
      return json(req, { error: "server_not_configured" }, 500);
    }
    const { serviceRoleKey, publishableKey } = serverKeys;
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

    const supabaseAuthed = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuthed.auth.getUser();

    let roomQuery = supabaseAdmin
      .from("loft_room")
      .select("id, app_context, tenant_id, host_boh_user_id, host_patron_person_id, title, daily_room_name, is_recorded, visibility, status, scheduled_start_at, started_at, is_open, opened_at, max_participants, tags")
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

    const identity = await resolveBohLoftIdentity(supabaseAdmin, authedUser.id);
    const tenantId = identity.tenantId;
    const roomTenantId = (room as any)?.tenant_id ? String((room as any).tenant_id) : "";

    if (!roomTenantId || roomTenantId !== tenantId) {
      return json(req, { error: "room_not_found" }, 404);
    }

    const isOwner = String((room as any)?.host_boh_user_id || "") === identity.bohUserId;

    const configuredCapacity = Number((room as any)?.max_participants || 0);
    const maxParticipants = Number.isFinite(configuredCapacity) && configuredCapacity > 0 ? configuredCapacity : 30;

    let memberRole: string | null = null;
    let memberId: string | null = null;
    let memberIsActive = false;
    if (!isOwner) {
      const { data: memberRow } = await supabaseAdmin
        .from('loft_room_member')
        .select('id, role, is_active')
        .eq('loft_room_id', room.id)
        .eq('boh_user_id', identity.bohUserId)
        .maybeSingle();
      memberId = memberRow?.id ? String(memberRow.id) : null;
      memberRole = memberRow?.role ? String(memberRow.role) : null;
      memberIsActive = !!memberRow?.is_active;
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
        .eq("boh_user_id", identity.bohUserId)
        .maybeSingle();

      if (memberError) {
        return json(req, { error: "member_lookup_failed", details: memberError }, 500);
      }

      if (!member) {
        return json(req, { error: "not_invited" }, 403);
      }
    }

    if (!isOwner && !memberIsActive) {
      const { data: activeMembers, error: activeMembersError } = await supabaseAdmin
        .from('loft_room_member')
        .select('boh_user_id, patron_person_id, guest_label')
        .eq('loft_room_id', room.id)
        .eq('is_active', true);

      if (activeMembersError) {
        return json(req, { error: 'capacity_lookup_failed', details: activeMembersError }, 500);
      }

      const activeIdentityKeys = new Set((activeMembers || []).map((row: any) => String(row.boh_user_id || row.patron_person_id || row.guest_label)).filter(Boolean));
      const activeCount = activeIdentityKeys.size;

      if (activeCount >= maxParticipants) {
        return json(req, {
          error: 'room_full',
          message: 'This Loft room has reached capacity.',
          maxParticipants,
        }, 403);
      }

      const { data: rsvpRows, error: rsvpRowsError } = await supabaseAdmin
        .from('loft_room_rsvp')
        .select('boh_user_id, patron_person_id, status')
        .eq('loft_room_id', room.id)
        .eq('status', 'going');

      if (rsvpRowsError) {
        return json(req, { error: 'rsvp_lookup_failed', details: rsvpRowsError }, 500);
      }

      const callerReservedKeys = new Set([identity.bohUserId].filter(Boolean));
      const callerHasReservedSeat = (rsvpRows || []).some((row: any) => callerReservedKeys.has(String(row.boh_user_id || '')));
      const outstandingReservedSeats = (rsvpRows || []).filter((row: any) => {
        const reservedIdentityKey = String(row.boh_user_id || row.patron_person_id || '');
        return reservedIdentityKey && !callerReservedKeys.has(reservedIdentityKey) && !activeIdentityKeys.has(reservedIdentityKey);
      }).length;

      if (!callerHasReservedSeat && activeCount + outstandingReservedSeats >= maxParticipants) {
        return json(req, {
          error: 'room_full_reserved',
          message: 'This Loft room has reached capacity including reserved RSVP seats.',
          maxParticipants,
        }, 403);
      }

      if (memberId) {
        const { error: reactivateError } = await supabaseAdmin
          .from('loft_room_member')
          .update({ is_active: true, left_at: null })
          .eq('id', memberId);

        if (reactivateError) {
          return json(req, { error: 'member_reactivate_failed', details: reactivateError }, 500);
        }
      } else {
        const { data: insertedMember, error: insertMemberError } = await supabaseAdmin
          .from('loft_room_member')
          .insert({
            loft_room_id: room.id,
            boh_user_id: identity.bohUserId,
            role: 'listener',
            is_active: true,
          })
          .select('id, role')
          .single();

        if (insertMemberError) {
          const code = (insertMemberError as any)?.code;
          if (code !== '23505') {
            return json(req, { error: 'member_insert_failed', code, details: insertMemberError }, 500);
          }
        }
        memberId = insertedMember?.id ? String(insertedMember.id) : memberId;
        memberRole = insertedMember?.role ? String(insertedMember.role) : (memberRole || 'listener');
      }
    }

    const { data: memberRows, error: memberRowsError } = await supabaseAdmin
      .from('loft_room_member')
      .select(`
        boh_user_id,
        patron_person_id,
        guest_label,
        role,
        is_hand_raised
      `)
      .eq('loft_room_id', room.id);

    if (memberRowsError) {
      return json(req, { error: 'member_hydration_failed', details: memberRowsError }, 500);
    }

    const memberIdentityMap = await hydrateLoftMemberIdentities(supabaseAdmin, memberRows || []);

    const members = (memberRows || []).map((row: any) => {
      const memberIdentity = identityForMemberRow(memberIdentityMap, row);
      if (!memberIdentity) return null;
      return {
        profileId: null,
        bohUserId: row?.boh_user_id ? String(row.boh_user_id) : undefined,
        patronPersonId: row?.patron_person_id ? String(row.patron_person_id) : undefined,
        guestLabel: row?.guest_label ? String(row.guest_label) : undefined,
        userId: memberIdentity.userId || undefined,
        displayName: memberIdentity.displayName,
        avatarUrl: memberIdentity.avatarUrl || undefined,
        role: String(row?.role || 'listener'),
        isHandRaised: !!row?.is_hand_raised,
      };
    }).filter(Boolean);

    const hostDisplayName = identity.displayName;
    const hostDetails = await resolveHostDetails(supabaseAdmin, room, identity, authedUser.id);

    const currentUserProfile = {
      profileId: null,
      bohUserId: identity.bohUserId,
      userId: authedUser.id,
      displayName: hostDisplayName,
      avatarUrl: identity.avatarUrl || null,
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
      hostProfileId: null,
      members,
      currentUserProfile,
      hostDetails,
    });
  } catch (e) {
    console.error('[loft-join-token] Error:', e);
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});
// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  assertPatronInTenant,
  createDailyMeetingToken,
  displayNameForCaller,
  ensureDailyRoom,
  ensureExternalLoftProfile,
  getServerConfig,
  isPersonalRoom,
  isRoomJoinableForExternal,
  normalizeAppContext,
  normalizePersona,
  normalizeText,
  resolveInternalLoftProfileByEmail,
  resolveTenant,
  validateServerBearer,
} from "../_shared/loftExternalAccess.ts";

const JOIN_OPEN_WINDOW_MS = 2 * 60 * 1000;

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse(req, { success: false, error: 'method_not_allowed' }, 405);
  if (!validateServerBearer(req)) return jsonResponse(req, { success: false, error: 'unauthorized' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const { supabaseUrl, serviceRoleKey, dailyApiKey } = getServerConfig();
    if (!dailyApiKey) return jsonResponse(req, { success: false, error: 'daily_not_configured' }, 500);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const tenant = await resolveTenant(supabaseAdmin, { tenantId: body.tenantId, tenantSlug: body.tenantSlug });
    const patronPersonId = normalizeText(body.patronPersonId);
    if (!patronPersonId) return jsonResponse(req, { success: false, error: 'patron_person_required' }, 400);

    const appContext = normalizeAppContext(body.appContext);
    const persona = normalizePersona(body.persona);
    const patron = await assertPatronInTenant(supabaseAdmin, tenant.id, patronPersonId);
    const caller = {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      appContext,
      persona,
      patronPersonId,
      patronOrganisationId: body.patronOrganisationId || null,
      externalAuthUserId: body.externalAuthUserId || null,
      externalProfileId: body.externalProfileId || null,
      email: body.email || patron.email || null,
      displayName: body.displayName || displayNameForCaller({}, patron),
    };
    const loftProfile =
      await resolveInternalLoftProfileByEmail(supabaseAdmin, caller) ||
      await ensureExternalLoftProfile(supabaseAdmin, caller, patron);

    let videoSession: any = null;
    let loftRoomId = normalizeText(body.loftRoomId);
    const videoSessionId = normalizeText(body.videoSessionId);
    let role: 'host' | 'listener' = 'listener';

    if (videoSessionId) {
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('loft_video_session')
        .select('*')
        .eq('id', videoSessionId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (sessionError) throw new Error(`session_lookup_failed: ${sessionError.message}`);
      if (!session?.id) return jsonResponse(req, { success: false, error: 'session_not_found' }, 404);
      if (['completed', 'cancelled', 'no_show'].includes(String(session.status))) return jsonResponse(req, { success: false, error: 'session_not_joinable' }, 403);
      const isParticipant = session.patron_person_id === patronPersonId;
      const isHost = session.host_patron_person_id === patronPersonId;
      if (!isParticipant && !isHost) return jsonResponse(req, { success: false, error: 'session_access_denied' }, 403);
      if (isParticipant && !isHost && session.scheduled_start_at) {
        const opensAt = new Date(new Date(session.scheduled_start_at).getTime() - JOIN_OPEN_WINDOW_MS);
        if (Number.isFinite(opensAt.getTime()) && Date.now() < opensAt.getTime()) {
          return jsonResponse(req, { success: false, error: 'session_not_open_yet', opensAt: opensAt.toISOString(), scheduledStartAt: session.scheduled_start_at }, 403);
        }
      }
      videoSession = session;
      loftRoomId = session.loft_room_id;
      role = isHost ? 'host' : 'listener';
    }

    if (!loftRoomId) return jsonResponse(req, { success: false, error: 'loft_room_required' }, 400);
    const { data: room, error: roomError } = await supabaseAdmin
      .from('loft_room')
      .select('*')
      .eq('id', loftRoomId)
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    if (roomError) throw new Error(`room_lookup_failed: ${roomError.message}`);
    if (!room?.id) return jsonResponse(req, { success: false, error: 'room_not_found' }, 404);

    if (!videoSession) {
      const isVisibleBusinessRoom = ['public', 'unlisted'].includes(String(room.visibility || '')) && !isPersonalRoom(room);
      const isOwnPersonalRoom = isPersonalRoom(room) && ((loftProfile as any).bohUserId ? room.host_boh_user_id === (loftProfile as any).bohUserId : room.host_patron_person_id === (loftProfile as any).patronPersonId);
      if (!isVisibleBusinessRoom && !isOwnPersonalRoom) return jsonResponse(req, { success: false, error: 'room_access_denied' }, 403);
      if (isVisibleBusinessRoom && !isRoomJoinableForExternal(room)) return jsonResponse(req, { success: false, error: 'room_not_open_yet' }, 403);
      if (isOwnPersonalRoom) role = 'host';
    }

    await ensureDailyRoom(dailyApiKey, room.daily_room_name);

    if (role !== 'host') {
      const configuredCapacity = Number(room.max_participants || 0);
      const maxParticipants = Number.isFinite(configuredCapacity) && configuredCapacity > 0 ? configuredCapacity : 30;
      let existingMemberQuery = supabaseAdmin
        .from('loft_room_member')
        .select('id, is_active')
        .eq('loft_room_id', room.id);
      existingMemberQuery = (loftProfile as any).bohUserId
        ? existingMemberQuery.eq('boh_user_id', (loftProfile as any).bohUserId)
        : existingMemberQuery.eq('patron_person_id', (loftProfile as any).patronPersonId);
      const { data: existingMember } = await existingMemberQuery.maybeSingle();

      if (!existingMember?.is_active) {
      const { data: activeMembers, error: activeMembersError } = await supabaseAdmin
        .from('loft_room_member')
        .select('boh_user_id, patron_person_id, guest_label')
        .eq('loft_room_id', room.id)
        .eq('is_active', true);

      if (activeMembersError) throw new Error(`capacity_lookup_failed: ${activeMembersError.message}`);
      const activeMemberKeys = new Set((activeMembers || []).map((row: any) => String(row.boh_user_id || row.patron_person_id || row.guest_label || '')).filter(Boolean));
      const activeCount = activeMemberKeys.size;
      if (activeCount >= maxParticipants) {
        return jsonResponse(req, { success: false, error: 'room_full', maxParticipants }, 403);
      }

      const { data: rsvpRows, error: rsvpRowsError } = await supabaseAdmin
        .from('loft_room_rsvp')
        .select('boh_user_id, patron_person_id, status')
        .eq('loft_room_id', room.id)
        .eq('status', 'going');

      if (rsvpRowsError) throw new Error(`rsvp_lookup_failed: ${rsvpRowsError.message}`);
      const callerSeatKey = (loftProfile as any).bohUserId ? String((loftProfile as any).bohUserId) : String((loftProfile as any).patronPersonId || '');
      const callerHasReservedSeat = (rsvpRows || []).some((row: any) => String(row.boh_user_id || row.patron_person_id || '') === callerSeatKey);
      const outstandingReservedSeats = (rsvpRows || []).filter((row: any) => {
        const reservedKey = String(row.boh_user_id || row.patron_person_id || '');
        return reservedKey && reservedKey !== callerSeatKey && !activeMemberKeys.has(reservedKey);
      }).length;

      if (!callerHasReservedSeat && activeCount + outstandingReservedSeats >= maxParticipants) {
        return jsonResponse(req, { success: false, error: 'room_full_reserved', maxParticipants }, 403);
      }
      }
    }

    await supabaseAdmin.from('loft_room_member').upsert({
      loft_room_id: room.id,
      boh_user_id: (loftProfile as any).bohUserId || null,
      patron_person_id: (loftProfile as any).patronPersonId || null,
      role,
      is_active: true,
      left_at: null,
    }, { onConflict: (loftProfile as any).bohUserId ? 'loft_room_id,boh_user_id' : 'loft_room_id,patron_person_id' });
    if (videoSession?.id) {
      const update: Record<string, unknown> = { status: 'joined' };
      if (!videoSession.first_joined_at) update.first_joined_at = new Date().toISOString();
      await supabaseAdmin.from('loft_video_session').update(update).eq('id', videoSession.id);
    }

    const redirectOnMeetingExit = (() => {
      const value = normalizeText(body.redirectOnMeetingExit);
      if (!value) return undefined;
      try {
        const parsed = new URL(value);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : undefined;
      } catch {
        return undefined;
      }
    })();

    const tokenResult = await createDailyMeetingToken({
      dailyApiKey,
      roomName: room.daily_room_name,
      userId: (loftProfile as any).bohUserId ? `boh:${(loftProfile as any).bohUserId}` : `patron:${patronPersonId}`,
      userName: loftProfile.displayName,
      isOwner: role === 'host',
      closeTabOnExit: !redirectOnMeetingExit,
      redirectOnMeetingExit,
    });

    return jsonResponse(req, {
      success: true,
      dailyRoomName: room.daily_room_name,
      token: tokenResult.token,
      role,
      isRecorded: room.is_recorded !== false,
      roomTitle: room.title,
      videoSessionId: videoSession?.id || null,
      loftRoomId: room.id,
      currentUserProfile: {
        profileId: null,
        bohUserId: (loftProfile as any).bohUserId || null,
        patronPersonId,
        displayName: loftProfile.displayName,
        isHost: role === 'host',
      },
    });
  } catch (error) {
    console.error('[loft-external-join-token] Error:', error);
    return jsonResponse(req, { success: false, error: error instanceof Error ? error.message : 'unexpected_error' }, 400);
  }
});

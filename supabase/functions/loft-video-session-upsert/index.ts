// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  assertPatronInTenant,
  displayNameForCaller,
  ensureDailyRoom,
  ensureExternalLoftProfile,
  generateInviteCode,
  getServerConfig,
  isHostEligible,
  isUuid,
  normalizeAppContext,
  normalizePersona,
  normalizeText,
  resolveInternalLoftProfileByEmail,
  resolveTenant,
  validateServerBearer,
} from "../_shared/loftExternalAccess.ts";

const VALID_CONTEXTS = new Set(['interview', 'coaching', 'onboarding', 'appointment', 'group_session', 'internal_meeting', 'other']);

async function ensureExternalPersonalRoom(supabaseAdmin: any, dailyApiKey: string, tenant: any, hostPatron: any, input: any) {
  const caller = {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    appContext: normalizeAppContext(input.appContext || (input.sourceApp === 'talent-app' ? 'talent' : 'cafe')),
    persona: normalizePersona(input.hostPersona || 'recruiter'),
    patronPersonId: input.hostPatronPersonId,
    patronOrganisationId: input.patronOrganisationId || null,
    externalAuthUserId: input.hostExternalAuthUserId || null,
    externalProfileId: input.hostExternalProfileId || null,
    email: input.hostEmail || hostPatron.email || null,
    displayName: input.hostDisplayName || displayNameForCaller({}, hostPatron),
  };
  const loftProfile =
    await resolveInternalLoftProfileByEmail(supabaseAdmin, caller) ||
    await ensureExternalLoftProfile(supabaseAdmin, caller, hostPatron);

  const isInternalHost = (loftProfile as any).source === 'boh_user';

  let existingRoomQuery = supabaseAdmin
    .from('loft_room')
    .select('id, daily_room_name, invite_code, title')
    .eq('tenant_id', tenant.id)
    .eq('business_context', 'interview')
    .limit(1);

  existingRoomQuery = isInternalHost
    ? existingRoomQuery.eq('host_boh_user_id', (loftProfile as any).bohUserId)
    : existingRoomQuery.eq('host_patron_person_id', (loftProfile as any).patronPersonId);

  existingRoomQuery = isInternalHost
    ? existingRoomQuery.contains('tags', ['personal-room'])
    : existingRoomQuery.contains('tags', ['external-recruiter']);

  const { data: existingRoom } = await existingRoomQuery.maybeSingle();
  if (existingRoom?.id) {
    await ensureDailyRoom(dailyApiKey, existingRoom.daily_room_name);
    return existingRoom;
  }
  const inviteCode = generateInviteCode();
  const canonicalHostId = isInternalHost ? (loftProfile as any).bohUserId : (loftProfile as any).patronPersonId;
  const dailyRoomName = `${isInternalHost ? 'loft-boh-personal' : 'loft-ext-personal'}-${tenant.slug}-${canonicalHostId}`.toLowerCase();
  await ensureDailyRoom(dailyApiKey, dailyRoomName);
  const { data: room, error: roomError } = await supabaseAdmin
    .from('loft_room')
    .insert({
      tenant_id: tenant.id,
      app_context: caller.appContext,
      host_boh_user_id: isInternalHost ? (loftProfile as any).bohUserId : null,
      host_patron_person_id: !isInternalHost ? (loftProfile as any).patronPersonId : null,
      title: `${loftProfile.displayName}'s Interview Room`,
      description: 'Personal Loft room for scheduled one-on-one sessions.',
      visibility: 'unlisted',
      tags: isInternalHost ? ['personal-room', 'boh-user'] : ['personal-room', 'external-recruiter'],
      daily_room_name: dailyRoomName,
      invite_code: inviteCode,
      status: 'live',
      is_open: false,
      is_recorded: true,
      started_at: new Date().toISOString(),
      scheduled_start_at: new Date().toISOString(),
      scheduled_tz: 'UTC',
      room_origin: 'user_generated',
      business_context: 'interview',
    })
    .select('id, daily_room_name, invite_code, title')
    .single();
  if (roomError || !room?.id) throw new Error(`host_room_create_failed: ${roomError?.message || 'unknown'}`);
  await supabaseAdmin.from('loft_room_member').upsert({
    loft_room_id: room.id,
    boh_user_id: isInternalHost ? (loftProfile as any).bohUserId : null,
    patron_person_id: !isInternalHost ? (loftProfile as any).patronPersonId : null,
    role: 'host'
  }, { onConflict: isInternalHost ? 'loft_room_id,boh_user_id' : 'loft_room_id,patron_person_id' });
  return room;
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse(req, { success: false, error: 'method_not_allowed' }, 405);
  if (!validateServerBearer(req)) return jsonResponse(req, { success: false, error: 'unauthorized' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const { supabaseUrl, serviceRoleKey, dailyApiKey } = getServerConfig();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const tenant = await resolveTenant(supabaseAdmin, { tenantId: body.tenantId, tenantSlug: body.tenantSlug });
    const businessContext = normalizeText(body.businessContext);
    if (!VALID_CONTEXTS.has(businessContext)) return jsonResponse(req, { success: false, error: 'invalid_business_context' }, 400);
    if (!body.hostBohUserId && !body.hostPatronPersonId) return jsonResponse(req, { success: false, error: 'host_required' }, 400);

    let loftRoomId = normalizeText(body.loftRoomId);
    const hostBohUserId = normalizeText(body.hostBohUserId);
    const hostPatronPersonId = normalizeText(body.hostPatronPersonId);

    if (hostBohUserId) {
      const { data: hostBohUser, error: hostBohUserError } = await supabaseAdmin
        .from('boh_user')
        .select('id')
        .eq('id', hostBohUserId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (hostBohUserError) throw new Error(`host_boh_user_lookup_failed: ${hostBohUserError.message}`);
      if (!hostBohUser?.id) return jsonResponse(req, { success: false, error: 'host_boh_user_not_found_for_tenant' }, 403);
    }

    let hostPatron: any = null;
    if (hostPatronPersonId) {
      hostPatron = await assertPatronInTenant(supabaseAdmin, tenant.id, hostPatronPersonId);
      const hostPersona = normalizePersona(body.hostPersona || 'recruiter');
      if (!isHostEligible(hostPatron, hostPersona)) return jsonResponse(req, { success: false, error: 'host_patron_not_allowed' }, 403);
    }

    if (!loftRoomId && hostPatronPersonId) {
      if (!dailyApiKey) return jsonResponse(req, { success: false, error: 'daily_not_configured' }, 500);
      const room = await ensureExternalPersonalRoom(supabaseAdmin, dailyApiKey, tenant, hostPatron, body);
      loftRoomId = room.id;
    }

    if (!loftRoomId) return jsonResponse(req, { success: false, error: 'loft_room_required' }, 400);
    const { data: targetRoom, error: targetRoomError } = await supabaseAdmin
      .from('loft_room')
      .select('id, invite_code')
      .eq('id', loftRoomId)
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    if (targetRoomError) throw new Error(`loft_room_lookup_failed: ${targetRoomError.message}`);
    if (!targetRoom?.id) return jsonResponse(req, { success: false, error: 'loft_room_not_found_for_tenant' }, 403);
    const participantPatronPersonId = normalizeText(body.participantPatronPersonId);
    if (participantPatronPersonId) await assertPatronInTenant(supabaseAdmin, tenant.id, participantPatronPersonId);

    const sourceApp = normalizeText(body.sourceApp) || 'boh';
    const businessRecordId = normalizeText(body.businessRecordId);
    if (businessRecordId && !isUuid(businessRecordId)) {
      return jsonResponse(req, { success: false, error: 'business_record_id_must_be_uuid' }, 400);
    }
    const joinUrl = null;
    const baseRow = {
      tenant_id: tenant.id,
      app_context: normalizeAppContext(body.appContext || (sourceApp === 'talent-app' ? 'talent' : 'cafe')),
      source_app: sourceApp,
      loft_room_id: loftRoomId,
      business_context: businessContext,
      business_record_table: normalizeText(body.businessRecordTable) || null,
      business_record_id: businessRecordId || null,
      host_boh_user_id: hostBohUserId || null,
      host_patron_person_id: hostPatronPersonId || null,
      patron_person_id: participantPatronPersonId || null,
      patron_organisation_id: normalizeText(body.patronOrganisationId) || null,
      participant_name: normalizeText(body.participantName) || null,
      participant_email: normalizeText(body.participantEmail).toLowerCase() || null,
      scheduled_start_at: normalizeText(body.scheduledStartAt) || null,
      scheduled_end_at: normalizeText(body.scheduledEndAt) || null,
      join_url: joinUrl,
      status: normalizeText(body.status) || 'scheduled',
      message_status: 'not_sent',
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    };

    let existing = null;
    if (baseRow.business_record_table && baseRow.business_record_id) {
      const { data } = await supabaseAdmin
        .from('loft_video_session')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('business_record_table', baseRow.business_record_table)
        .eq('business_record_id', baseRow.business_record_id)
        .maybeSingle();
      existing = data;
    }

    const query = existing?.id
      ? supabaseAdmin.from('loft_video_session').update(baseRow).eq('id', existing.id).select('*').single()
      : supabaseAdmin.from('loft_video_session').insert(baseRow).select('*').single();
    const { data: session, error } = await query;
    if (error || !session?.id) throw new Error(`video_session_upsert_failed: ${error?.message || 'unknown'}`);

    const computedJoinUrl = targetRoom.invite_code
      ? `/t/${tenant.slug}/loft/join/${String(targetRoom.invite_code).toLowerCase()}`
      : `/apps/loft`;
    if (session.join_url !== computedJoinUrl) {
      await supabaseAdmin
        .from('loft_video_session')
        .update({ join_url: computedJoinUrl })
        .eq('id', session.id);
      session.join_url = computedJoinUrl;
    }

    return jsonResponse(req, {
      success: true,
      videoSessionId: session.id,
      loftRoomId: session.loft_room_id,
      joinUrl: session.join_url,
      status: session.status,
      scheduledStartAt: session.scheduled_start_at,
      scheduledEndAt: session.scheduled_end_at,
    });
  } catch (error) {
    console.error('[loft-video-session-upsert] Error:', error);
    return jsonResponse(req, { success: false, error: error instanceof Error ? error.message : 'unexpected_error' }, 400);
  }
});

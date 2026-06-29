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
  normalizeAppContext,
  isHostEligible,
  normalizePersona,
  normalizeText,
  resolveTenant,
  validateServerBearer,
} from "../_shared/loftExternalAccess.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return jsonResponse(req, { success: false, error: "method_not_allowed" }, 405);
  if (!validateServerBearer(req)) return jsonResponse(req, { success: false, error: "unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const { supabaseUrl, serviceRoleKey, dailyApiKey } = getServerConfig();
    if (!dailyApiKey) return jsonResponse(req, { success: false, error: "daily_not_configured" }, 500);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const tenant = await resolveTenant(supabaseAdmin, { tenantId: body.tenantId, tenantSlug: body.tenantSlug });
    const patronPersonId = normalizeText(body.patronPersonId);
    if (!patronPersonId) return jsonResponse(req, { success: false, error: "patron_person_required" }, 400);

    const appContext = normalizeAppContext(body.appContext);
    const persona = normalizePersona(body.persona);
    if (!['recruiter', 'coach', 'staff'].includes(persona)) {
      return jsonResponse(req, { success: false, error: "persona_not_allowed" }, 403);
    }

    const patron = await assertPatronInTenant(supabaseAdmin, tenant.id, patronPersonId);
    if (!isHostEligible(patron, persona)) {
      return jsonResponse(req, { success: false, error: "patron_not_allowed_to_host" }, 403);
    }

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
    const externalProfile = await ensureExternalLoftProfile(supabaseAdmin, caller, patron);

    const { data: existingRoom, error: existingError } = await supabaseAdmin
      .from('loft_room')
      .select('id, title, daily_room_name, invite_code, tags, room_origin')
      .eq('tenant_id', tenant.id)
      .eq('host_profile_id', externalProfile.profileId)
      .eq('room_origin', 'personal')
      .neq('status', 'deleted')
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(`personal_room_lookup_failed: ${existingError.message}`);

    if (existingRoom?.id) {
      await ensureDailyRoom(dailyApiKey, existingRoom.daily_room_name);
      return jsonResponse(req, {
        success: true,
        roomId: existingRoom.id,
        dailyRoomName: existingRoom.daily_room_name,
        title: existingRoom.title,
        inviteCode: existingRoom.invite_code || null,
        tenantSlug: tenant.slug,
        isNew: false,
      });
    }

    const inviteCode = generateInviteCode();
    const dailyRoomName = `loft-ext-personal-${tenant.slug}-${externalProfile.profileId}`.toLowerCase();
    await ensureDailyRoom(dailyApiKey, dailyRoomName);
    const title = `${externalProfile.displayName}'s ${persona === 'coach' ? 'Coaching' : 'Interview'} Room`;
    const now = new Date().toISOString();

    const { data: room, error: roomError } = await supabaseAdmin
      .from('loft_room')
      .insert({
        tenant_id: tenant.id,
        app_context: appContext,
        host_profile_id: externalProfile.profileId,
        title,
        description: 'Personal Loft room for scheduled one-on-one sessions.',
        visibility: 'unlisted',
        tags: ['personal-room', persona === 'coach' ? 'external-coach' : 'external-recruiter'],
        daily_room_name: dailyRoomName,
        invite_code: inviteCode,
        status: 'live',
        is_open: false,
        is_recorded: true,
        started_at: now,
        scheduled_start_at: now,
        scheduled_tz: 'UTC',
        room_origin: 'personal',
        business_context: persona === 'coach' ? 'coaching' : 'interview',
      })
      .select('*')
      .single();
    if (roomError || !room?.id) throw new Error(`personal_room_create_failed: ${roomError?.message || 'unknown'}`);

    await supabaseAdmin.from('loft_room_member').upsert({ loft_room_id: room.id, profile_id: externalProfile.profileId, role: 'host' }, { onConflict: 'loft_room_id,profile_id' });
    await supabaseAdmin.from('profile').update({ personal_room_id: room.id, personal_room_slug: inviteCode, can_use_personal_room: true, can_host_loft: true }).eq('id', externalProfile.profileId);

    return jsonResponse(req, {
      success: true,
      roomId: room.id,
      dailyRoomName: room.daily_room_name,
      title: room.title,
      inviteCode,
      tenantSlug: tenant.slug,
      isNew: true,
    });
  } catch (error) {
    console.error('[loft-external-personal-room] Error:', error);
    return jsonResponse(req, { success: false, error: error instanceof Error ? error.message : 'unexpected_error' }, 400);
  }
});

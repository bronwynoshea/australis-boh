// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  allowedBusinessContextsForPersona,
  assertPatronInTenant,
  displayNameForCaller,
  ensureExternalLoftProfile,
  getServerConfig,
  isPersonalRoom,
  normalizeAppContext,
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
    const { supabaseUrl, serviceRoleKey } = getServerConfig();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const tenant = await resolveTenant(supabaseAdmin, { tenantId: body.tenantId, tenantSlug: body.tenantSlug });
    const patronPersonId = normalizeText(body.patronPersonId);
    if (!patronPersonId) return jsonResponse(req, { success: false, error: "patron_person_required" }, 400);

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
    await ensureExternalLoftProfile(supabaseAdmin, caller, patron);

    const includeEnded = Boolean(body.includeEnded);
    const statuses = includeEnded ? ["live", "scheduled", "ended"] : ["live", "scheduled"];
    const contexts = allowedBusinessContextsForPersona(persona);

    const { data: roomRows, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .select("id, title, description, room_origin, business_context, visibility, status, scheduled_start_at, scheduled_end_at, daily_room_name, host_name, tags, invite_code, is_recorded, host_profile_id")
      .eq("tenant_id", tenant.id)
      .in("status", statuses)
      .in("visibility", ["public", "unlisted"])
      .order("scheduled_start_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (roomError) throw new Error(`room_lookup_failed: ${roomError.message}`);

    const officialRooms = (roomRows || []).filter((room: any) => {
      if (isPersonalRoom(room)) return false;
      const origin = String(room.room_origin || "");
      const context = String(room.business_context || "other");
      const tags = Array.isArray(room.tags) ? room.tags.map((tag: any) => String(tag).toLowerCase()) : [];
      const taggedForSeekers = tags.some((tag: string) => ["clubhouse", "onboarding", "training", "job-seeker", "jobseeker"].includes(tag));
      return ["official", "business", "group"].includes(origin) || contexts.includes(context) || taggedForSeekers;
    }).map((room: any) => ({
      id: room.id,
      title: room.title,
      description: room.description ?? null,
      roomOrigin: room.room_origin || null,
      businessContext: room.business_context || null,
      visibility: room.visibility,
      status: room.status,
      scheduledStartAt: room.scheduled_start_at ?? null,
      scheduledEndAt: room.scheduled_end_at ?? null,
      dailyRoomName: room.daily_room_name ?? null,
      hostName: room.host_name ?? null,
      joinMode: "room",
      videoSessionId: null,
      isPersonalRoom: false,
      tags: Array.isArray(room.tags) ? room.tags : [],
    }));

    let sessionRooms: any[] = [];
    if (body.includeScheduledSessions !== false) {
      const { data: sessions, error: sessionError } = await supabaseAdmin
        .from("loft_video_session")
        .select("id, loft_room_id, business_context, status, scheduled_start_at, scheduled_end_at, participant_name, participant_email, metadata")
        .eq("tenant_id", tenant.id)
        .not("status", "in", "(completed,cancelled,no_show)")
        .or(`patron_person_id.eq.${patronPersonId},host_patron_person_id.eq.${patronPersonId}`)
        .order("scheduled_start_at", { ascending: true, nullsFirst: false });

      if (sessionError) throw new Error(`session_lookup_failed: ${sessionError.message}`);
      const roomIds = [...new Set((sessions || []).map((row: any) => row.loft_room_id).filter(Boolean))];
      const roomMap = new Map<string, any>();
      if (roomIds.length) {
        const { data: linkedRooms, error: linkedRoomError } = await supabaseAdmin
          .from("loft_room")
          .select("id, title, description, room_origin, business_context, visibility, status, scheduled_start_at, scheduled_end_at, daily_room_name, host_name, tags, is_recorded")
          .eq("tenant_id", tenant.id)
          .in("id", roomIds);
        if (linkedRoomError) throw new Error(`session_room_lookup_failed: ${linkedRoomError.message}`);
        (linkedRooms || []).forEach((room: any) => roomMap.set(room.id, room));
      }

      sessionRooms = (sessions || []).map((session: any) => {
        const room = roomMap.get(session.loft_room_id) || {};
        return {
          id: session.loft_room_id || session.id,
          title: room.title || `${session.business_context || "Loft"} session`,
          description: room.description ?? null,
          roomOrigin: room.room_origin || "personal",
          businessContext: session.business_context || room.business_context || null,
          visibility: room.visibility || "private",
          status: session.status,
          scheduledStartAt: session.scheduled_start_at ?? room.scheduled_start_at ?? null,
          scheduledEndAt: session.scheduled_end_at ?? room.scheduled_end_at ?? null,
          dailyRoomName: room.daily_room_name ?? null,
          hostName: room.host_name ?? null,
          joinMode: "video_session",
          videoSessionId: session.id,
          isPersonalRoom: isPersonalRoom(room),
          tags: Array.isArray(room.tags) ? room.tags : ["scheduled-session"],
        };
      });
    }

    return jsonResponse(req, { success: true, rooms: [...officialRooms, ...sessionRooms] });
  } catch (error) {
    console.error("[loft-external-list-rooms] Error:", error);
    const message = error instanceof Error ? error.message : "unexpected_error";
    const status = message.includes("unauthorized") ? 401 : message.includes("not_found") ? 404 : 400;
    return jsonResponse(req, { success: false, error: message }, status);
  }
});

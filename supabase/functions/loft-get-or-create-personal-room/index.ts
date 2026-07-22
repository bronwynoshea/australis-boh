import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveBohLoftIdentity, resolveLoftSupabaseServerKeys } from "../_shared/loftIdentity.ts";

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

async function createDailyRoom(params: { dailyApiKey: string; name: string }) {
  const resp = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: { Authorization: `Bearer ${params.dailyApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: params.name, privacy: "private" }),
  });
  const jsonBody = await resp.json().catch(() => ({}));
  if (isDailyRoomAlreadyExists(resp, jsonBody)) return { name: params.name };
  if (!resp.ok) throw new Error(`daily_room_create_error_${resp.status}: ${JSON.stringify(jsonBody)}`);
  return jsonBody;
}

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateInviteCode(length = 8) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < length; i++) code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  return code;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get('origin')) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serverKeys = resolveLoftSupabaseServerKeys((name) => Deno.env.get(name));
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");
    if (!supabaseUrl || !serverKeys) return json(req, { error: "server_not_configured" }, 500);
    const { serviceRoleKey, publishableKey } = serverKeys;
    if (!dailyApiKey) return json(req, { error: "daily_not_configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const supabaseAuthed = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseAuthed.auth.getUser();
    if (userError || !user) return json(req, { error: "not_authenticated" }, 401);

    const identity = await resolveBohLoftIdentity(supabaseAdmin, user.id);
    const userName = identity.displayName;
    if (!identity.firstName || !identity.lastName) {
      return json(req, { error: "boh_user_onboarding_incomplete", message: "First name and last name are required before creating a Personal Table." }, 400);
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("boh_tenant")
      .select("id, slug")
      .eq("id", identity.tenantId)
      .single();
    if (tenantError || !tenant?.slug) return json(req, { error: "tenant_not_found" }, 403);

    const tenantId = String(tenant.id);
    const tenantSlug = String(tenant.slug).toLowerCase();

    if (!identity.isLoftAdmin) {
      const { data: loftApp, error: loftAppError } = await supabaseAdmin
        .from("boh_app")
        .select("id")
        .eq("slug", "loft")
        .maybeSingle();
      if (loftAppError) return json(req, { error: "permission_lookup_failed", details: loftAppError }, 500);
      const { data: loftAccess, error: loftAccessError } = await supabaseAdmin
        .from("boh_user_app")
        .select("id")
        .eq("user_id", identity.bohUserId)
        .eq("tenant_id", tenantId)
        .eq("app_context", "boh")
        .eq("app_id", loftApp?.id || "00000000-0000-0000-0000-000000000000")
        .limit(1)
        .maybeSingle();
      if (loftAccessError) return json(req, { error: "permission_lookup_failed", details: loftAccessError }, 500);
      if (!loftAccess?.id) {
        return json(req, { error: "permission_denied", message: "Your profile is not enabled for Personal Room hosting yet." }, 403);
      }
    }

    async function returnExistingPersonalRoom(existingRoom: any) {
      let inviteCode = existingRoom.invite_code || '';
      const updates: Record<string, unknown> = {};
      const expectedTitle = `${userName}'s Personal Room`;
      if (existingRoom.title !== expectedTitle) updates.title = expectedTitle;
      if (!inviteCode) {
        inviteCode = generateInviteCode();
        updates.invite_code = inviteCode;
      }
      if (!existingRoom.tenant_id) updates.tenant_id = tenantId;
      if (existingRoom.room_origin !== 'personal') updates.room_origin = 'personal';
      if (!Array.isArray(existingRoom.tags) || !existingRoom.tags.includes('personal-room')) updates.tags = [...new Set([...(existingRoom.tags || []), 'personal-room'])];
      if (Object.keys(updates).length > 0) {
        updates.updated_at = new Date().toISOString();
        await supabaseAdmin.from("loft_room").update(updates).eq("id", existingRoom.id);
      }

      await createDailyRoom({ dailyApiKey, name: existingRoom.daily_room_name });
      await supabaseAdmin
        .from("loft_room_member")
        .upsert({ loft_room_id: existingRoom.id, boh_user_id: identity.bohUserId, role: "host" }, { onConflict: "loft_room_id,boh_user_id" });

      return json(req, { roomId: existingRoom.id, dailyRoomName: existingRoom.daily_room_name, title: expectedTitle, inviteCode, tenantSlug, isNew: false });
    }

    const { data: hostPersonalRoom, error: hostRoomError } = await supabaseAdmin
      .from("loft_room")
      .select("id, title, daily_room_name, invite_code, tenant_id, tags, room_origin")
      .eq("tenant_id", tenantId)
      .eq("host_boh_user_id", identity.bohUserId)
      .eq("room_origin", "personal")
      .neq("status", "deleted")
      .limit(1)
      .maybeSingle();
    if (hostRoomError) return json(req, { error: "db_error", details: hostRoomError }, 500);
    if (hostPersonalRoom) return returnExistingPersonalRoom(hostPersonalRoom);

    const dailyRoomName = `loft-personal-${identity.bohUserId}`;
    const inviteCode = generateInviteCode();
    await createDailyRoom({ dailyApiKey, name: dailyRoomName });

    const insertRow = {
      app_context: 'cafe',
      tenant_id: tenantId,
      host_boh_user_id: identity.bohUserId,
      title: `${userName}'s Personal Room`,
      description: 'Personal meeting room - always available',
      visibility: 'unlisted',
      is_recorded: true,
      tags: ['personal-room'],
      daily_room_name: dailyRoomName,
      invite_code: inviteCode,
      status: 'live',
      is_open: false,
      started_at: new Date().toISOString(),
      scheduled_tz: 'UTC',
      scheduled_start_at: new Date().toISOString(),
      room_origin: 'personal',
      business_context: null,
    };

    const { data: room, error: insertError } = await supabaseAdmin.from("loft_room").insert(insertRow).select("*").single();
    if (insertError || !room) return json(req, { error: "db_error", details: insertError }, 500);

    await supabaseAdmin.from("loft_room_member").insert({ loft_room_id: room.id, boh_user_id: identity.bohUserId, role: "host" });

    return json(req, { roomId: room.id, dailyRoomName: room.daily_room_name, title: room.title, inviteCode, tenantSlug, isNew: true });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

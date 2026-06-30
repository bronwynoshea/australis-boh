import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";


// ✅ RATE LIMITING
const rateLimiterMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string, maxRequests = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimiterMap.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimiterMap.set(identifier, { count: 1, resetAt: now + windowMs });
    if (rateLimiterMap.size > 10000) {
      const cutoff = now - windowMs;
      for (const [key, val] of rateLimiterMap.entries()) {
        if (val.resetAt < cutoff) rateLimiterMap.delete(key);
      }
    }
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
  });
}

function sanitizeGuestName(name: string): string {
  return name
    .replace(/[<>\"\'&]/g, '')
    .substring(0, 50)
    .trim() || 'Guest';
}

function isDailyRoomAlreadyExists(resp: Response, body: unknown) {
  if (resp.status === 409) return true;
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body || {});
  return resp.status === 400 && /room named .* already exists/i.test(bodyText);
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
    throw new Error(`daily_room_create_error_${resp.status}: ${JSON.stringify(jsonBody)}`);
  }

  return jsonBody;
}

async function createDailyMeetingToken(params: {
  dailyApiKey: string;
  roomName: string;
  userName: string;
  isOwner: boolean;
}) {
  const { dailyApiKey, roomName, userName, isOwner } = params;
  const expirationTime = Math.floor(Date.now() / 1000) + (4 * 60 * 60);

  const resp = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dailyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        is_owner: isOwner,
        enable_prejoin_ui: false,
        exp: expirationTime,
        enable_recording: false,
        enable_screenshare: false,
        start_video_off: true,
        start_audio_off: true,
      },
    }),
  });

  const jsonBody = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`daily_token_error_${resp.status}: ${JSON.stringify(jsonBody)}`);
  }

  return jsonBody;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get('origin')) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  // ✅ RATE LIMITING (more aggressive for slug lookups)
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  if (!checkRateLimit(clientIP, 5, 60000)) { // Only 5 requests per minute
    console.log(`[rate-limit] Blocked slug lookup from ${clientIP}`);
    return json(req, { 
      error: "rate_limit_exceeded", 
      message: "Too many requests. Please try again in 1 minute." 
    }, 429);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SECRET_KEY");
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !dailyApiKey) {
      return json(req, { error: "server_not_configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const { slug, tenantSlug, guestName } = body;

    // ✅ VALIDATE SLUG FORMAT (prevent injection attacks)
    if (!slug || typeof slug !== 'string') {
      return json(req, { error: "slug_required" }, 400);
    }

    // ✅ SANITIZE SLUG (only allow alphanumeric, hyphens, underscores)
    const sanitizedSlug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (sanitizedSlug !== slug.toLowerCase()) {
      return json(req, { error: "invalid_slug_format" }, 400);
    }

    if (sanitizedSlug.length < 3 || sanitizedSlug.length > 50) {
      return json(req, { error: "invalid_slug_length" }, 400);
    }

    // ✅ VALIDATE TENANT SLUG FORMAT. Public links must carry tenant context
    // so invite codes are resolved inside the intended tenant namespace.
    if (!tenantSlug || typeof tenantSlug !== 'string') {
      return json(req, { error: "tenant_required" }, 400);
    }

    const sanitizedTenantSlug = tenantSlug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (sanitizedTenantSlug !== tenantSlug.toLowerCase()) {
      return json(req, { error: "invalid_tenant_format" }, 400);
    }

    if (sanitizedTenantSlug.length < 2 || sanitizedTenantSlug.length > 64) {
      return json(req, { error: "invalid_tenant_length" }, 400);
    }

    const sanitizedGuestName = sanitizeGuestName(guestName || "Guest");

    console.log('[join-personal-room] Looking up tenant/code:', {
      tenantSlug: sanitizedTenantSlug,
      inviteCode: sanitizedSlug,
    });

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("boh_tenant")
      .select("id, slug, name")
      .eq("slug", sanitizedTenantSlug)
      .single();

    if (tenantError || !tenant) {
      console.log('[join-personal-room] Tenant not found:', sanitizedTenantSlug);
      return json(req, {
        error: "room_not_found",
        message: "Personal room not found or not available"
      }, 404);
    }

    // ✅ LOOKUP WITH TENANT + INVITE CODE PRIVACY CHECKS
    const { data: room, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .select("id, title, daily_room_name, status, tenant_id, public_join_enabled, host_profile_id")
      .eq("tenant_id", tenant.id)
      .ilike("invite_code", sanitizedSlug)
      .single();

    if (roomError || !room) {
      console.log('[join-personal-room] Room not found for tenant/code:', {
        tenantSlug: sanitizedTenantSlug,
        inviteCode: sanitizedSlug,
      });
      return json(req, {
        error: "room_not_found",
        message: "Personal room not found or not available"
      }, 404);
    }

    if (!room.public_join_enabled) {
      console.log('[join-personal-room] Room public join disabled:', room.id);
      return json(req, {
        error: "room_private",
        message: "This personal room is private"
      }, 403);
    }

    const { data: profile } = await supabaseAdmin
      .from("profile")
      .select("id, display_name, personal_room_public")
      .eq("id", room.host_profile_id)
      .single();

    if (profile && profile.personal_room_public === false) {
      console.log('[join-personal-room] Host profile marks room private:', room.id);
      return json(req, {
        error: "room_private",
        message: "This personal room is private"
      }, 403);
    }

    // ✅ CHECK ROOM STATUS
    if (room.status === 'ended' || room.status === 'deleted') {
      return json(req, { 
        error: "room_ended", 
        message: "This room has ended" 
      }, 410);
    }

    // ✅ RECONCILE DAILY ROOM BEFORE TOKEN GENERATION
    await ensureDailyRoom({
      dailyApiKey,
      name: room.daily_room_name,
    });

    // ✅ GENERATE TOKEN (don't expose room ID to client)
    const tokenResp = await createDailyMeetingToken({
      dailyApiKey,
      roomName: room.daily_room_name,
      userName: sanitizedGuestName,
      isOwner: false,
    });

    // ✅ AUDIT LOG
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const { error: auditError } = await supabaseAdmin.from("loft_room_join_logs").insert({
      room_id: room.id,
      join_type: 'tenant_personal_room_code',
      guest_name: sanitizedGuestName,
      slug_used: `${sanitizedTenantSlug}/${sanitizedSlug}`,
      ip_address: clientIP,
      user_agent: userAgent,
      joined_at: new Date().toISOString(),
    });

    if (auditError) {
      console.error('[audit-log-error]', auditError);
    }

    console.log('[join-personal-room] Success for slug:', sanitizedSlug);

    // ✅ NEVER RETURN ROOM ID - only what's needed to join
    return json(req, {
      token: tokenResp.token,
      dailyRoomName: room.daily_room_name,
      roomTitle: room.title || `${profile?.display_name || tenant.name || 'Host'}'s Room`,
      hostName: profile?.display_name || tenant.name || 'Host',
    });

  } catch (e) {
    console.error('[join-personal-room] Error:', e);
    return json(req, { 
      error: "unexpected_error", 
      message: "An error occurred. Please try again."
    }, 500);
  }
});

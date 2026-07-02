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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !dailyApiKey) {
      return json(req, { error: "server_not_configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const { slug, guestName } = body;

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

    const sanitizedGuestName = sanitizeGuestName(guestName || "Guest");

    console.log('[join-personal-room] Looking up slug:', sanitizedSlug);

    // ✅ LOOKUP WITH PRIVACY CHECKS
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profile")
      .select(`
        id, 
        display_name, 
        personal_room_id,
        personal_room_public
      `)
      .eq("personal_room_slug", sanitizedSlug)
      .single();

    if (profileError || !profile) {
      console.log('[join-personal-room] Profile not found for slug:', sanitizedSlug);
      // ✅ GENERIC ERROR (don't reveal if slug exists or not)
      return json(req, { 
        error: "room_not_found", 
        message: "Personal room not found or not available" 
      }, 404);
    }

    if (!profile.personal_room_id) {
      console.log('[join-personal-room] No personal room created');
      return json(req, { 
        error: "room_not_available", 
        message: "This personal room is not available" 
      }, 404);
    }

    // ✅ CHECK IF ROOM IS PUBLIC
    if (!profile.personal_room_public) {
      console.log('[join-personal-room] Room is private:', profile.personal_room_id);
      return json(req, { 
        error: "room_private", 
        message: "This personal room is private" 
      }, 403);
    }

    // ✅ GET ROOM DETAILS (including Daily room name)
    const { data: room, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .select("id, title, daily_room_name, status")
      .eq("id", profile.personal_room_id)
      .single();

    if (roomError || !room) {
      console.log('[join-personal-room] Room not found in database');
      return json(req, { 
        error: "room_not_found", 
        message: "Personal room not found" 
      }, 404);
    }

    // ✅ CHECK ROOM STATUS
    if (room.status === 'ended' || room.status === 'deleted') {
      return json(req, { 
        error: "room_ended", 
        message: "This room has ended" 
      }, 410);
    }

    // ✅ GENERATE TOKEN (don't expose room ID to client)
    const tokenResp = await createDailyMeetingToken({
      dailyApiKey,
      roomName: room.daily_room_name,
      userName: sanitizedGuestName,
      isOwner: false,
    });

    // ✅ AUDIT LOG
    const userAgent = req.headers.get('user-agent') || 'unknown';
    await supabaseAdmin.from("loft_room_join_logs").insert({
      room_id: room.id,
      join_type: 'personal_room_slug',
      guest_name: sanitizedGuestName,
      slug_used: sanitizedSlug,
      ip_address: clientIP,
      user_agent: userAgent,
      joined_at: new Date().toISOString(),
    }).catch(err => {
      console.error('[audit-log-error]', err);
    });

    console.log('[join-personal-room] Success for slug:', sanitizedSlug);

    // ✅ NEVER RETURN ROOM ID - only what's needed to join
    return json(req, {
      token: tokenResp.token,
      dailyRoomName: room.daily_room_name,
      roomTitle: room.title || `${profile.display_name}'s Room`,
      hostName: profile.display_name,
    });

  } catch (e) {
    console.error('[join-personal-room] Error:', e);
    return json(req, { 
      error: "unexpected_error", 
      message: "An error occurred. Please try again." 
    }, 500);
  }
});

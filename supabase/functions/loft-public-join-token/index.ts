import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { createLeaveToken } from "../_shared/loftExternalAccess.ts";

const rateLimiterMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
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

type PublicJoinTokenBody = {
  loftRoomId?: string;
  guestName?: string;
};

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function normalizeVisibility(raw: unknown): "public" | "unlisted" | "private" {
  const v = String(raw || "public").toLowerCase();
  if (v === "private") return "private";
  if (v === "unlisted") return "unlisted";
  return "public";
}

function sanitizeGuestName(name: string): string {
  return name
    .replace(/[<>"'&]/g, '')
    .substring(0, 50)
    .trim() || 'Guest';
}

function deriveDisplayName(row: any): string {
  if (!row) return 'Host';
  const emailLocal = row.email ? String(row.email).split('@')[0] : '';
  const explicitName = String(row.full_name || row.display_name || '').trim();
  const nameFromParts = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return (
    explicitName ||
    nameFromParts ||
    emailLocal ||
    'Host'
  );
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get("origin")) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  if (!checkRateLimit(clientIP)) {
    console.log(`[loft-public-join-token] Rate limit exceeded for ${clientIP}`);
    return json(req, { 
      error: "rate_limit_exceeded", 
      message: "Too many requests. Please try again in 1 minute." 
    }, 429);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[loft-public-join-token] Missing Supabase configuration');
      return json(req, { error: "server_not_configured" }, 500);
    }
    if (!dailyApiKey) {
      console.error('[loft-public-join-token] Missing Daily API key');
      return json(req, { error: "daily_not_configured" }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as PublicJoinTokenBody;
    const loftRoomId = String(body.loftRoomId || "").trim();
    
    if (!loftRoomId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(loftRoomId)) {
      console.log('[loft-public-join-token] Invalid room ID format:', loftRoomId);
      return json(req, { error: "invalid_room_id" }, 400);
    }

    const guestName = sanitizeGuestName(body.guestName || "Guest");
    const guestId = `guest-${crypto.randomUUID()}`;
    
    console.log('[loft-public-join-token] Join attempt:', {
      roomId: loftRoomId,
      guestName,
      guestId,
      clientIP,
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch room details
    const { data: room, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .select("id, daily_room_name, visibility, status, title, is_open, opened_at, host_boh_user_id")
      .eq("id", loftRoomId)
      .single();

    if (roomError || !room) {
      console.log('[loft-public-join-token] Room not found:', {
        roomId: loftRoomId,
        error: roomError,
      });
      return json(req, { error: "room_not_found" }, 404);
    }

    const visibility = normalizeVisibility(room.visibility);
    
    console.log('[loft-public-join-token] Room details:', {
      roomId: room.id,
      visibility,
      status: room.status,
      is_open: room.is_open,
      host_boh_user_id: room.host_boh_user_id,
    });

    // Only allow public and unlisted rooms for guests
    if (visibility === "private") {
      console.log('[loft-public-join-token] Rejecting private room:', room.id);
      return json(req, { 
        error: "room_is_private",
        message: "This room is private and requires an invitation" 
      }, 403);
    }

    // Check if room is open
    const isRoomOpen = room.is_open === true;
    
    if (!isRoomOpen) {
      console.log('[loft-public-join-token] Room not open yet:', {
        roomId: room.id,
        guestName,
        is_open: room.is_open,
      });
      
      return json(req, { 
        error: "room_not_open_yet", 
        message: "Waiting for host to start the session",
        roomTitle: room.title,
        roomId: room.id,
        canRetry: true,
      }, 403);
    }

    const { data: hostProfile, error: hostProfileError } = room.host_boh_user_id
      ? await supabaseAdmin
          .from("boh_user")
          .select("id, auth_user_id, first_name, last_name, full_name, display_name, email, avatar_url")
          .eq("id", room.host_boh_user_id)
          .maybeSingle()
      : { data: null, error: null };

    if (hostProfileError) {
      console.error('[loft-public-join-token] Could not fetch host BOH user:', hostProfileError);
    }

    const hostDisplayName = hostProfile ? deriveDisplayName(hostProfile) : 'Host';
    const hostAvatarUrl = hostProfile?.avatar_url || null;

    console.log('[loft-public-join-token] Room is open, generating token:', {
      roomId: room.id,
      guestName,
      guestId,
      hostDisplayName,
      dailyRoomName: room.daily_room_name,
    });

    // Generate Daily token for guest
    const tokenResp = await createDailyMeetingToken({
      dailyApiKey,
      roomName: room.daily_room_name,
      userName: guestName,
      isOwner: false,
    });

    // Audit logging
    const userAgent = req.headers.get('user-agent') || 'unknown';
    try {
      await supabaseAdmin.from("loft_room_join_logs").insert({
        room_id: loftRoomId,
        join_type: 'public_guest',
        guest_name: guestName,
        ip_address: clientIP,
        user_agent: userAgent,
        joined_at: new Date().toISOString(),
      });
      console.log('[loft-public-join-token] Guest joined successfully:', {
        roomId: loftRoomId,
        guestName,
        guestId,
      });
    } catch (logError) {
      console.error('[loft-public-join-token] Audit log error:', logError);
    }

    const leaveToken = await createLeaveToken(serviceRoleKey, {
      loftRoomId: room.id,
      guestName,
    });

    try {
      const { error: waitlistDeleteError } = await supabaseAdmin
        .from("loft_room_waitlist")
        .delete()
        .eq("loft_room_id", room.id)
        .eq("guest_name", guestName);
      if (waitlistDeleteError) {
        console.error('[loft-public-join-token] Could not clear welcomed guest request:', waitlistDeleteError);
      }
    } catch (waitlistError) {
      console.error('[loft-public-join-token] Unexpected waitlist cleanup error:', waitlistError);
    }

    return json(req, {
      dailyRoomName: room.daily_room_name,
      token: tokenResp.token,
      leaveToken,
      roomTitle: room.title,
      role: "listener",
      guestName,
      guestId,
      currentUserProfile: {
        guestId,
        displayName: guestName,
        avatarUrl: null,
        isHost: false,
      },
      // ✅ CRITICAL: Provide host details so guests can identify the host
      hostDetails: {
        profileId: null,
        bohUserId: room.host_boh_user_id || null,
        userId: hostProfile?.auth_user_id || null,
        displayName: hostDisplayName,
        avatarUrl: hostAvatarUrl,
        isHost: true,
      },
    });
  } catch (e) {
    console.error('[loft-public-join-token] Unexpected error:', e);
    return json(req, { 
      error: "unexpected_error", 
      message: "An error occurred. Please try again.",
      details: String((e as any)?.message || e),
    }, 500);
  }
});

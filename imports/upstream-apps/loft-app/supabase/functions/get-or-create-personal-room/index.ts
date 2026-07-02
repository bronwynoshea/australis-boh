import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
  });
}

async function createDailyRoom(params: {
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
      properties: {
        enable_recording: "cloud",
      },
    }),
  });

  const jsonBody = await resp.json().catch(() => ({}));

  // If the room name already exists, that's fine; we can reuse it.
  if (resp.status === 409) return { name };

  if (!resp.ok) {
    throw new Error(`daily_room_create_error_${resp.status}: ${JSON.stringify(jsonBody)}`);
  }

  return jsonBody;
}

const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateInviteCode(length = 8) {
  const characters = INVITE_CODE_ALPHABET;
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters[bytes[i] % characters.length];
  }
  return code;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get('origin')) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("jobzcafe_supabase_secret_key") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(req, { error: "server_not_configured" }, 500);
    }
    if (!dailyApiKey) {
      return json(req, { error: "daily_not_configured" }, 500);
    }

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

    if (userError || !user) {
      return json(req, { error: "not_authenticated" }, 401);
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profile")
      .select("id, display_name, full_name, first_name, last_name, personal_room_id, can_use_personal_room")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return json(req, { error: "profile_not_found" }, 404);
    }

    if (!profile.can_use_personal_room) {
      return json(req, { error: "permission_denied", message: "Personal Room is only available to internal team members" }, 403);
    }

    const profileId = String(profile.id);
    const userName = profile.display_name || profile.full_name || profile.first_name || 'Host';

    // Check if user already has a personal room
    if (profile.personal_room_id) {
      const { data: existingRoom, error: roomError } = await supabaseAdmin
        .from("loft_room")
        .select("id, title, daily_room_name, invite_code")
        .eq("id", profile.personal_room_id)
        .single();

      if (!roomError && existingRoom) {
        let inviteCode = existingRoom.invite_code || '';
        if (!inviteCode) {
          inviteCode = generateInviteCode();
          await supabaseAdmin
            .from("loft_room")
            .update({ invite_code: inviteCode, updated_at: new Date().toISOString() })
            .eq("id", existingRoom.id);
        }

        return json(req, {
          roomId: existingRoom.id,
          dailyRoomName: existingRoom.daily_room_name,
          title: existingRoom.title,
          inviteCode,
          isNew: false,
        });
      }
    }

    // Create new personal room
    const dailyRoomName = `loft-personal-${profileId}`;
    const inviteCode = generateInviteCode();

    await createDailyRoom({
      dailyApiKey,
      name: dailyRoomName,
    });

    const insertRow = {
      app_context: 'cafe',
      host_profile_id: profileId,
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
    };

    const { data: room, error: insertError } = await supabaseAdmin
      .from("loft_room")
      .insert(insertRow)
      .select("*")
      .single();

    if (insertError || !room) {
      return json(req, { error: "db_error", details: insertError }, 500);
    }

    // Update profile with personal room ID
    await supabaseAdmin
      .from("profile")
      .update({ personal_room_id: room.id })
      .eq("id", profileId);

    // Ensure host is a member
    await supabaseAdmin
      .from("loft_room_member")
      .insert({ loft_room_id: room.id, profile_id: profileId, role: "host" });

    return json(req, {
      roomId: room.id,
      dailyRoomName: room.daily_room_name,
      title: room.title,
      inviteCode,
      isNew: true,
    });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Body = {
  action?: "enable" | "disable" | "rotate_invite";
  email?: string;
  profileId?: string;
  profile_id?: string;
};

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function generateInviteCode(length = 8) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

function displayName(profile: any): string {
  return (
    profile?.display_name ||
    profile?.full_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.email ||
    "Loft member"
  );
}

async function getCallerProfile(supabaseAdmin: any, userId: string) {
  const byUserId = await supabaseAdmin
    .from("profile")
    .select("id, user_type_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (byUserId.data?.id) return byUserId.data;

  const byProfileId = await supabaseAdmin
    .from("profile")
    .select("id, user_type_id")
    .eq("id", userId)
    .maybeSingle();

  return byProfileId.data;
}

async function findTargetProfile(supabaseAdmin: any, body: Body) {
  const profileId = String(body.profileId || body.profile_id || "").trim();
  const email = String(body.email || "").trim().toLowerCase();

  const selectProfile = `
    id,
    user_id,
    email,
    display_name,
    full_name,
    first_name,
    last_name,
    can_use_personal_room,
    personal_room_id,
    personal_room_slug
  `;

  if (profileId) {
    const { data, error } = await supabaseAdmin
      .from("profile")
      .select(selectProfile)
      .eq("id", profileId)
      .maybeSingle();
    return { profile: data, error };
  }

  if (!email) return { profile: null, error: null };

  const { data, error } = await supabaseAdmin
    .from("profile")
    .select(selectProfile)
    .ilike("email", email)
    .maybeSingle();

  return { profile: data, error };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get("origin")) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(req, { error: "server_not_configured" }, 500);
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

    const callerProfile = await getCallerProfile(supabaseAdmin, user.id);
    if (!callerProfile?.id || Number(callerProfile.user_type_id) !== 5) {
      return json(req, { error: "superadmin_access_required" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action;
    if (!action || !["enable", "disable", "rotate_invite"].includes(action)) {
      return json(req, { error: "invalid_action" }, 400);
    }

    const { profile, error: profileError } = await findTargetProfile(supabaseAdmin, body);
    if (profileError) return json(req, { error: "profile_lookup_failed", details: profileError }, 500);
    if (!profile?.id) return json(req, { error: "profile_not_found" }, 404);

    if (action === "enable") {
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from("profile")
        .update({ can_use_personal_room: true, updated_at: new Date().toISOString() })
        .eq("id", profile.id)
        .select("id, email, can_use_personal_room, personal_room_id, personal_room_slug")
        .maybeSingle();

      if (updateError || !updatedProfile) {
        return json(req, { error: "enable_failed", details: updateError }, 500);
      }

      return json(req, {
        success: true,
        action,
        message: `${displayName(profile)} can now use a Personal Table.`,
        profile: updatedProfile,
      });
    }

    if (action === "disable") {
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from("profile")
        .update({ can_use_personal_room: false, updated_at: new Date().toISOString() })
        .eq("id", profile.id)
        .select("id, email, can_use_personal_room, personal_room_id, personal_room_slug")
        .maybeSingle();

      if (updateError || !updatedProfile) {
        return json(req, { error: "disable_failed", details: updateError }, 500);
      }

      return json(req, {
        success: true,
        action,
        message: `${displayName(profile)} can no longer use a Personal Table.`,
        profile: updatedProfile,
      });
    }

    if (!profile.personal_room_id) {
      return json(req, { error: "personal_table_not_created" }, 409);
    }

    const inviteCode = generateInviteCode();
    const { data: updatedRoom, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .update({ invite_code: inviteCode, updated_at: new Date().toISOString() })
      .eq("id", profile.personal_room_id)
      .select("id, invite_code")
      .maybeSingle();

    if (roomError || !updatedRoom) {
      return json(req, { error: "rotate_failed", details: roomError }, 500);
    }

    return json(req, {
      success: true,
      action,
      message: "Guest invite link rotated. Previous guest links are now invalid.",
      room: updatedRoom,
    });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

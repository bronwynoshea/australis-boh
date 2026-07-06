/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveBohLoftIdentity } from "../_shared/loftIdentity.ts";

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type Body = {
  action?: "enable" | "disable" | "rotate_invite";
  email?: string;
  userId?: string;
  bohUserId?: string;
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
  for (let i = 0; i < length; i++) code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  return code;
}

function displayName(user: any): string {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.email || "Loft member";
}

async function findTargetBohUser(supabaseAdmin: any, body: Body) {
  const bohUserId = String(body.bohUserId || "").trim();
  const authUserId = String(body.userId || "").trim();
  const email = String(body.email || "").trim().toLowerCase();

  let query = supabaseAdmin
    .from("boh_user")
    .select("id, auth_user_id, tenant_id, email, first_name, last_name")
    .limit(1);

  if (bohUserId) query = query.eq("id", bohUserId);
  else if (authUserId) query = query.eq("auth_user_id", authUserId);
  else if (email) query = query.ilike("email", email);
  else return { bohUser: null, error: null };

  const { data, error } = await query.maybeSingle();
  return { bohUser: data, error };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get("origin")) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json(req, { error: "server_not_configured" }, 500);

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
    if (userError || !user) return json(req, { error: "not_authenticated" }, 401);

    const caller = await resolveBohLoftIdentity(supabaseAdmin, user.id);
    if (Number(caller.userTypeId) !== 5 && !caller.isLoftAdmin) {
      return json(req, { error: "superadmin_access_required" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action;
    if (!action || !["enable", "disable", "rotate_invite"].includes(action)) {
      return json(req, { error: "invalid_action" }, 400);
    }

    const { bohUser, error: userLookupError } = await findTargetBohUser(supabaseAdmin, body);
    if (userLookupError) return json(req, { error: "boh_user_lookup_failed", details: userLookupError }, 500);
    if (!bohUser?.id) return json(req, { error: "boh_user_not_found" }, 404);

    const { data: room, error: roomLookupError } = await supabaseAdmin
      .from("loft_room")
      .select("id, invite_code, status")
      .eq("host_boh_user_id", bohUser.id)
      .eq("room_origin", "personal")
      .neq("status", "deleted")
      .limit(1)
      .maybeSingle();
    if (roomLookupError) return json(req, { error: "personal_table_lookup_failed", details: roomLookupError }, 500);

    if (action === "enable") {
      return json(req, {
        success: true,
        action,
        message: `${displayName(bohUser)} can create a Personal Table from Loft.`,
        bohUserId: bohUser.id,
      });
    }

    if (!room?.id) return json(req, { error: "personal_table_not_created" }, 409);

    if (action === "disable") {
      const { data: updatedRoom, error: updateError } = await supabaseAdmin
        .from("loft_room")
        .update({ status: "deleted", is_open: false, ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", room.id)
        .select("id, status")
        .maybeSingle();
      if (updateError || !updatedRoom) return json(req, { error: "disable_failed", details: updateError }, 500);
      return json(req, {
        success: true,
        action,
        message: `${displayName(bohUser)}'s Personal Table was disabled.`,
        room: updatedRoom,
      });
    }

    const inviteCode = generateInviteCode();
    const { data: updatedRoom, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .update({ invite_code: inviteCode, updated_at: new Date().toISOString() })
      .eq("id", room.id)
      .select("id, invite_code")
      .maybeSingle();

    if (roomError || !updatedRoom) return json(req, { error: "rotate_failed", details: roomError }, 500);

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

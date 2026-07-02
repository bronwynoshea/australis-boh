/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

type Body = {
  loftRoomId?: string;
  loft_room_id?: string;
};

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

    const body = (await req.json().catch(() => ({}))) as Body;
    const loftRoomId = String(body.loftRoomId || body.loft_room_id || "").trim();
    if (!loftRoomId) return json(req, { error: "missing_loft_room_id" }, 400);

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("loft_room_member")
      .select("profile_id, role")
      .eq("loft_room_id", loftRoomId);

    if (rowsError) {
      return json(req, { error: "list_failed", details: rowsError }, 500);
    }

    const profileIds = Array.from(
      new Set((rows || []).map((r: any) => String(r?.profile_id || '')).filter(Boolean))
    );

    const userIdByProfileId = new Map<string, string>();
    if (profileIds.length > 0) {
      const { data: profiles, error: profileErr } = await supabaseAdmin
        .from('profile')
        .select('id, user_id')
        .in('id', profileIds);

      if (profileErr) {
        return json(req, { error: 'profile_lookup_failed', details: profileErr }, 500);
      }

      (profiles || []).forEach((p: any) => {
        const pid = p?.id ? String(p.id) : '';
        const uid = p?.user_id ? String(p.user_id) : '';
        if (!pid || !uid) return;
        userIdByProfileId.set(pid, uid);
      });
    }

    const roles = (rows || [])
      .map((r: any) => {
        const profileId = r?.profile_id ? String(r.profile_id) : '';
        const userId = profileId ? userIdByProfileId.get(profileId) : undefined;
        return {
          profileId,
          userId,
          role: r?.role,
        };
      })
      .filter((r: any) => r.profileId && r.userId && r.role);

    return json(req, { roles });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

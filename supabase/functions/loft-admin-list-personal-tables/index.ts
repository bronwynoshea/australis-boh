/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveBohLoftIdentity } from "../_shared/loftIdentity.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function displayName(user: any): string {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.email || "Loft member";
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

    if (userError || !user) return json(req, { error: "not_authenticated" }, 401);

    const caller = await resolveBohLoftIdentity(supabaseAdmin, user.id);
    if (Number(caller.userTypeId) !== 5 && !caller.isLoftAdmin) {
      return json(req, { error: "superadmin_access_required" }, 403);
    }

    const { data: rooms, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .select("id, host_boh_user_id, title, status, is_open, invite_code, tenant_id, updated_at, created_at")
      .eq("room_origin", "personal")
      .neq("status", "deleted")
      .order("updated_at", { ascending: false });

    if (roomError) return json(req, { error: "room_lookup_failed", details: roomError }, 500);

    const hostIds = Array.from(new Set((rooms || []).map((room: any) => room.host_boh_user_id).filter(Boolean)));
    const tenantIds = Array.from(new Set((rooms || []).map((room: any) => room.tenant_id).filter(Boolean)));
    const userById = new Map<string, any>();
    const tenantSlugById = new Map<string, string>();

    if (hostIds.length > 0) {
      const { data: users, error: userLookupError } = await supabaseAdmin
        .from("boh_user")
        .select("id, auth_user_id, email, first_name, last_name, updated_at")
        .in("id", hostIds);
      if (userLookupError) return json(req, { error: "boh_user_lookup_failed", details: userLookupError }, 500);
      (users || []).forEach((bohUser: any) => {
        if (bohUser?.id) userById.set(String(bohUser.id), bohUser);
      });
    }

    if (tenantIds.length > 0) {
      const { data: tenants, error: tenantError } = await supabaseAdmin
        .from("boh_tenant")
        .select("id, slug")
        .in("id", tenantIds);
      if (tenantError) return json(req, { error: "tenant_lookup_failed", details: tenantError }, 500);
      (tenants || []).forEach((tenant: any) => {
        if (tenant?.id && tenant?.slug) tenantSlugById.set(String(tenant.id), String(tenant.slug));
      });
    }

    const personalTables = (rooms || []).map((room: any) => {
      const bohUser = room.host_boh_user_id ? userById.get(String(room.host_boh_user_id)) : null;
      return {
        userId: bohUser?.auth_user_id || null,
        bohUserId: room.host_boh_user_id || null,
        legacyProfileId: null,
        email: bohUser?.email || null,
        displayName: displayName(bohUser),
        can_use_personal_room: true,
        personal_room_id: room.id || null,
        personal_room_slug: room.invite_code || null,
        invite_code: room.invite_code || null,
        tenant_slug: room.tenant_id ? tenantSlugById.get(String(room.tenant_id)) || null : null,
        room_title: room.title || null,
        room_status: room.status || null,
        is_open: room.is_open ?? false,
        room_updated_at: room.updated_at || null,
        profile_updated_at: bohUser?.updated_at || null,
      };
    });

    return json(req, { personalTables });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

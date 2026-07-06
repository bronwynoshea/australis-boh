import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
  });
}

const cleanCode = (value: unknown) => String(value || '').trim().replace(/[^a-z0-9-_]/gi, '');
const displayHostName = (user: any, fallback = 'Host') =>
  [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || fallback;

async function getTenantId(supabaseAdmin: any, tenantSlug: string) {
  if (!tenantSlug) return null;
  const { data, error } = await supabaseAdmin.from("boh_tenant").select("id").eq("slug", tenantSlug).maybeSingle();
  if (error || !data?.id) return null;
  return data.id as string;
}

async function getTenantSlug(supabaseAdmin: any, tenantId: string | null) {
  if (!tenantId) return null;
  const { data } = await supabaseAdmin.from("boh_tenant").select("slug").eq("id", tenantId).maybeSingle();
  return data?.slug ?? null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get('origin')) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json(req, { error: "server_not_configured" }, 500);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const slug = cleanCode(body.slug);
    const tenantSlug = cleanCode(body.tenantSlug).toLowerCase();
    if (!slug) return json(req, { error: "slug_required" }, 400);

    const tenantId = await getTenantId(supabaseAdmin, tenantSlug);
    let query = supabaseAdmin
      .from("loft_room")
      .select("id, title, is_open, opened_at, invite_code, host_boh_user_id, tags, tenant_id")
      .ilike("invite_code", slug.toUpperCase())
      .eq("room_origin", "personal")
      .neq("status", "deleted")
      .limit(1);
    if (tenantId) query = query.eq("tenant_id", tenantId);

    const { data: room, error: roomError } = await query.maybeSingle();
    if (roomError || !room) return json(req, { error: "personal_room_not_found", message: "No Personal Room found with this guest link" }, 404);

    const { data: host } = room.host_boh_user_id
      ? await supabaseAdmin.from("boh_user").select("id, email, first_name, last_name").eq("id", room.host_boh_user_id).maybeSingle()
      : { data: null };
    const hostName = displayHostName(host);
    const resolvedTenantSlug = await getTenantSlug(supabaseAdmin, room.tenant_id ?? tenantId);

    return json(req, {
      roomId: room.id,
      title: room.title || `${hostName}'s Personal Table`,
      hostName,
      tenantSlug: resolvedTenantSlug,
      isOpen: room.is_open === true,
      openedAt: room.opened_at ?? null,
      inviteCode: room.invite_code ?? null,
      hostBohUserId: room.host_boh_user_id ?? null,
      hostProfileId: null,
    });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

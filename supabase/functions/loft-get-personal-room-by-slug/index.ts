import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get('origin')), "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get('origin')) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    console.log('[loft-get-personal-room-by-slug] Request received');
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SECRET_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.log('[loft-get-personal-room-by-slug] Server not configured');
      return json(req, { error: "server_not_configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('[loft-get-personal-room-by-slug] Parsing request body');
    const body = await req.json().catch((e) => {
      console.log('[loft-get-personal-room-by-slug] Failed to parse JSON:', e);
      return {};
    });
    const { slug } = body;

    console.log('[loft-get-personal-room-by-slug] Slug:', slug);

    if (!slug) {
      console.log('[loft-get-personal-room-by-slug] No slug provided');
      return json(req, { error: "slug_required" }, 400);
    }

    // Lookup profile by slug
    console.log('[loft-get-personal-room-by-slug] Looking up profile with slug:', slug);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profile")
      .select("id, display_name, personal_room_id")
      .eq("personal_room_slug", slug)
      .single();

    console.log('[loft-get-personal-room-by-slug] Profile lookup result:', { profile, profileError });

    if (profileError || !profile) {
      console.log('[loft-get-personal-room-by-slug] Profile not found');
      return json(req, { error: "personal_room_not_found", message: "No Personal Room found with this slug" }, 404);
    }

    if (!profile.personal_room_id) {
      console.log('[loft-get-personal-room-by-slug] Profile has no personal room ID');
      return json(req, { error: "personal_room_not_created", message: "This user has not created their Personal Room yet" }, 404);
    }

    // Get room details
    console.log('[loft-get-personal-room-by-slug] Looking up room:', profile.personal_room_id);
    const { data: room, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .select("id, title")
      .eq("id", profile.personal_room_id)
      .single();

    console.log('[loft-get-personal-room-by-slug] Room lookup result:', { room, roomError });

    if (roomError || !room) {
      console.log('[loft-get-personal-room-by-slug] Room not found');
      return json(req, { error: "room_not_found" }, 404);
    }

    console.log('[loft-get-personal-room-by-slug] Success, returning room:', room.id);
    return json(req, {
      roomId: room.id,
      title: room.title,
    });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

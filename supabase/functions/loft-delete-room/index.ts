import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

type DeleteRoomBody = {
  loftRoomId?: string;
};

function json(req: Request, data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(req, { error: "supabase_not_configured" }, 500);
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

    const body = (await req.json().catch(() => ({}))) as any as DeleteRoomBody;
    
    if (!body.loftRoomId) {
      return json(req, { error: "missing_room_id" }, 400);
    }

    // Get user profile
    const byUserId = await supabaseAdmin.from("profile").select("id, user_type_id, is_loft_admin").eq("user_id", user.id).maybeSingle();
    const profile = byUserId.data?.id
      ? byUserId.data
      : (await supabaseAdmin.from("profile").select("id, user_type_id, is_loft_admin").eq("id", user.id).maybeSingle()).data;

    if (!profile?.id) {
      return json(req, { error: "profile_not_found" }, 400);
    }

    // Get the room to check ownership
    const { data: room, error: roomError } = await supabaseAdmin
      .from('loft_room')
      .select('host_profile_id, status')
      .eq('id', body.loftRoomId)
      .single();

    if (roomError || !room) {
      return json(req, { error: "room_not_found" }, 404);
    }

    // Check permissions
    const isHost = room.host_profile_id === profile.id;
    const isSuperAdmin = profile.user_type_id === 5 || profile.is_loft_admin;

    if (!isHost && !isSuperAdmin) {
      return json(req, { error: "insufficient_permissions" }, 403);
    }

    // Check if room is live - don't allow deletion of live rooms
    if (room.status === 'live') {
      return json(req, { error: "cannot_delete_live_room" }, 400);
    }

    // Delete the room
    const { error: deleteError } = await supabaseAdmin
      .from('loft_room')
      .delete()
      .eq('id', body.loftRoomId);

    if (deleteError) {
      console.error('Delete room error:', deleteError);
      return json(req, { error: "delete_failed" }, 500);
    }

    return json(req, { 
      success: true,
      message: "Room deleted successfully"
    });

  } catch (error) {
    console.error('Delete room error:', error);
    return json(req, { error: "internal_error" }, 500);
  }
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveBohLoftIdentity } from "../_shared/loftIdentity.ts";

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

    const identity = await resolveBohLoftIdentity(supabaseAdmin, user.id);

    // Get the room to check ownership
    const { data: room, error: roomError } = await supabaseAdmin
      .from('loft_room')
      .select('host_boh_user_id, status')
      .eq('id', body.loftRoomId)
      .single();

    if (roomError || !room) {
      return json(req, { error: "room_not_found" }, 404);
    }

    // Check permissions
    const isHost = room.host_boh_user_id === identity.bohUserId;
    const isSuperAdmin = Number(identity.userTypeId) === 5 || identity.isLoftAdmin;

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

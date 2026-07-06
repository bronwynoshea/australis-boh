import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveBohLoftIdentity } from "../_shared/loftIdentity.ts";

type UpdateRoomBody = {
  loftRoomId?: string;
  payload?: {
    title?: string;
    description?: string;
    visibility?: string;
    isRecorded?: boolean;
    tags?: string[];
    appContext?: string;
    maxParticipants?: number;
    scheduledStartAt?: string;
    recurrence?: {
      type: string;
      endDate: string;
    };
  };
  appContext?: string;
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
      console.error('[loft_update_room] Missing Supabase configuration');
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
      console.error('[loft_update_room] Authentication error:', userError);
      return json(req, { error: "not_authenticated" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as UpdateRoomBody;
    
    console.log('[loft_update_room] Request body:', body);
    
    if (!body.loftRoomId) {
      return json(req, { error: "missing_room_id" }, 400);
    }

    if (!body.payload) {
      return json(req, { error: "missing_payload" }, 400);
    }

    const payload = body.payload;

    const identity = await resolveBohLoftIdentity(supabaseAdmin, user.id);

    // Get the room to check canonical ownership (note: singular 'loft_room')
    const { data: room, error: roomError } = await supabaseAdmin
      .from('loft_room')
      .select('host_boh_user_id, status')
      .eq('id', body.loftRoomId)
      .single();

    if (roomError) {
      console.error('[loft_update_room] Room fetch error:', roomError);
      return json(req, { error: "room_not_found", details: roomError.message }, 404);
    }

    if (!room) {
      return json(req, { error: "room_not_found" }, 404);
    }

    console.log('[loft_update_room] Room found, host:', room.host_boh_user_id);

    // Check permissions
    const isHost = room.host_boh_user_id === identity.bohUserId;
    const isSuperAdmin = Number(identity.userTypeId) === 5 || identity.isLoftAdmin;

    if (!isHost && !isSuperAdmin) {
      console.error('[loft_update_room] Insufficient permissions. isHost:', isHost, 'isSuperAdmin:', isSuperAdmin);
      return json(req, { error: "insufficient_permissions" }, 403);
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Add optional fields
    if (payload.title !== undefined) updateData.title = String(payload.title).trim();
    if (payload.description !== undefined) updateData.description = String(payload.description).trim();
    if (payload.visibility !== undefined) updateData.visibility = payload.visibility;
    if (payload.isRecorded !== undefined) updateData.is_recorded = payload.isRecorded;
    if (payload.tags !== undefined) updateData.tags = payload.tags;
    if (payload.maxParticipants !== undefined) updateData.max_participants = payload.maxParticipants;
    if (payload.scheduledStartAt !== undefined) {
      updateData.scheduled_start_at = payload.scheduledStartAt;
      
      // Only set status to scheduled if there's a future time
      // Don't change to live based on time - live status is set when someone actually joins
      const scheduledTime = new Date(payload.scheduledStartAt);
      const now = new Date();
      
      if (scheduledTime > now) {
        updateData.status = "scheduled";
        updateData.started_at = null;
      }
      // If scheduled time is in the past, don't change status - keep current status
      // Live status should only be set when someone actually joins the room
    }
    
    // Handle recurrence
    if (payload.recurrence) {
      updateData.recurrence_type = payload.recurrence.type;
      updateData.recurrence_end_date = payload.recurrence.endDate;
    } else {
      // Clear recurrence if not provided
      updateData.recurrence_type = null;
      updateData.recurrence_end_date = null;
    }

    console.log('[loft_update_room] Update data:', updateData);

    // Update the room (note: singular 'loft_room')
    const { data: updatedRoom, error: updateError } = await supabaseAdmin
      .from('loft_room')
      .update(updateData)
      .eq('id', body.loftRoomId)
      .select()
      .single();

    if (updateError) {
      console.error('[loft_update_room] Update error:', updateError);
      return json(req, { error: "update_failed", details: updateError.message }, 500);
    }

    console.log('[loft_update_room] Room updated successfully:', updatedRoom.id);

    return json(req, { 
      success: true, 
      room: updatedRoom,
      id: updatedRoom.id
    });

  } catch (error: any) {
    console.error('[loft_update_room] Unexpected error:', error);
    return json(req, { error: "internal_error", details: error.message }, 500);
  }
});

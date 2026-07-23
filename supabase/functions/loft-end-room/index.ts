/// <reference path="../../../deno-edge.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveBohLoftIdentity } from "../_shared/loftIdentity.ts";

type Body = {
  loftRoomId?: string;
  roomId?: string;
  loft_room_id?: string;
};

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get("origin")) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

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
    const loftRoomId = String(body.loftRoomId || body.roomId || body.loft_room_id || "").trim();
    if (!loftRoomId) return json(req, { error: "missing_loft_room_id" }, 400);

    const identity = await resolveBohLoftIdentity(supabaseAdmin, user.id);

    // Get room details including recording status and daily room name
    const { data: room, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .select("id, host_boh_user_id, status, tags, daily_room_name, is_recorded, room_origin")
      .eq("id", loftRoomId)
      .single();

    if (roomError || !room?.id) {
      return json(req, { error: "room_not_found" }, 404);
    }

    if (room.host_boh_user_id !== identity.bohUserId) {
      return json(req, { error: "not_owner" }, 403);
    }

    // Personal Rooms should close but not end (they're reusable). Some older personal
    // rooms may not have the tag; canonical host checks above protect ownership.
    const hasPersonalRoomTag = Array.isArray(room.tags) && room.tags.includes('personal-room');
    const isPersonalRoom = hasPersonalRoomTag || room.room_origin === 'personal';

    const clearWaitlist = async () => {
      const { error: waitlistError } = await supabaseAdmin
        .from("loft_room_waitlist")
        .delete()
        .eq("loft_room_id", loftRoomId);

      if (waitlistError) {
        console.error('[loft-end-room] Failed to clear guest requests:', waitlistError);
        return waitlistError;
      }

      return null;
    };
    
    if (isPersonalRoom) {
      // Personal rooms just close (reusable)
      const updates = { is_open: false };
      
      const { error: updateError } = await supabaseAdmin
        .from("loft_room")
        .update(updates)
        .eq("id", loftRoomId);

      if (updateError) {
        return json(req, { error: "room_end_failed", details: updateError }, 500);
      }

      const waitlistError = await clearWaitlist();

      if (waitlistError) {
        return json(req, { error: "waitlist_clear_failed", details: waitlistError }, 500);
      }

      return json(req, { success: true, message: "Personal room closed" });
    }

    // For Loft rooms: end now and schedule deletion in 5 days if recorded
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    
    const updates = {
      status: "ended", 
      ended_at: new Date().toISOString(), 
      is_open: false,
      // Only schedule deletion if room was recorded
      ...(room.is_recorded && { scheduled_delete_at: fiveDaysFromNow.toISOString() })
    };

    const { error: updateError } = await supabaseAdmin
      .from("loft_room")
      .update(updates)
      .eq("id", loftRoomId);

    if (updateError) {
      return json(req, { error: "room_end_failed", details: updateError }, 500);
    }

    const waitlistError = await clearWaitlist();
    if (waitlistError) {
      return json(req, { error: "waitlist_clear_failed", details: waitlistError }, 500);
    }

    // Optional: Delete Daily.co room immediately (recordings are preserved)
    if (dailyApiKey && room.daily_room_name) {
      try {
        const dailyResponse = await fetch(`https://api.daily.co/v1/rooms/${room.daily_room_name}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${dailyApiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!dailyResponse.ok) {
          console.error('Failed to delete Daily.co room:', dailyResponse.status);
          // Don't fail the whole operation if Daily deletion fails
        } else {
          console.log(`Successfully deleted Daily.co room: ${room.daily_room_name}`);
        }
      } catch (error) {
        console.error('Error deleting Daily.co room:', error);
        // Don't fail the whole operation
      }
    }

    return json(req, { 
      success: true, 
      message: room.is_recorded 
        ? `Loft room ended. Scheduled for deletion in 5 days due to recording.`
        : `Loft room ended.`
    });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

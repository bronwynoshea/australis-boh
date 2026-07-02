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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get("origin")) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json(req, { error: "server_not_configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get rooms scheduled for deletion (delete time has passed)
    const { data: roomsToDelete, error: fetchError } = await supabaseAdmin
      .from("loft_room")
      .select("id, daily_room_name, title, scheduled_delete_at")
      .lte("scheduled_delete_at", new Date().toISOString())
      .eq("status", "ended");

    if (fetchError) {
      console.error("Error fetching rooms for deletion:", fetchError);
      return json(req, { error: "fetch_failed", details: fetchError }, 500);
    }

    if (!roomsToDelete || roomsToDelete.length === 0) {
      return json(req, { success: true, message: "No rooms scheduled for deletion", deletedCount: 0 });
    }

    console.log(`Found ${roomsToDelete.length} rooms to delete`);

    let deletedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const room of roomsToDelete) {
      try {
        // Delete from database first
        const { error: deleteError } = await supabaseAdmin
          .from("loft_room")
          .delete()
          .eq("id", room.id);

        if (deleteError) {
          throw deleteError;
        }

        // Also delete Daily.co room if it still exists and API key is available
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
              console.warn(`Daily.co room ${room.daily_room_name} may already be deleted or inaccessible: ${dailyResponse.status}`);
            } else {
              console.log(`Successfully deleted Daily.co room: ${room.daily_room_name}`);
            }
          } catch (dailyError) {
            console.warn(`Failed to delete Daily.co room ${room.daily_room_name}:`, dailyError);
            // Don't fail the whole operation
          }
        }

        deletedCount++;
        console.log(`Deleted room: ${room.title || room.id} (scheduled: ${room.scheduled_delete_at})`);

      } catch (error) {
        failedCount++;
        const errorMsg = `Failed to delete room ${room.id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return json(req, {
      success: true,
      message: `Cleanup completed. Deleted: ${deletedCount}, Failed: ${failedCount}`,
      deletedCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (e) {
    console.error("Cleanup function error:", e);
    return json(req, { 
      error: "unexpected_error", 
      details: String((e as any)?.message || e) 
    }, 500);
  }
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

type CreateRoomBody = {
  payload?: {
    title?: string;
    description?: string;
    visibility?: string;
    isRecorded?: boolean;
    tags?: string[];
    scheduledStartAt?: string;
    scheduledTz?: string;
    appContext?: string;
    maxParticipants?: number;
  };
  appContext?: string;
};

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
  });
}

function normalizeAppContext(raw: unknown): string {
  const v = String(raw || "cafe").toLowerCase();
  if (v === "journey" || v === "coach" || v === "mentor" || v === "cafe") return v;
  return "cafe";
}

async function createDailyRoom(params: {
  dailyApiKey: string;
  name: string;
  maxParticipants?: number;
}) {
  const { dailyApiKey, name, maxParticipants } = params;

  const resp = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dailyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        max_participants: typeof maxParticipants === "number" ? maxParticipants : undefined,
      },
    }),
  });

  const jsonBody = await resp.json().catch(() => ({}));

  // If the room name already exists, that's fine; we can reuse it.
  if (resp.status === 409) return { name };

  if (!resp.ok) {
    throw new Error(`daily_room_create_error_${resp.status}: ${JSON.stringify(jsonBody)}`);
  }

  return jsonBody;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req.headers.get("origin")) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const dailyApiKey = Deno.env.get("DAILY_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json(req, { error: "server_not_configured" }, 500);
    }
    if (!dailyApiKey) {
      return json(req, { error: "daily_not_configured" }, 500);
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

    const body = (await req.json().catch(() => ({}))) as any as CreateRoomBody;
    // Support both request shapes:
    // 1) { payload: {...}, appContext?: string }
    // 2) legacy: { title, description, ... }
    const payload = (body as any)?.payload ? (body as any).payload : (body as any);

    const title = String(payload.title || "").trim();
    if (!title) return json(req, { error: "missing_title" }, 400);

    const appContext = normalizeAppContext((body as any)?.appContext ?? (payload as any)?.appContext);

    const byUserId = await supabaseAdmin.from("profile").select("id").eq("user_id", user.id).maybeSingle();
    const profile = byUserId.data?.id
      ? byUserId.data
      : (await supabaseAdmin.from("profile").select("id").eq("id", user.id).maybeSingle()).data;

    if (!profile?.id) {
      return json(req, { error: "profile_not_found" }, 400);
    }

    const dailyRoomName = `loft-${appContext}-${crypto.randomUUID()}`;

    await createDailyRoom({
      dailyApiKey,
      name: dailyRoomName,
      maxParticipants: typeof payload.maxParticipants === "number" ? payload.maxParticipants : undefined,
    });

    const scheduledStartAt = payload.scheduledStartAt ? String(payload.scheduledStartAt) : null;
    const isImmediate = !scheduledStartAt;

    const recurrence = (payload as any)?.recurrence;
    const hasRecurrence = recurrence && recurrence.type && recurrence.endDate;

    const insertRow = {
      app_context: appContext,
      host_profile_id: profile.id,
      title,
      description: String(payload.description || ""),
      visibility: String(payload.visibility || "public"),
      is_recorded: !!payload.isRecorded,
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      scheduled_start_at: scheduledStartAt,
      scheduled_tz: payload.scheduledTz ? String(payload.scheduledTz) : "UTC",
      max_participants: typeof payload.maxParticipants === "number" ? payload.maxParticipants : null,
      daily_room_name: dailyRoomName,
      status: isImmediate ? "live" : "scheduled",
      started_at: isImmediate ? new Date().toISOString() : null,
      recurrence_type: hasRecurrence ? String(recurrence.type) : null,
      recurrence_end_date: hasRecurrence ? String(recurrence.endDate) : null,
      recurrence_parent_id: null,
    };

    const { data: room, error: insertError } = await supabaseAdmin
      .from("loft_room")
      .insert(insertRow)
      .select("*")
      .single();

    if (insertError || !room) {
      const code = (insertError as any)?.code;
      return json(req, { error: "db_error", code, details: insertError }, 500);
    }

    // Ensure host is a member as well
    await supabaseAdmin
      .from("loft_room_member")
      .insert({ loft_room_id: room.id, profile_id: profile.id, role: "host" });

    // Create recurring instances if needed
    if (hasRecurrence && scheduledStartAt) {
      const startDate = new Date(scheduledStartAt);
      const endDate = new Date(recurrence.endDate);
      const recurrenceType = String(recurrence.type);
      const instances: any[] = [];

      // Preserve the original time components
      const originalHours = startDate.getUTCHours();
      const originalMinutes = startDate.getUTCMinutes();
      const originalSeconds = startDate.getUTCSeconds();
      const originalMilliseconds = startDate.getUTCMilliseconds();

      let currentDate = new Date(startDate);
      const increment = recurrenceType === 'daily' ? 1 : 7;

      // Generate instances (limit to 100 to prevent abuse)
      let count = 0;
      while (currentDate <= endDate && count < 100) {
        // Skip the first instance (already created as parent)
        if (count > 0) {
          const instanceDailyRoomName = `loft-${appContext}-${crypto.randomUUID()}`;
          
          await createDailyRoom({
            dailyApiKey,
            name: instanceDailyRoomName,
            maxParticipants: typeof payload.maxParticipants === "number" ? payload.maxParticipants : undefined,
          });

          instances.push({
            app_context: appContext,
            host_profile_id: profile.id,
            title,
            description: String(payload.description || ""),
            visibility: String(payload.visibility || "public"),
            is_recorded: !!payload.isRecorded,
            tags: Array.isArray(payload.tags) ? payload.tags : [],
            scheduled_start_at: currentDate.toISOString(),
            scheduled_tz: payload.scheduledTz ? String(payload.scheduledTz) : "UTC",
            max_participants: typeof payload.maxParticipants === "number" ? payload.maxParticipants : null,
            daily_room_name: instanceDailyRoomName,
            status: "scheduled",
            started_at: null,
            recurrence_type: recurrenceType,
            recurrence_end_date: recurrence.endDate,
            recurrence_parent_id: room.id,
          });
        }

        // Increment the date while preserving the original time
        currentDate = new Date(currentDate);
        currentDate.setUTCDate(currentDate.getUTCDate() + increment);
        currentDate.setUTCHours(originalHours, originalMinutes, originalSeconds, originalMilliseconds);
        count++;
      }

      // Batch insert all recurring instances
      if (instances.length > 0) {
        const { data: recurringRooms } = await supabaseAdmin
          .from("loft_room")
          .insert(instances)
          .select("id");

        // Add host as member to all recurring instances
        if (recurringRooms && recurringRooms.length > 0) {
          const memberInserts = recurringRooms.map(r => ({
            loft_room_id: r.id,
            profile_id: profile.id,
            role: "host"
          }));
          await supabaseAdmin.from("loft_room_member").insert(memberInserts);
        }
      }
    }

    return json(req, { room });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

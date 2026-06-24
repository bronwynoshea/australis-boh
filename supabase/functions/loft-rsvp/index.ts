import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { corsHeaders } from "../_shared/cors.ts";

type RsvpBody = {
  roomId?: string;
  loftRoomId?: string;
  loft_room_id?: string;
  appContext?: string;
  status?: string;
  question?: string;
  question_text?: string;
  isAnonymous?: boolean;
  is_anonymous?: boolean;
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

    const body = (await req.json().catch(() => ({}))) as RsvpBody;

    const loftRoomId = String(body.roomId || body.loftRoomId || body.loft_room_id || "").trim();
    if (!loftRoomId) return json(req, { error: "missing_loft_room_id" }, 400);

    const appContext = normalizeAppContext(body.appContext);

    const questionText = String(body.question_text || body.question || "").trim();
    const isAnonymous = !!(body.is_anonymous ?? body.isAnonymous);
    const statusRaw = String(body.status || "going").toLowerCase();
    const status = statusRaw === "cancelled" ? "cancelled" : "going";

    // Resolve caller profile
    const byUserId = await supabaseAdmin.from("profile").select("id").eq("user_id", user.id).maybeSingle();
    const profile = byUserId.data?.id
      ? byUserId.data
      : (await supabaseAdmin.from("profile").select("id").eq("id", user.id).maybeSingle()).data;

    if (!profile?.id) {
      return json(req, { error: "profile_not_found" }, 400);
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from("loft_room")
      .select("id, app_context, host_profile_id, visibility")
      .eq("id", loftRoomId)
      .eq("app_context", appContext)
      .single();

    if (roomError || !room) {
      return json(req, { error: "room_not_found", details: roomError }, 404);
    }

    const isOwner = profile.id === room.host_profile_id;

    if (isOwner) {
      return json(req, { error: "host_cannot_rsvp" }, 400);
    }

    if (!isOwner && String((room as any)?.visibility || "").toLowerCase() === "private") {
      const { data: member, error: memberError } = await supabaseAdmin
        .from("loft_room_member")
        .select("id")
        .eq("loft_room_id", room.id)
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (memberError) {
        return json(req, { error: "member_lookup_failed", details: memberError }, 500);
      }

      if (!member) {
        return json(req, { error: "not_invited" }, 403);
      }
    }

    // Persist RSVP state (canonical)
    const { error: rsvpError } = await supabaseAdmin
      .from("loft_room_rsvp")
      .upsert(
        {
          loft_room_id: loftRoomId,
          profile_id: profile.id,
          status,
        },
        { onConflict: "loft_room_id,profile_id" },
      );

    if (rsvpError) {
      return json(req, { error: "rsvp_upsert_failed", details: rsvpError }, 500);
    }

    // Keep membership for access control (especially private rooms)
    if (status === "going") {
      const { error: memberError } = await supabaseAdmin
        .from("loft_room_member")
        .insert({
          loft_room_id: loftRoomId,
          profile_id: profile.id,
          role: "listener",
        });

      if (memberError) {
        const code = (memberError as any)?.code;
        // tolerate duplicates
        if (code !== "23505") {
          return json(req, { error: "member_insert_failed", code, details: memberError }, 500);
        }
      }
    } else {
      // On cancel, remove listener membership so the UI (which uses membership as RSVP signal)
      // reflects the cancellation.
      const { error: memberDeleteError } = await supabaseAdmin
        .from("loft_room_member")
        .delete()
        .eq("loft_room_id", loftRoomId)
        .eq("profile_id", profile.id)
        .eq("role", "listener");

      if (memberDeleteError) {
        return json(req, { error: "member_delete_failed", details: memberDeleteError }, 500);
      }
    }

    // Optional question (as RSVP question)
    if (status === "going" && questionText) {
      const { error: qError } = await supabaseAdmin
        .from("loft_question")
        .insert({
          app_context: room.app_context,
          loft_room_id: loftRoomId,
          asker_profile_id: profile.id,
          is_anonymous: isAnonymous,
          source: "rsvp",
          question_text: questionText,
          status: "pending",
        });

      if (qError) {
        return json(req, { error: "question_insert_failed", details: qError }, 500);
      }
    }

    return json(req, { success: true });
  } catch (e) {
    return json(req, { error: "unexpected_error", details: String((e as any)?.message || e) }, 500);
  }
});

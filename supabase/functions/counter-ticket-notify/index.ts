// REFACTORED: Uses shared auth, CORS, and response helpers
// @ts-nocheck

import { requireUser } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, badRequest } from "../_shared/responses.ts";

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  // Authenticate user (shared helper)
  const auth = await requireUser(req);
  if (!auth.success) {
    console.error("[counter-ticket-notify] Auth failed:", auth.error);
    return jsonResponse(req, { error: auth.error }, auth.status);
  }

  const { context, serviceClient } = auth;
  const bohUserId = context.bohUser?.id;

  if (!bohUserId) {
    return jsonResponse(req, { error: "User not found in BOH system" }, 404);
  }

  try {
    const body = await req.json();
    const { ticketId, message, recipients } = body;

    if (!ticketId || !message || !recipients?.length) {
      return badRequest(req, "Missing required fields: ticketId, message, recipients");
    }

    // Store notification record
    const { data: notification, error: notificationError } = await serviceClient
      .from("counter_ticket_notification")
      .insert({
        ticket_id: ticketId,
        message,
        recipients,
        created_by: bohUserId,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (notificationError) {
      console.error("[counter-ticket-notify] Failed to create notification", notificationError);
      return jsonResponse(req, { error: "Failed to create notification" }, 500);
    }

    return jsonResponse(req, { notification }, 200);
  } catch (error) {
    console.error("[counter-ticket-notify] Unexpected error", error);
    return jsonResponse(req, { error: "Unexpected server error" }, 500);
  }
});

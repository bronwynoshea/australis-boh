// supabase/functions/boh-resend-invite/index.ts
// NOTE: This file runs in Supabase's Deno Edge Function environment, not in the
// Vite/TypeScript build. We disable TS checking locally to avoid false errors
// for Deno globals and jsr imports.
// REFACTORED: Uses shared auth, CORS, and response helpers
// @ts-nocheck

import { requireAdmin } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, successResponse, errorResponse, badRequest } from "../_shared/responses.ts";

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse(req, "Method not allowed", 405);
  }

  // Authenticate and authorize admin (shared helper)
  const auth = await requireAdmin(req);
  if (!auth.success) {
    console.error("[boh-resend-invite] Admin auth failed:", auth.error);
    return jsonResponse(req, { success: false, error: auth.error }, auth.status);
  }

  const { context, serviceClient: supabaseAdmin } = auth;
  console.log("[boh-resend-invite] Admin resending invite:", context.authUser.email);

  // -----------------------------
  // 1) Parse and validate payload
  // -----------------------------
  let body:
    | {
        inviteId: string;
        email: string;
        token: string;
        role_hint?: string;
        apps?: string[] | null;
      }
    | undefined;

  try {
    body = await req.json();
  } catch (_err) {
    console.error("[boh-resend-invite] Invalid JSON body");
    return badRequest(req, "Invalid JSON body");
  }

  const { inviteId, email, token, role_hint, apps } = body ?? {};

  if (!inviteId || !email || !token) {
    return badRequest(req, "Missing required fields: inviteId, email, token");
  }

  // -----------------------------
  // 2) Proceed with admin context
  // -----------------------------
  // 3) Verify the invite exists and is pending
  // -----------------------------
  console.log("[boh-resend-invite] Looking for invite:", inviteId);
  
  const { data: existingInvite, error: inviteCheckError } = await supabaseAdmin
    .from("boh_invite")
    .select("*")
    .eq("id", inviteId)
    .single();

  console.log("[boh-resend-invite] Invite lookup result:", { existingInvite, inviteCheckError });

  if (inviteCheckError || !existingInvite) {
    console.error("[boh-resend-invite] Invite not found:", inviteCheckError);
    return errorResponse(req, "Invite not found", 404);
  }

  if (existingInvite.status !== "pending") {
    console.log("[boh-resend-invite] Invite status:", existingInvite.status);
    return badRequest(req, "Invite is not pending");
  }

  // -----------------------------
  // 4) Handle resending - user already exists in Auth
  // -----------------------------
  // Since the user already exists in Auth (email_exists error),
  // we just need to update the invite and return the existing token
  console.log("[boh-resend-invite] User already exists in Auth, updating invite timestamp");

  // Update the invite's last_sent_at timestamp
  const { error: updateError } = await supabaseAdmin
    .from("boh_invite")
    .update({ 
      last_sent_at: new Date().toISOString()
    })
    .eq("id", inviteId);

  if (updateError) {
    console.error("[boh-resend-invite] Error updating invite:", updateError);
    return errorResponse(req, "Error updating invite", 500);
  }

  // Return the existing invite link for the frontend to handle
  const inviteLink = `https://boh.jobzcafe.com/boh/accept-invite?token=${existingInvite.token}`;
  
  return successResponse(req, { 
    message: "Invite link updated successfully",
    inviteLink: inviteLink
  });
});

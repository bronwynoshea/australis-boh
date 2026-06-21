// supabase/functions/boh-create-invite/index.ts
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
    console.error("[boh-create-invite] Admin auth failed:", auth.error);
    return jsonResponse(req, { success: false, error: auth.error }, auth.status);
  }

  const { context, serviceClient: supabaseAdmin } = auth;
  console.log("[boh-create-invite] Admin creating invite:", context.authUser.email);

  // -----------------------------
  // 1) Parse and validate payload
  // -----------------------------
  let body:
    | {
        email: string;
        role_hint?: string;
        apps?: string[] | null;
        expires_in_days?: number;
        first_name?: string | null;
        last_name?: string | null;
        full_name?: string | null;
      }
    | undefined;

  try {
    body = await req.json();
  } catch (_err) {
    console.error("[boh-create-invite] Invalid JSON body");
    return badRequest(req, "Invalid JSON body");
  }

  const {
    email,
    role_hint = "staff",
    apps = [],
    expires_in_days = 7,
    first_name: rawFirstName,
    last_name: rawLastName,
    full_name: rawFullName,
  } = body ?? {};

  if (!email) {
    return badRequest(req, "Missing email");
  }

  // Derive first/last name from provided fields (if any)
  let inviteFirstName: string | null = rawFirstName ?? null;
  let inviteLastName: string | null = rawLastName ?? null;

  if ((!inviteFirstName || !inviteLastName) && rawFullName) {
    const trimmed = String(rawFullName).trim();
    if (trimmed.length > 0) {
      const parts = trimmed.split(/\s+/);
      const first = parts[0] ?? "";
      const last = parts.slice(1).join(" ");

      if (!inviteFirstName && first) inviteFirstName = first;
      if (!inviteLastName && last) inviteLastName = last || null;
    }
  }

  // -----------------------------
  // 2) Get inviter details from auth context
  // 3) Create invite row in boh_invite
  // -----------------------------
  const token = crypto.randomUUID();
  const expires_at = new Date(
    Date.now() + expires_in_days * 86400000,
  ).toISOString();

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("boh_invite")
    .insert({
      email,
      invited_by: context.bohUser?.id,
      role_hint,
      apps,
      first_name: inviteFirstName,
      last_name: inviteLastName,
      token,
      status: "pending",
      expires_at,
      app_context: "boh",
    })
    .select()
    .single();

  if (inviteError) {
    console.error(
      "[boh-create-invite] boh_invite insert error:",
      inviteError,
    );
    return errorResponse(req, inviteError.message, 400);
  }

  // -------------------------------------
  // 5) Trigger Supabase Auth invite email
  // -------------------------------------
  const { error: authInviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      // This is where the invited person lands, with the token we generated
      redirectTo: `https://boh.jobzcafe.com/boh/accept-invite?token=${token}`,
      data: {
        role_hint,
        apps,
        boh_invite_id: invite.id,
      },
    });

  if (authInviteError) {
    console.error(
      "[boh-create-invite] auth.admin.inviteUserByEmail error:",
      authInviteError,
    );
    return errorResponse(req, authInviteError.message, 500);
  }

  // -------------------------------------
  // 6) (Optional) Sync to Patron as employee prospect
  // -------------------------------------
  try {
    const { error: patronError } = await supabaseAdmin.functions.invoke(
      "patron-sync",
      {
        body: {
          email,
          first_name: inviteFirstName ?? null,
          last_name: inviteLastName ?? null,
          source: "boh_invite_created",
          lifecycle: "employee",
        },
      },
    );

    if (patronError) {
      console.error("[boh-create-invite] patron-sync error:", patronError);
      // Do NOT fail the invite if Patron sync fails
    }
  } catch (err) {
    console.error(
      "[boh-create-invite] patron-sync unexpected error:",
      err,
    );
  }

  // -------------------------------
  // 7) Return invite row to frontend
  // -------------------------------
  return successResponse(req, invite);
});

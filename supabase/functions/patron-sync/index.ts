// @ts-nocheck
// patron-sync (BOH) – email-based upsert into public.patron
// REFACTORED: Uses shared auth, CORS, and response helpers
//
// Behaviours / callers:
// 1) BOH invite flows:
//    - boh-create-invite: { email, first_name?, last_name?, source, lifecycle }
//    - boh-accept-invite: { email, first_name?, last_name?, source, lifecycle }
// 2) Other trusted clients (JOBZ CAFE app, marketing site, etc.) may call with
//    { email, source?, lifecycle? } and no name fields.
//
// Behaviour:
// - Uses EMAIL as the key into public.patron
// - If patron exists: update email/source/lifecycle, and only update names when
//   non-empty values are provided (never overwrite existing names with null/empty).
// - If not: insert a new patron row.
//
// SECURITY: Uses shared requireUser helper for JWT validation

import { requireUser } from "../_shared/auth.ts";
import { handleCors } from "../_shared/cors.ts";
import { jsonResponse, badRequest } from "../_shared/responses.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== "POST") {
      return jsonResponse(req, { error: "Method not allowed" }, 405);
    }

    // Authenticate user (shared helper)
    const auth = await requireUser(req);
    if (!auth.success) {
      console.error("[patron-sync] Auth failed:", auth.error);
      return jsonResponse(req, { error: auth.error }, auth.status);
    }

    const { serviceClient: adminClient } = auth;


    // -------------------------
    // 1. Read body (email is required)
    // -------------------------
    const body = (await req.json().catch(() => null)) || {};
    const rawEmail = body?.email ? String(body.email).trim() : "";
    const email = rawEmail.toLowerCase();


    if (!email) {
      console.warn("[patron-sync] Email missing in request body", { body });
      return badRequest(req, "Email is required");
    }


    // Optional name + metadata fields
    const rawFirstName = body?.first_name;
    const rawLastName = body?.last_name;
    const first_name =
      typeof rawFirstName === "string" ? rawFirstName.trim() : "";
    const last_name = typeof rawLastName === "string" ? rawLastName.trim() : "";


    const source = body?.source ? String(body.source).trim() : null;
    const lifecycle = body?.lifecycle
      ? String(body.lifecycle).trim().toLowerCase()
      : null;


    console.log("[patron-sync] incoming", {
      email,
      hasFirstName: !!first_name,
      hasLastName: !!last_name,
      hasLifecycle: !!lifecycle,
      source,
    });


    // -------------------------
    // 2. Lookup existing patron by email
    // -------------------------
    const { data: existing, error: lookupError } = await adminClient
      .from("patron")
      .select("id, email, first_name, last_name, lifecycle, source")
      .ilike("email", email)
      .maybeSingle();


    if (lookupError && lookupError.code !== "PGRST116") {
      console.error("[patron-sync] lookup error", lookupError);
      return jsonResponse(req, { error: "Failed to lookup patron" }, 500);
    }


    // -------------------------
    // 3. Build changes
    // -------------------------
    const basePatch: any = {
      email,
    };


    if (source) {
      basePatch.source = source;
    }


    if (lifecycle) {
      basePatch.lifecycle = lifecycle;
    }


    // Only update names when non-empty strings are provided
    if (first_name) {
      basePatch.first_name = first_name;
    }


    if (last_name) {
      basePatch.last_name = last_name;
    }


    // -------------------------
    // 4. Upsert into public.patron
    // -------------------------
    if (existing) {
      const { error: updateError } = await adminClient
        .from("patron")
        .update(basePatch)
        .eq("id", existing.id);


      if (updateError) {
        console.error("[patron-sync] update error", updateError);
        return jsonResponse(req, { error: "Failed to update patron" }, 500);
      }
    } else {
      const { error: insertError } = await adminClient
        .from("patron")
        .insert(basePatch);


      if (insertError) {
        console.error("[patron-sync] insert error", insertError);
        return jsonResponse(req, { error: "Failed to create patron" }, 500);
      }
    }


    // -------------------------
    // 5. Success
    // -------------------------
    return jsonResponse(req, { status: "ok" }, 200);
  } catch (err) {
    console.error("[patron-sync] unexpected error", err);
    return jsonResponse(
      req,
      {
        error: "Unexpected error",
        message: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});

// Quick dev testing notes (manual):
// - From BOH UI, create an invite with first_name + last_name and email.
//   -> boh-create-invite should call patron-sync with those fields and
//      create public.patron row with email, first_name, last_name,
//      lifecycle = "employee".
// - Accept the invite as that user.
//   -> boh-accept-invite re-calls patron-sync with best-available names
//      (from auth metadata or boh_invite) and should backfill names on
//      existing patrons that were missing them.
// - In Supabase dashboard (BOH project), verify public.patron now has
//   populated name fields for that email after invite creation/acceptance.

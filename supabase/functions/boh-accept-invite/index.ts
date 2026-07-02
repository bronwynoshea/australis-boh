// supabase/functions/boh-accept-invite/index.ts
// NOTE: This runs inside Supabase's Deno Edge Function environment.
// @ts-nocheck

import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://boh.jobzcafe.com",
  "https://jobzcafe.com",
  "https://www.jobzcafe.com",
];

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SB_PUBLISHABLE_KEY");
  const secretKey = Deno.env.get("SB_SECRET_KEY");

  if (!supabaseUrl || !publishableKey || !secretKey) {
    console.error("[boh-accept-invite] Missing Supabase env vars");
    return new Response("Server misconfiguration", { status: 500, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });

  let token: string | undefined;
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token : undefined;
  } catch (error) {
    console.error("[boh-accept-invite] Invalid JSON body", error);
  }

  if (!token) {
    return new Response("Missing token", { status: 400, headers: corsHeaders });
  }

  const { data: invite, error: inviteError } = await admin
    .from("boh_invite")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .eq("app_context", "boh")
    .single();

  if (inviteError || !invite) {
    return new Response("Invalid or expired invite", { status: 400, headers: corsHeaders });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return new Response("Invite expired", { status: 400, headers: corsHeaders });
  }

  const inviteTenantId = invite.tenant_id as string | null;
  if (!inviteTenantId) {
    console.error("[boh-accept-invite] Invite is missing tenant_id", invite.id);
    return new Response("Invite is missing tenant context", { status: 500, headers: corsHeaders });
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const { data: roleRow, error: roleLookupError } = await resolveRole(admin, invite.role_hint);
  if (roleLookupError) {
    console.error("[boh-accept-invite] Role lookup error", roleLookupError);
    return new Response("Unable to resolve role", { status: 500, headers: corsHeaders });
  }
  if (!roleRow) {
    return new Response("Invite role is invalid", { status: 400, headers: corsHeaders });
  }

  const {
    data: existingUser,
    error: existingUserError,
  } = await admin
    .from("boh_user")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("tenant_id", inviteTenantId)
    .eq("app_context", "boh")
    .maybeSingle();

  if (existingUserError) {
    console.error("[boh-accept-invite] boh_user lookup error", existingUserError);
    return new Response(existingUserError.message, { status: 500, headers: corsHeaders });
  }

  const names = deriveNames(user, invite);
  let bohUserId = existingUser?.id ?? null;

  if (!existingUser) {
    const fullNameFallback = names.full ?? buildFullName(names.first, names.last) ?? invite.email ?? user.email ?? "";
    const { data: newUser, error: newUserError } = await admin
      .from("boh_user")
      .insert({
        auth_user_id: user.id,
        email: user.email,
        first_name: names.first ?? null,
        last_name: names.last ?? null,
        full_name: fullNameFallback,
        status: "active",
        primary_role_hint: roleRow.code,
        tenant_id: inviteTenantId,
        app_context: "boh",
      })
      .select()
      .single();

    if (newUserError || !newUser) {
      console.error("[boh-accept-invite] Failed to create boh_user", newUserError);
      return new Response(newUserError?.message ?? "Failed to create BOH user", {
        status: 500,
        headers: corsHeaders,
      });
    }

    bohUserId = newUser.id;
  } else if (bohUserId) {
    const updatePayload: Record<string, string | null> = {
      status: "active",
      primary_role_hint: roleRow.code,
    } as Record<string, string | null>;

    if (names.first && names.first !== existingUser.first_name) {
      updatePayload.first_name = names.first;
    }
    if (names.last && names.last !== existingUser.last_name) {
      updatePayload.last_name = names.last;
    }
    if (names.full && names.full !== existingUser.full_name) {
      updatePayload.full_name = names.full;
    }

    const { error: updateUserError } = await admin
      .from("boh_user")
      .update(updatePayload)
      .eq("id", bohUserId)
      .eq("tenant_id", inviteTenantId);

    if (updateUserError) {
      console.error("[boh-accept-invite] Failed to update boh_user", updateUserError);
      return new Response(updateUserError.message, { status: 500, headers: corsHeaders });
    }
  }

  if (!bohUserId) {
    return new Response("Unable to resolve BOH user", { status: 500, headers: corsHeaders });
  }

  try {
    await ensureRoleAssignment(admin, bohUserId, roleRow.id, inviteTenantId);
  } catch (roleAssignError) {
    console.error("[boh-accept-invite] Role assignment error", roleAssignError);
    return new Response("Failed to assign role", { status: 500, headers: corsHeaders });
  }

  try {
    await applyAppGrants(admin, bohUserId, invite.apps ?? [], roleRow.code === "super_admin", inviteTenantId);
  } catch (appGrantError) {
    console.error("[boh-accept-invite] App grant error", appGrantError);
    return new Response("Failed to assign app access", { status: 500, headers: corsHeaders });
  }

  const nowIso = new Date().toISOString();
  const { error: updateInviteError } = await admin
    .from("boh_invite")
    .update({
      status: "accepted",
      invited_user_id: bohUserId,
      accepted_at: nowIso,
    })
    .eq("id", invite.id)
    .eq("tenant_id", inviteTenantId);

  if (updateInviteError) {
    console.error("[boh-accept-invite] Failed to update invite", updateInviteError);
    return new Response("Failed to update invite status", { status: 500, headers: corsHeaders });
  }

  await syncToPatron(admin, user, invite, bohUserId, names, inviteTenantId);

  return new Response(
    JSON.stringify({
      message: "Invite accepted",
      user_id: bohUserId,
      role: roleRow.code,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveRole(client: any, roleHint: string | null) {
  const desired = (roleHint ?? "staff").trim();
  let query = client
    .from("boh_role")
    .select("id, code")
    .eq("app_context", "boh")
    .limit(1);

  if (desired && isUuid(desired)) {
    query = query.eq("id", desired);
  } else {
    query = query.eq("code", desired || "staff");
  }

  const { data, error } = await query;
  return { data: data?.[0] ?? null, error };
}

function deriveNames(user: any, invite: any) {
  const meta = (user.user_metadata as any) ?? {};

  const metaFirst = meta.first_name ?? meta.given_name ?? null;
  const metaLast = meta.last_name ?? meta.family_name ?? null;
  const metaFull = meta.full_name ?? null;

  const inviteFirst = invite.first_name ?? null;
  const inviteLast = invite.last_name ?? null;
  const inviteFull = invite.full_name ?? null;

  let first = metaFirst || inviteFirst || null;
  let last = metaLast || inviteLast || null;

  const fallbackFull = metaFull || inviteFull || null;
  if ((!first || !last) && fallbackFull) {
    const trimmed = String(fallbackFull).trim();
    if (trimmed.length) {
      const parts = trimmed.split(/\s+/);
      if (!first && parts[0]) first = parts[0];
      if (!last && parts.length > 1) {
        last = parts.slice(1).join(" ") || last;
      }
    }
  }

  const full = fallbackFull ?? (first || last ? buildFullName(first, last) : null);

  return {
    first,
    last,
    full,
  };
}

function buildFullName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(" ").trim() || null;
}

async function ensureRoleAssignment(client: any, userId: string, roleId: string, tenantId: string) {
  const { data: existing, error: lookupError } = await client
    .from("boh_user_role")
    .select("id")
    .eq("user_id", userId)
    .eq("role_id", roleId)
    .eq("tenant_id", tenantId)
    .eq("app_context", "boh")
    .maybeSingle();

  if (lookupError && lookupError.code !== "PGRST116") {
    throw lookupError;
  }

  if (!existing) {
    const { error: insertError } = await client.from("boh_user_role").insert({
      user_id: userId,
      role_id: roleId,
      tenant_id: tenantId,
      app_context: "boh",
    });

    if (insertError) {
      throw insertError;
    }
  }
}

async function applyAppGrants(client: any, userId: string, appSlugs: string[], isSuperAdmin: boolean, tenantId: string) {
  const normalizedSlugs = Array.isArray(appSlugs)
    ? Array.from(new Set(appSlugs.filter((slug) => typeof slug === "string" && slug.trim().length > 0))).map((slug) => slug.trim())
    : [];

  if (isSuperAdmin) {
    const { error } = await client
      .from("boh_user_app")
      .delete()
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("app_context", "boh");
    if (error) throw error;
    return;
  }

  if (normalizedSlugs.length === 0) {
    return;
  }

  const { data: apps, error: appsError } = await client
    .from("boh_tenant_app")
    .select("app:boh_app!boh_tenant_app_app_id_fkey(id, slug)")
    .eq("tenant_id", tenantId)
    .in("status", ["enabled", "coming_soon"]);

  if (appsError) {
    throw appsError;
  }

  const tenantApps = (apps ?? [])
    .map((row: any) => Array.isArray(row.app) ? row.app[0] : row.app)
    .filter(Boolean);
  const slugToAppId = new Map(tenantApps.map((app) => [app.slug, app.id]));
  if (slugToAppId.size === 0) {
    return;
  }

  const { data: existingGrants, error: existingGrantsError } = await client
    .from("boh_user_app")
    .select("app_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("app_context", "boh");

  if (existingGrantsError) {
    throw existingGrantsError;
  }

  const existingAppIds = new Set((existingGrants ?? []).map((grant) => grant.app_id));
  const grantRows = [];
  for (const slug of normalizedSlugs) {
    const appId = slugToAppId.get(slug);
    if (!appId || existingAppIds.has(appId)) continue;
    grantRows.push({
      user_id: userId,
      app_id: appId,
      permission_level: "edit",
      tenant_id: tenantId,
      app_context: "boh",
    });
  }

  if (grantRows.length > 0) {
    const { error: insertError } = await client.from("boh_user_app").insert(grantRows);
    if (insertError) throw insertError;
  }
}

async function syncToPatron(client: any, user: any, invite: any, bohUserId: string, names: { first: string | null; last: string | null }, tenantId: string) {
  try {
    const { error: patronError } = await client.functions.invoke("patron-sync", {
      body: {
        email: user.email,
        first_name: names.first ?? null,
        last_name: names.last ?? null,
        source: "boh_invite_accepted",
        lifecycle: "employee",
      },
    });

    if (patronError) {
      console.error("[boh-accept-invite] patron-sync error", patronError);
    }

    if (user.email && bohUserId) {
      const emailLower = String(user.email).toLowerCase();
      const { data: existingPerson, error: personLookupError } = await client
        .from("patron_person")
        .select("id, boh_user_id")
        .ilike("email", emailLower)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (personLookupError && personLookupError.code !== "PGRST116") {
        console.error("[boh-accept-invite] patron_person lookup error", personLookupError);
      } else if (existingPerson?.id) {
        if (!existingPerson.boh_user_id) {
          const { error: updatePersonError } = await client
            .from("patron_person")
            .update({ boh_user_id: bohUserId })
            .eq("id", existingPerson.id)
            .eq("tenant_id", tenantId);

          if (updatePersonError) {
            console.error("[boh-accept-invite] patron_person update error", updatePersonError);
          }
        }
      } else {
        const { error: insertPersonError } = await client
          .from("patron_person")
          .insert({
            email: emailLower,
            boh_user_id: bohUserId,
            tenant_id: tenantId,
            source: "boh_invite_accepted",
            created_by: bohUserId,
          });

        if (insertPersonError) {
          console.error("[boh-accept-invite] patron_person insert error", insertPersonError);
        }
      }
    }
  } catch (err) {
    console.error("[boh-accept-invite] patron-sync unexpected error", err);
  }
}

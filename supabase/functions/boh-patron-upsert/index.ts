// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

type UpsertPayload = {
  source?: string;

  full_name?: string;
  work_email?: string;
  company_name?: string;
  role_title?: string;
  consent_given?: boolean;
  consent_at?: string;

  email?: string;
  first_name?: string;
  last_name?: string;
  lifecycle?: string;
  person_type_key?: string;
  external_user_id?: string;
  external_profile_id?: string;
  external_app_context?: string;
  country_code?: string;
  company_country_code?: string;
  create_loft_handoff?: boolean;

  metadata?: Record<string, unknown>;
};

type NormalizedPayload = {
  source: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  companyName: string;
  roleTitle: string;
  consentGiven: boolean;
  consentAt: string;
  personTypeKey: string;
  externalUserId: string;
  externalProfileId: string;
  externalAppContext: string;
  lifecycle: string;
  countryCode: string;
  companyCountryCode: string;
  metadata: Record<string, unknown>;
  requiresOrganisation: boolean;
  activityKind: "talent_demo" | "talent_recruiter" | "jobzcafe_job_seeker";
  createLoftHandoff: boolean;
};

const ALLOWED_SOURCES = new Set([
  "talent_demo_request",
  "talent_recruiter_onboarding",
  "talent_recruiter_access_request",
  "talent_recruiter_manual_setup",
]);

const TALENT_RECRUITER_SOURCES = new Set([
  "talent_recruiter_onboarding",
  "talent_recruiter_access_request",
  "talent_recruiter_manual_setup",
]);

function isJobzcafeSource(source: string) {
  return /^jobzcafe_[a-z0-9_]{1,80}$/.test(source);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeCountryCode(value: unknown, fieldName: string) {
  const countryCode = normalizeText(value).toUpperCase();
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error(`${fieldName} must be an ISO 3166-1 alpha-2 country code.`);
  }
  return countryCode;
}

function splitName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: fullName, lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
  };
}

function compactName(...parts: string[]) {
  return parts.map(normalizeText).filter(Boolean).join(" ");
}

function validateBearer(req: Request) {
  const expectedToken = Deno.env.get("TALENT_PATRON_UPSERT_TOKEN");
  if (!expectedToken) {
    console.error("[boh-patron-upsert] Missing TALENT_PATRON_UPSERT_TOKEN");
    return false;
  }

  const header = req.headers.get("Authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  return token === expectedToken;
}

function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("SB_SECRET_KEY");

  if (!supabaseUrl || !secretKey) {
    throw new Error("BOH Patron upsert is not configured.");
  }

  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });
}

async function getTargetTenantId(supabase: any): Promise<string> {
  const explicitTenantId = Deno.env.get("BOH_TENANT_ID")?.trim();
  if (explicitTenantId) return explicitTenantId;

  const tenantSlug = Deno.env.get("BOH_TENANT_SLUG")?.trim() || "australis";
  const { data, error } = await supabase
    .from("boh_tenant")
    .select("id")
    .eq("slug", tenantSlug)
    .single();

  if (error || !data?.id) {
    throw new Error(`Unable to resolve BOH tenant for Patron upsert: ${tenantSlug}`);
  }

  return data.id;
}

function validatePayload(body: UpsertPayload): NormalizedPayload {
  const source = normalizeText(body.source) || "talent_demo_request";
  if (!ALLOWED_SOURCES.has(source) && !isJobzcafeSource(source)) {
    throw new Error("Unsupported source.");
  }

  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  const explicitFirstName = normalizeText(body.first_name);
  const explicitLastName = normalizeText(body.last_name);
  const fullNameFromParts = compactName(explicitFirstName, explicitLastName);
  const fullName = normalizeText(body.full_name) || fullNameFromParts;
  const split = splitName(fullName);
  const firstName = explicitFirstName || split.firstName;
  const lastName = explicitLastName || split.lastName;
  const email = normalizeEmail(body.work_email || body.email);
  const companyName = normalizeText(body.company_name);
  const roleTitle = normalizeText(body.role_title);
  const consentGiven = body.consent_given === true;
  const consentAt = normalizeText(body.consent_at) || new Date().toISOString();
  const externalUserId = normalizeText(body.external_user_id);
  const externalProfileId = normalizeText(body.external_profile_id);
  const lifecycle = normalizeText(body.lifecycle);
  const countryCode = normalizeCountryCode(body.country_code, "country_code");
  const companyCountryCode = normalizeCountryCode(
    body.company_country_code,
    "company_country_code",
  );
  const createLoftHandoff = body.create_loft_handoff === true;

  if (source === "talent_demo_request") {
    if (!firstName || !lastName) throw new Error("First name and last name are required.");
    if (!email || !email.includes("@")) throw new Error("A valid work email is required.");
    if (!companyName) throw new Error("Company is required.");
    if (!roleTitle) throw new Error("Role is required.");
    if (!consentGiven) throw new Error("Consent is required.");

    return {
      source,
      email,
      fullName,
      firstName,
      lastName,
      companyName,
      roleTitle,
      consentGiven,
      consentAt,
      personTypeKey: normalizeText(body.person_type_key) || "recruiter_prospect",
      externalUserId,
      externalProfileId,
      externalAppContext: normalizeText(body.external_app_context) || "talent",
      countryCode,
      companyCountryCode,
      metadata,
      requiresOrganisation: true,
      activityKind: "talent_demo",
      createLoftHandoff,
    };
  }

  if (TALENT_RECRUITER_SOURCES.has(source)) {
    if (!email || !email.includes("@")) throw new Error("A valid recruiter email is required.");
    if (!firstName || !lastName) throw new Error("Recruiter first name and last name are required.");

    return {
      source,
      email,
      fullName,
      firstName,
      lastName,
      companyName,
      roleTitle: roleTitle || "Recruiter",
      consentGiven,
      consentAt,
      personTypeKey: normalizeText(body.person_type_key) || "recruiter",
      externalUserId,
      externalProfileId,
      externalAppContext: normalizeText(body.external_app_context) || "talent",
      countryCode,
      companyCountryCode,
      metadata,
      requiresOrganisation: Boolean(companyName),
      activityKind: "talent_recruiter",
      createLoftHandoff,
    };
  }

  if (isJobzcafeSource(source)) {
    if (!email || !email.includes("@")) throw new Error("A valid email is required.");
    if (!firstName || !lastName) throw new Error("First name and last name are required.");

    return {
      source,
      email,
      fullName,
      firstName,
      lastName,
      companyName,
      roleTitle,
      consentGiven,
      consentAt,
      personTypeKey: normalizeText(body.person_type_key) || "job_seeker",
      externalUserId,
      externalProfileId,
      externalAppContext: normalizeText(body.external_app_context) || "cafe",
      countryCode,
      companyCountryCode,
      metadata,
      requiresOrganisation: Boolean(companyName),
      activityKind: "jobzcafe_job_seeker",
      createLoftHandoff,
    };
  }

  throw new Error("Unsupported source.");
}

async function getRecruiterPipelineStageId(supabase: any, tenantId: string) {
  const { data, error } = await supabase
    .from("patron_pipeline_stage")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("key", "new_recruiter_intake")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.warn("[boh-patron-upsert] Could not load recruiter pipeline stage:", error.message);
  }

  return data?.id ?? null;
}

async function upsertPerson(supabase: any, tenantId: string, payload: NormalizedPayload) {
  const pipelineStageId = payload.personTypeKey.includes("recruiter")
    ? await getRecruiterPipelineStageId(supabase, tenantId)
    : null;

  const { data: existingMatches, error: lookupError } = await supabase
    .from("patron_person")
    .select("*")
    .eq("tenant_id", tenantId)
    .ilike("email", payload.email)
    .limit(10);

  if (lookupError) {
    throw new Error(`Could not lookup Patron contact: ${lookupError.message}`);
  }

  const existing = (existingMatches || []).find(
    (person: Record<string, unknown>) => normalizeEmail(person.email) === payload.email,
  );

  if (existing?.id) {
    const updates: Record<string, unknown> = {
      source: existing.source || payload.source,
      app_context: "patron",
    };

    if (!existing.first_name && payload.firstName) updates.first_name = payload.firstName;
    if (!existing.last_name && payload.lastName) updates.last_name = payload.lastName;
    if (!existing.person_type_key) updates.person_type_key = payload.personTypeKey;
    if (!existing.pipeline_stage_id && pipelineStageId) updates.pipeline_stage_id = pipelineStageId;
    if (payload.externalUserId) updates.external_user_id = payload.externalUserId;
    if (payload.externalAppContext) updates.external_app_context = payload.externalAppContext;
    if (payload.countryCode) updates.country_code = payload.countryCode;

    const { data: updated, error: updateError } = await supabase
      .from("patron_person")
      .update(updates)
      .eq("id", existing.id)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(`Could not update Patron contact: ${updateError.message}`);
    }

    return { person: updated, createdOrUpdated: "updated" };
  }

  const insertRow: Record<string, unknown> = {
    tenant_id: tenantId,
    first_name: payload.firstName || null,
    last_name: payload.lastName || null,
    email: payload.email,
    source: payload.source,
    person_type_key: payload.personTypeKey,
    pipeline_stage_id: pipelineStageId,
    app_context: "patron",
  };
  if (payload.externalUserId) insertRow.external_user_id = payload.externalUserId;
  if (payload.externalAppContext) insertRow.external_app_context = payload.externalAppContext;
  if (payload.countryCode) insertRow.country_code = payload.countryCode;

  const { data: created, error: createError } = await supabase
    .from("patron_person")
    .insert(insertRow)
    .select("*")
    .single();

  if (createError) {
    throw new Error(`Could not create Patron contact: ${createError.message}`);
  }

  return { person: created, createdOrUpdated: "created" };
}

async function upsertOrganisation(
  supabase: any,
  tenantId: string,
  companyName: string,
  personId: string,
  countryCode: string,
) {
  if (!companyName) return null;

  const { data: existingOrg, error: lookupError } = await supabase
    .from("patron_organisation")
    .select("*")
    .eq("tenant_id", tenantId)
    .ilike("name", companyName)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Could not lookup Patron company: ${lookupError.message}`);
  }

  let organisation = existingOrg;

  if (organisation && countryCode && organisation.country_code !== countryCode) {
    const { data: updatedOrg, error: updateError } = await supabase
      .from("patron_organisation")
      .update({ country_code: countryCode })
      .eq("id", organisation.id)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(`Could not update Patron company country: ${updateError.message}`);
    }
    organisation = updatedOrg;
  }

  if (!organisation) {
    const { data: createdOrg, error: createError } = await supabase
      .from("patron_organisation")
      .insert({
        tenant_id: tenantId,
        name: companyName,
        app_context: "patron",
        country_code: countryCode || null,
      })
      .select("*")
      .single();

    if (createError) {
      throw new Error(`Could not create Patron company: ${createError.message}`);
    }

    organisation = createdOrg;
  }

  const { data: existingLink, error: linkLookupError } = await supabase
    .from("patron_person_organisation")
    .select("person_id")
    .eq("tenant_id", tenantId)
    .eq("person_id", personId)
    .eq("organisation_id", organisation.id)
    .maybeSingle();

  if (linkLookupError) {
    throw new Error(`Could not lookup Patron contact/company link: ${linkLookupError.message}`);
  }

  if (!existingLink) {
    const { error: linkError } = await supabase
      .from("patron_person_organisation")
      .insert({
        tenant_id: tenantId,
        person_id: personId,
        organisation_id: organisation.id,
      });

    if (linkError) {
      throw new Error(`Could not link Patron contact/company: ${linkError.message}`);
    }
  }

  return organisation;
}

async function recordActivity(
  supabase: any,
  tenantId: string,
  personId: string,
  organisationId: string | null,
  payload: NormalizedPayload,
) {
  const talentRequestId = normalizeText(payload.metadata?.talent_demo_request_id);

  const bodyByKind = {
    talent_demo: [
      "Talent demo request captured.",
      `Contact: ${payload.fullName} <${payload.email}>`,
      payload.companyName ? `Company: ${payload.companyName}` : "",
      payload.roleTitle ? `Role: ${payload.roleTitle}` : "",
      `Consent: given at ${payload.consentAt}`,
      talentRequestId ? `Talent request ID: ${talentRequestId}` : "",
      "Follow-up: send/monitor Talent prospect demo invite.",
    ],
    talent_recruiter: [
      "Talent recruiter identity linked.",
      `Contact: ${payload.fullName} <${payload.email}>`,
      payload.companyName ? `Company: ${payload.companyName}` : "",
      payload.roleTitle ? `Role: ${payload.roleTitle}` : "",
      `Source: ${payload.source}`,
    ],
    jobzcafe_job_seeker: [
      "JOBZCAFE® job seeker identity linked.",
      `Contact: ${payload.fullName} <${payload.email}>`,
      `Source: ${payload.source}`,
      payload.lifecycle ? `Lifecycle: ${payload.lifecycle}` : "",
    ],
  };

  const body = bodyByKind[payload.activityKind].filter(Boolean).join("\n");
  const { error } = await supabase
    .from("patron_activity")
    .insert({
      tenant_id: tenantId,
      person_id: personId,
      organisation_id: organisationId,
      type: "note",
      body,
      app_context: "patron",
    });

  if (error) {
    console.warn("[boh-patron-upsert] Could not record Patron activity:", error.message);
  }
}

async function ensureBohUserForLoftHandoff(
  supabase: any,
  tenantId: string,
  payload: NormalizedPayload,
  person: Record<string, unknown>,
) {
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: payload.email,
  });

  if (linkError) {
    throw new Error(`Could not create Loft handoff: ${linkError.message}`);
  }

  const tokenHash = linkData.properties?.hashed_token;
  const authUserId = linkData.user?.id;

  if (!tokenHash || !authUserId) {
    throw new Error("Loft handoff token could not be created.");
  }

  const firstName = normalizeText(person.first_name) || payload.firstName;
  const lastName = normalizeText(person.last_name) || payload.lastName;
  const displayName = compactName(firstName, lastName) || payload.fullName;

  const { data: existingBohUser, error: lookupError } = await supabase
    .from("boh_user")
    .select("id, auth_user_id, email")
    .eq("tenant_id", tenantId)
    .eq("email", payload.email)
    .eq("app_context", "boh")
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Could not lookup BOH Loft user: ${lookupError.message}`);
  }

  if (existingBohUser?.id) {
    const updates: Record<string, unknown> = {
      auth_user_id: existingBohUser.auth_user_id || authUserId,
      status: "active",
    };
    if (firstName) updates.first_name = firstName;
    if (lastName) updates.last_name = lastName;
    if (displayName) {
      updates.full_name = displayName;
      updates.display_name = displayName;
    }

    const { error: updateError } = await supabase
      .from("boh_user")
      .update(updates)
      .eq("id", existingBohUser.id);

    if (updateError) {
      throw new Error(`Could not update BOH Loft user: ${updateError.message}`);
    }
  } else {
    const { error: insertError } = await supabase
      .from("boh_user")
      .insert({
        tenant_id: tenantId,
        auth_user_id: authUserId,
        email: payload.email,
        first_name: firstName || null,
        last_name: lastName || null,
        full_name: displayName || null,
        display_name: displayName || null,
        status: "active",
        app_context: "boh",
        primary_role_hint: "patron",
      });

    if (insertError) {
      throw new Error(`Could not create BOH Loft user: ${insertError.message}`);
    }
  }

  return {
    token_hash: tokenHash,
    expires_in_seconds: 300,
  };
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(req, { success: false, error: "Method not allowed" }, 405);
  }

  if (!validateBearer(req)) {
    return jsonResponse(req, { success: false, error: "Unauthorized" }, 401);
  }

  try {
    const payload = validatePayload(await req.json().catch(() => ({})));
    const supabase = createServiceClient();
    const tenantId = await getTargetTenantId(supabase);
    const { person, createdOrUpdated } = await upsertPerson(supabase, tenantId, payload);
    const organisation = payload.requiresOrganisation
      ? await upsertOrganisation(
        supabase,
        tenantId,
        payload.companyName,
        person.id,
        payload.companyCountryCode,
      )
      : null;
    await recordActivity(supabase, tenantId, person.id, organisation?.id ?? null, payload);
    const loftHandoff = payload.createLoftHandoff
      ? await ensureBohUserForLoftHandoff(supabase, tenantId, payload, person)
      : null;

    return jsonResponse(req, {
      success: true,
      crm_contact_id: person.id,
      crm_company_id: organisation?.id ?? null,
      created_or_updated: createdOrUpdated,
      normalized_email: payload.email,
      normalized_company_name: organisation?.name ?? payload.companyName ?? null,
      boh_tenant_id: tenantId,
      country_code: person.country_code ?? null,
      company_country_code: organisation?.country_code ?? null,
      loft_handoff: loftHandoff,
    });
  } catch (error) {
    console.error("[boh-patron-upsert] Error:", error);
    return jsonResponse(req, {
      success: false,
      error: error instanceof Error ? error.message : "Could not upsert Patron contact.",
    }, 400);
  }
});

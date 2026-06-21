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
  metadata?: Record<string, unknown>;
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
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

function validatePayload(body: UpsertPayload) {
  const source = normalizeText(body.source) || "talent_demo_request";
  const fullName = normalizeText(body.full_name);
  const workEmail = normalizeEmail(body.work_email);
  const companyName = normalizeText(body.company_name);
  const roleTitle = normalizeText(body.role_title);
  const consentGiven = body.consent_given === true;
  const consentAt = normalizeText(body.consent_at) || new Date().toISOString();

  if (source !== "talent_demo_request") {
    throw new Error("Unsupported source.");
  }

  if (!fullName) throw new Error("Name is required.");
  if (!workEmail || !workEmail.includes("@")) throw new Error("A valid work email is required.");
  if (!companyName) throw new Error("Company is required.");
  if (!roleTitle) throw new Error("Role is required.");
  if (!consentGiven) throw new Error("Consent is required.");

  return {
    source,
    fullName,
    workEmail,
    companyName,
    roleTitle,
    consentGiven,
    consentAt,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  };
}

async function getRecruiterPipelineStageId(supabase: any) {
  const { data, error } = await supabase
    .from("patron_pipeline_stage")
    .select("id")
    .eq("key", "new_recruiter_intake")
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.warn("[boh-patron-upsert] Could not load recruiter pipeline stage:", error.message);
  }

  return data?.id ?? null;
}

async function upsertPerson(supabase: any, payload: ReturnType<typeof validatePayload>) {
  const { firstName, lastName } = splitName(payload.fullName);
  const pipelineStageId = await getRecruiterPipelineStageId(supabase);

  const { data: existing, error: lookupError } = await supabase
    .from("patron_person")
    .select("*")
    .eq("email", payload.workEmail)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Could not lookup Patron contact: ${lookupError.message}`);
  }

  if (existing?.id) {
    const updates: Record<string, unknown> = {
      source: existing.source || payload.source,
      app_context: "patron",
    };

    if (!existing.first_name && firstName) updates.first_name = firstName;
    if (!existing.last_name && lastName) updates.last_name = lastName;
    if (!existing.display_name) updates.display_name = payload.fullName;
    if (!existing.person_type_key) updates.person_type_key = "recruiter_prospect";
    if (!existing.pipeline_stage_id && pipelineStageId) updates.pipeline_stage_id = pipelineStageId;

    const { data: updated, error: updateError } = await supabase
      .from("patron_person")
      .update(updates)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(`Could not update Patron contact: ${updateError.message}`);
    }

    return { person: updated, createdOrUpdated: "updated" };
  }

  const { data: created, error: createError } = await supabase
    .from("patron_person")
    .insert({
      first_name: firstName || null,
      last_name: lastName || null,
      email: payload.workEmail,
      display_name: payload.fullName,
      source: payload.source,
      person_type_key: "recruiter_prospect",
      pipeline_stage_id: pipelineStageId,
      app_context: "patron",
    })
    .select("*")
    .single();

  if (createError) {
    throw new Error(`Could not create Patron contact: ${createError.message}`);
  }

  return { person: created, createdOrUpdated: "created" };
}

async function upsertOrganisation(supabase: any, companyName: string, personId: string) {
  const { data: existingOrg, error: lookupError } = await supabase
    .from("patron_organisation")
    .select("*")
    .ilike("name", companyName)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Could not lookup Patron company: ${lookupError.message}`);
  }

  let organisation = existingOrg;

  if (!organisation) {
    const { data: createdOrg, error: createError } = await supabase
      .from("patron_organisation")
      .insert({
        name: companyName,
        app_context: "patron",
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
  personId: string,
  organisationId: string | null,
  payload: ReturnType<typeof validatePayload>,
) {
  const talentRequestId = normalizeText(payload.metadata?.talent_demo_request_id);
  const body = [
    "Talent demo request captured.",
    `Contact: ${payload.fullName} <${payload.workEmail}>`,
    `Company: ${payload.companyName}`,
    `Role: ${payload.roleTitle}`,
    `Consent: given at ${payload.consentAt}`,
    talentRequestId ? `Talent request ID: ${talentRequestId}` : "",
    "Follow-up: send/monitor Talent prospect demo invite.",
  ].filter(Boolean).join("\n");

  const { error } = await supabase
    .from("patron_activity")
    .insert({
      person_id: personId,
      organisation_id: organisationId,
      type: "note",
      body,
      app_context: "patron",
    });

  if (error) {
    throw new Error(`Could not record Patron activity: ${error.message}`);
  }
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
    const { person, createdOrUpdated } = await upsertPerson(supabase, payload);
    const organisation = await upsertOrganisation(supabase, payload.companyName, person.id);
    await recordActivity(supabase, person.id, organisation?.id ?? null, payload);

    return jsonResponse(req, {
      success: true,
      crm_contact_id: person.id,
      crm_company_id: organisation?.id ?? null,
      created_or_updated: createdOrUpdated,
      normalized_email: payload.workEmail,
      normalized_company_name: organisation?.name ?? payload.companyName,
    });
  } catch (error) {
    console.error("[boh-patron-upsert] Error:", error);
    return jsonResponse(req, {
      success: false,
      error: error instanceof Error ? error.message : "Could not upsert Patron contact.",
    }, 400);
  }
});

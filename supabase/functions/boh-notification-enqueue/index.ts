// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { normalizePhone } from "../_shared/notifications.ts";

const normalizeText = (value: unknown) => typeof value === 'string' ? value.trim() : '';

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse(req, { success: false, error: 'method_not_allowed' }, 405);
  if (!validateInternalBearer(req)) return jsonResponse(req, { success: false, error: 'unauthorized' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const { supabaseUrl, serviceRoleKey } = getServerConfig();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const tenant = await resolveTenant(supabaseAdmin, { tenantId: body.tenantId, tenantSlug: body.tenantSlug });
    const sourceApp = normalizeText(body.sourceApp || body.source_app || 'unknown');
    const costCenter = normalizeText(body.costCenter || body.cost_center || sourceApp);
    const channel = normalizeText(body.channel || 'sms').toLowerCase();
    const phone = normalizePhone(body.toPhone || body.phone || body.recipientPhone || body.recipient_phone_e164);
    const email = normalizeText(body.toEmail || body.email || body.recipientEmail || body.recipient_email).toLowerCase() || null;
    const bodyText = normalizeText(body.bodyText || body.body_text || body.message);
    const eventKey = normalizeText(body.eventKey || body.event_key || 'notification');
    const templateKey = normalizeText(body.templateKey || body.template_key || eventKey);
    const patronPersonId = normalizeText(body.patronPersonId || body.patron_person_id) || null;

    if (channel !== 'sms') return jsonResponse(req, { success: false, error: 'only_sms_supported_for_now' }, 400);
    if (!phone) return jsonResponse(req, { success: false, error: 'valid_phone_required' }, 400);
    if (!bodyText) return jsonResponse(req, { success: false, error: 'message_body_required' }, 400);

    const contact = await ensureContact(supabaseAdmin, {
      tenantId: tenant.id,
      patronPersonId,
      phone,
      email,
      recipientType: normalizeText(body.recipientType || body.recipient_type || 'unknown'),
      consentStatus: normalizeText(body.smsConsentStatus || body.sms_consent_status),
      consentSource: normalizeText(body.smsConsentSource || body.sms_consent_source || sourceApp),
      consentText: normalizeText(body.smsConsentText || body.sms_consent_text),
      timezone: normalizeText(body.timezone || 'America/New_York'),
      metadata: body.contactMetadata && typeof body.contactMetadata === 'object' ? body.contactMetadata : {},
    });

    const consentStatus = contact.sms_consent_status || 'unknown';
    const status = consentStatus === 'opted_in' ? 'queued' : 'suppressed';
    const idempotencyKey = normalizeText(body.idempotencyKey || body.idempotency_key)
      || `${tenant.id}:${sourceApp}:${eventKey}:${channel}:${body.sourceRecordId || body.source_record_id || phone}:${templateKey}`;

    const { data: event, error } = await supabaseAdmin
      .from('boh_notification_event')
      .upsert({
        tenant_id: tenant.id,
        contact_preference_id: contact.id,
        patron_person_id: patronPersonId,
        patron_organisation_id: normalizeText(body.patronOrganisationId || body.patron_organisation_id) || null,
        source_app: sourceApp,
        source_record_table: normalizeText(body.sourceRecordTable || body.source_record_table) || null,
        source_record_id: normalizeText(body.sourceRecordId || body.source_record_id) || null,
        cost_center: costCenter,
        event_key: eventKey,
        channel,
        provider: 'unassigned',
        status,
        recipient_type: contact.recipient_type || 'unknown',
        recipient_email: email,
        recipient_phone_e164: phone,
        template_key: templateKey,
        template_version: Number(body.templateVersion || body.template_version || 1),
        subject: normalizeText(body.subject) || null,
        body_text: bodyText,
        body_html: normalizeText(body.bodyHtml || body.body_html) || null,
        idempotency_key: idempotencyKey,
        consent_checked_at: new Date().toISOString(),
        consent_status: consentStatus,
        suppressed_reason: status === 'suppressed' ? (consentStatus === 'opted_out' ? 'sms_opted_out' : 'sms_consent_missing') : null,
        currency: normalizeText(body.currency || 'USD'),
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      }, { onConflict: 'idempotency_key' })
      .select('id, status, suppressed_reason')
      .single();
    if (error) throw new Error(`notification_enqueue_failed: ${error.message}`);

    return jsonResponse(req, { success: true, event, queued: event.status === 'queued', availabilityExposed: false });
  } catch (error) {
    console.error('[boh-notification-enqueue] Error:', error);
    return jsonResponse(req, { success: false, error: error instanceof Error ? error.message : 'unexpected_error' }, 400);
  }
});

function validateInternalBearer(req: Request): boolean {
  const header = req.headers.get('Authorization') || '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || req.headers.get('x-boh-notification-token')?.trim() || '';
  const expected = Deno.env.get('BOH_NOTIFICATION_API_TOKEN')?.trim()
    || Deno.env.get('TALENT_BOH_INTERVIEW_REQUEST_TOKEN')?.trim()
    || Deno.env.get('BOH_TALENT_INTERVIEW_REQUEST_TOKEN')?.trim();
  return Boolean(expected && token && token === expected);
}

function getServerConfig() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SB_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('server_not_configured');
  return { supabaseUrl, serviceRoleKey };
}

async function resolveTenant(supabaseAdmin: any, input: { tenantId?: string | null; tenantSlug?: string | null }) {
  const tenantId = normalizeText(input.tenantId);
  const tenantSlug = normalizeText(input.tenantSlug).toLowerCase();
  if (!tenantId && !tenantSlug) throw new Error('tenant_required');
  let query = supabaseAdmin.from('boh_tenant').select('id, slug, name').limit(1);
  query = tenantId ? query.eq('id', tenantId) : query.eq('slug', tenantSlug);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`tenant_lookup_failed: ${error.message}`);
  if (!data?.id) throw new Error('tenant_not_found');
  return data;
}

async function ensureContact(supabaseAdmin: any, input: any) {
  const consentStatus = input.consentStatus === 'opted_in' || input.consentStatus === 'opted_out' ? input.consentStatus : 'unknown';
  const row = {
    tenant_id: input.tenantId,
    patron_person_id: input.patronPersonId || null,
    recipient_type: input.recipientType || 'unknown',
    email: input.email || null,
    phone_e164: input.phone,
    sms_consent_status: consentStatus,
    sms_consent_source: consentStatus === 'opted_in' ? input.consentSource : null,
    sms_consent_text: consentStatus === 'opted_in' ? input.consentText : null,
    sms_consent_at: consentStatus === 'opted_in' ? new Date().toISOString() : null,
    sms_opted_out_at: consentStatus === 'opted_out' ? new Date().toISOString() : null,
    timezone: input.timezone || 'America/New_York',
    metadata: input.metadata || {},
  };

  if (input.patronPersonId) {
    const { data, error } = await supabaseAdmin
      .from('boh_notification_contact_preference')
      .upsert(row, { onConflict: 'tenant_id,patron_person_id' })
      .select('id, recipient_type, phone_e164, sms_consent_status')
      .single();
    if (error) throw new Error(`contact_upsert_failed: ${error.message}`);
    return data;
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('boh_notification_contact_preference')
    .select('id, recipient_type, phone_e164, sms_consent_status')
    .eq('tenant_id', input.tenantId)
    .eq('phone_e164', input.phone)
    .maybeSingle();
  if (existingError) throw new Error(`contact_lookup_failed: ${existingError.message}`);
  if (existing?.id) return existing;

  const { data, error } = await supabaseAdmin
    .from('boh_notification_contact_preference')
    .insert(row)
    .select('id, recipient_type, phone_e164, sms_consent_status')
    .single();
  if (error) throw new Error(`contact_create_failed: ${error.message}`);
  return data;
}

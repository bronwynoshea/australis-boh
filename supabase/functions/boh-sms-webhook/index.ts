// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { classifySmsKeyword, normalizePhone, normalizeSmsKeyword } from "../_shared/notifications.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse(req, { success: false, error: 'method_not_allowed' }, 405);

  try {
    const expected = Deno.env.get('BOH_SMS_WEBHOOK_TOKEN')?.trim();
    if (expected && req.headers.get('x-boh-sms-webhook-token')?.trim() !== expected) {
      return jsonResponse(req, { success: false, error: 'unauthorized' }, 401);
    }

    const payload = await readPayload(req);
    const provider = String(new URL(req.url).searchParams.get('provider') || payload.provider || Deno.env.get('BOH_SMS_PROVIDER') || 'unknown').toLowerCase();
    const inbound = extractInbound(provider, payload);
    if (!inbound.from || !inbound.body) return jsonResponse(req, { success: false, error: 'from_phone_and_body_required' }, 400);

    const { supabaseUrl, serviceRoleKey } = getServerConfig();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const contact = await findContact(supabaseAdmin, inbound.from);
    const keyword = normalizeSmsKeyword(inbound.body);
    const action = classifySmsKeyword(keyword);

    const { data: inboundRow, error: insertError } = await supabaseAdmin
      .from('boh_sms_inbound_event')
      .insert({
        tenant_id: contact?.tenant_id || null,
        provider,
        provider_message_id: inbound.providerMessageId,
        from_phone_e164: inbound.from,
        to_phone_e164: inbound.to,
        body_text: inbound.body,
        normalized_keyword: keyword || null,
        action,
        processed_at: new Date().toISOString(),
        raw_payload: payload,
      })
      .select('id')
      .single();
    if (insertError) throw new Error(`inbound_insert_failed: ${insertError.message}`);

    if (contact?.id && (action === 'opt_out' || action === 'opt_in')) {
      const nextStatus = action === 'opt_out' ? 'opted_out' : 'opted_in';
      const updates: Record<string, unknown> = {
        sms_consent_status: nextStatus,
        sms_opt_out_reason: action === 'opt_out' ? keyword : null,
        sms_opted_out_at: action === 'opt_out' ? new Date().toISOString() : null,
        sms_consent_at: action === 'opt_in' ? new Date().toISOString() : undefined,
        sms_consent_source: action === 'opt_in' ? 'sms_inbound_keyword' : undefined,
      };
      Object.keys(updates).forEach((key) => updates[key] === undefined && delete updates[key]);
      const { error: updateError } = await supabaseAdmin
        .from('boh_notification_contact_preference')
        .update(updates)
        .eq('id', contact.id);
      if (updateError) throw new Error(`sms_consent_update_failed: ${updateError.message}`);
    }

    const responseText = action === 'help'
      ? 'JOBZCAFE: Reply STOP to opt out of text messages. Email remains available for important account and interview messages.'
      : action === 'opt_out'
        ? 'JOBZCAFE: You are opted out of text messages. Reply START to opt back in.'
        : action === 'opt_in'
          ? 'JOBZCAFE: You are opted in to text messages.'
          : 'OK';

    return jsonResponse(req, { success: true, id: inboundRow.id, action, responseText });
  } catch (error) {
    console.error('[boh-sms-webhook] Error:', error);
    return jsonResponse(req, { success: false, error: error instanceof Error ? error.message : 'sms_webhook_failed' }, 500);
  }
});

async function readPayload(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return await req.json().catch(() => ({}));
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
  }
  return await req.json().catch(() => ({}));
}

function extractInbound(provider: string, payload: Record<string, any>) {
  const body = String(payload.Body || payload.body || payload.text || payload.Text || payload.message || payload.payload?.text || '');
  const from = normalizePhone(payload.From || payload.from || payload.msisdn || payload.phone_number || payload.payload?.from?.phone_number);
  const to = normalizePhone(payload.To || payload.to || payload.to_number || payload.payload?.to?.[0]?.phone_number);
  const providerMessageId = String(payload.MessageSid || payload.message_sid || payload.id || payload.message_uuid || payload.data?.id || '') || null;
  return { provider, providerMessageId, from, to, body };
}

function getServerConfig() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SB_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('server_not_configured');
  return { supabaseUrl, serviceRoleKey };
}

async function findContact(supabaseAdmin: any, phone: string) {
  const { data, error } = await supabaseAdmin
    .from('boh_notification_contact_preference')
    .select('id, tenant_id, sms_consent_status')
    .eq('phone_e164', phone)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`contact_lookup_failed: ${error.message}`);
  return data;
}

// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { normalizeSmsProvider, sendSmsNotification, type NotificationEventRow } from "../_shared/notifications.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse(req, { success: false, error: 'method_not_allowed' }, 405);
  if (!validateDispatchBearer(req)) return jsonResponse(req, { success: false, error: 'unauthorized' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit || 10), 1), 50);
    const { supabaseUrl, serviceRoleKey } = getServerConfig();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const provider = normalizeSmsProvider();

    const { data: events, error } = await supabaseAdmin
      .from('boh_notification_event')
      .select('*')
      .eq('channel', 'sms')
      .in('status', ['queued', 'failed'])
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(`notification_queue_load_failed: ${error.message}`);

    const results: Record<string, unknown>[] = [];
    for (const event of (events || []) as NotificationEventRow[]) {
      try {
        await markEvent(supabaseAdmin, event.id, { status: 'sending', provider, attempts: Number((event as any).attempts || 0) + 1 });

        const consent = await loadConsent(supabaseAdmin, event);
        const consentStatus = consent?.sms_consent_status || 'unknown';
        if (consentStatus !== 'opted_in') {
          await markEvent(supabaseAdmin, event.id, {
            status: 'suppressed',
            consent_checked_at: new Date().toISOString(),
            consent_status: consentStatus,
            suppressed_reason: consentStatus === 'opted_out' ? 'sms_opted_out' : 'sms_consent_missing',
          });
          results.push({ id: event.id, status: 'suppressed', reason: consentStatus });
          continue;
        }

        const providerResult = await sendSmsNotification(event);
        await markEvent(supabaseAdmin, event.id, {
          provider: providerResult.provider,
          provider_message_id: providerResult.providerMessageId || null,
          status: providerResult.skipped ? 'skipped' : 'sent',
          consent_checked_at: new Date().toISOString(),
          consent_status: consentStatus,
          sent_at: providerResult.skipped ? null : new Date().toISOString(),
          estimated_cost_minor: providerResult.estimatedCostMinor || 0,
          actual_cost_minor: providerResult.actualCostMinor ?? null,
          error_message: providerResult.detail || null,
        });
        results.push({ id: event.id, status: providerResult.skipped ? 'skipped' : 'sent', provider: providerResult.provider });
      } catch (eventError) {
        const attempts = Number((event as any).attempts || 0) + 1;
        await markEvent(supabaseAdmin, event.id, {
          status: 'failed',
          error_message: eventError instanceof Error ? eventError.message : 'SMS dispatch failed',
          next_attempt_at: new Date(Date.now() + Math.min(attempts, 6) * 10 * 60_000).toISOString(),
        });
        results.push({ id: event.id, status: 'failed', error: eventError instanceof Error ? eventError.message : 'SMS dispatch failed' });
      }
    }

    return jsonResponse(req, { success: true, provider, processed: results.length, results });
  } catch (error) {
    console.error('[boh-notification-dispatch] Error:', error);
    return jsonResponse(req, { success: false, error: error instanceof Error ? error.message : 'notification_dispatch_failed' }, 500);
  }
});

function validateDispatchBearer(req: Request): boolean {
  const header = req.headers.get('Authorization') || '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || req.headers.get('x-boh-notification-token')?.trim() || '';
  const expected = Deno.env.get('BOH_NOTIFICATION_DISPATCH_TOKEN')?.trim() || Deno.env.get('BOH_NOTIFICATION_API_TOKEN')?.trim();
  return Boolean(expected && token && token === expected);
}

function getServerConfig() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SB_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('server_not_configured');
  return { supabaseUrl, serviceRoleKey };
}

async function markEvent(supabaseAdmin: any, id: string, updates: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from('boh_notification_event')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(`notification_update_failed: ${error.message}`);
}

async function loadConsent(supabaseAdmin: any, event: NotificationEventRow) {
  if (event.contact_preference_id) {
    const { data, error } = await supabaseAdmin
      .from('boh_notification_contact_preference')
      .select('id, sms_consent_status')
      .eq('id', event.contact_preference_id)
      .maybeSingle();
    if (error) throw new Error(`consent_lookup_failed: ${error.message}`);
    return data;
  }

  if (!event.recipient_phone_e164) return null;
  const { data, error } = await supabaseAdmin
    .from('boh_notification_contact_preference')
    .select('id, sms_consent_status')
    .eq('tenant_id', event.tenant_id)
    .eq('phone_e164', event.recipient_phone_e164)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`consent_lookup_failed: ${error.message}`);
  return data;
}

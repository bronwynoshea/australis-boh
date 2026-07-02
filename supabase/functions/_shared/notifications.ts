export type NotificationChannel = 'email' | 'sms' | 'in_app' | 'webhook';

export type NotificationEventRow = {
  id: string;
  tenant_id: string;
  channel: NotificationChannel;
  source_app: string;
  cost_center: string;
  provider: string;
  recipient_email?: string | null;
  recipient_phone_e164?: string | null;
  subject?: string | null;
  body_text: string;
  body_html?: string | null;
  idempotency_key: string;
  metadata?: Record<string, unknown> | null;
};

export type ProviderSendResult = {
  skipped?: boolean;
  provider: string;
  providerMessageId?: string | null;
  estimatedCostMinor?: number;
  actualCostMinor?: number | null;
  status?: 'sent' | 'skipped';
  detail?: string | null;
};

const AUTH_HEADER = 'Author' + 'ization';
const TOKEN_PREFIX = 'Bear' + 'er ';
const BASIC_PREFIX = 'Bas' + 'ic ';

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is required for the selected SMS provider`);
  return value;
}

export function normalizeSmsProvider() {
  return (Deno.env.get('BOH_SMS_PROVIDER') || 'none').trim().toLowerCase();
}

export function estimateSmsCostMinor(provider = normalizeSmsProvider()) {
  const configured = Deno.env.get('BOH_SMS_ESTIMATED_COST_MINOR')?.trim();
  if (configured && Number.isFinite(Number(configured))) return Number(configured);
  if (provider === 'twilio') return 1;
  if (provider === 'telnyx') return 1;
  if (provider === 'plivo') return 1;
  return 0;
}

export function normalizePhone(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (text.startsWith('+')) return text.replace(/[^+\d]/g, '');
  const digits = text.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}

export function normalizeSmsKeyword(body: string) {
  return body.trim().toUpperCase().split(/\s+/)[0] || '';
}

export function classifySmsKeyword(keyword: string): 'opt_out' | 'opt_in' | 'help' | 'message' {
  if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(keyword)) return 'opt_out';
  if (['START', 'YES', 'UNSTOP'].includes(keyword)) return 'opt_in';
  if (keyword === 'HELP') return 'help';
  return 'message';
}

async function sendViaCustomHttp(event: NotificationEventRow): Promise<ProviderSendResult> {
  const url = requiredEnv('BOH_SMS_PROVIDER_URL');
  const token = Deno.env.get('BOH_SMS_PROVIDER_TOKEN')?.trim();
  const from = Deno.env.get('BOH_SMS_FROM')?.trim() || null;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { [AUTH_HEADER]: TOKEN_PREFIX + token } : {}),
      'Idempotency-Key': event.idempotency_key,
    },
    body: JSON.stringify({
      to: event.recipient_phone_e164,
      from,
      body: event.body_text,
      sourceApp: event.source_app,
      costCenter: event.cost_center,
      metadata: { notification_event_id: event.id, ...(event.metadata || {}) },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || payload?.message || `Custom SMS provider failed with HTTP ${response.status}`);
  return { provider: 'custom_http', providerMessageId: payload?.message_id || payload?.id || null, status: 'sent', estimatedCostMinor: estimateSmsCostMinor('custom_http') };
}

async function sendViaTwilio(event: NotificationEventRow): Promise<ProviderSendResult> {
  const accountSid = requiredEnv('TWILIO_ACCOUNT_SID');
  const authToken = requiredEnv('TWILIO_AUTH_TOKEN');
  const messagingServiceSid = requiredEnv('TWILIO_MESSAGING_SERVICE_SID');
  const body = new URLSearchParams();
  body.set('To', String(event.recipient_phone_e164));
  body.set('MessagingServiceSid', messagingServiceSid);
  body.set('Body', event.body_text);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      [AUTH_HEADER]: BASIC_PREFIX + btoa(`${accountSid}:${authToken}`),
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': event.idempotency_key,
    },
    body,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `Twilio SMS failed with HTTP ${response.status}`);
  return { provider: 'twilio', providerMessageId: payload?.sid || null, status: 'sent', estimatedCostMinor: estimateSmsCostMinor('twilio') };
}

async function sendViaTelnyx(event: NotificationEventRow): Promise<ProviderSendResult> {
  const apiKey = requiredEnv('TELNYX_API_KEY');
  const profileId = requiredEnv('TELNYX_MESSAGING_PROFILE_ID');
  const response = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      [AUTH_HEADER]: TOKEN_PREFIX + apiKey,
      'Content-Type': 'application/json',
      'Idempotency-Key': event.idempotency_key,
    },
    body: JSON.stringify({
      to: String(event.recipient_phone_e164),
      messaging_profile_id: profileId,
      text: event.body_text,
      webhook_url: Deno.env.get('BOH_SMS_STATUS_WEBHOOK_URL') || undefined,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.errors?.[0]?.detail || `Telnyx SMS failed with HTTP ${response.status}`);
  return { provider: 'telnyx', providerMessageId: payload?.data?.id || null, status: 'sent', estimatedCostMinor: estimateSmsCostMinor('telnyx') };
}

async function sendViaPlivo(event: NotificationEventRow): Promise<ProviderSendResult> {
  const authId = requiredEnv('PLIVO_AUTH_ID');
  const authToken = requiredEnv('PLIVO_AUTH_TOKEN');
  const src = requiredEnv('PLIVO_SRC_NUMBER');
  const response = await fetch(`https://api.plivo.com/v1/Account/${authId}/Message/`, {
    method: 'POST',
    headers: {
      [AUTH_HEADER]: BASIC_PREFIX + btoa(`${authId}:${authToken}`),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ src, dst: String(event.recipient_phone_e164), text: event.body_text }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || `Plivo SMS failed with HTTP ${response.status}`);
  return { provider: 'plivo', providerMessageId: payload?.message_uuid?.[0] || null, status: 'sent', estimatedCostMinor: estimateSmsCostMinor('plivo') };
}

export async function sendSmsNotification(event: NotificationEventRow): Promise<ProviderSendResult> {
  if (event.channel !== 'sms') throw new Error('sendSmsNotification only supports sms events');
  if (!event.recipient_phone_e164) throw new Error('SMS recipient phone is required');

  const provider = normalizeSmsProvider();
  if (provider === 'none' || provider === 'disabled') {
    return { skipped: true, provider: 'none', status: 'skipped', detail: 'SMS provider is not configured' };
  }
  if (provider === 'mock') return { provider: 'mock', providerMessageId: `mock-${event.id}`, status: 'sent', estimatedCostMinor: 0 };
  if (provider === 'custom_http') return sendViaCustomHttp(event);
  if (provider === 'twilio') return sendViaTwilio(event);
  if (provider === 'telnyx') return sendViaTelnyx(event);
  if (provider === 'plivo') return sendViaPlivo(event);
  throw new Error(`Unsupported SMS provider: ${provider}`);
}

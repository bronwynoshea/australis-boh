import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedBohUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function generateAccessCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (byte) => codeAlphabet[byte % codeAlphabet.length]).join('');
  return `${code.slice(0, 3)}-${code.slice(3, 6)}`;
}

function normalizeAccessCode(rawCode: string) {
  return rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

async function sha256Hex(rawValue: string) {
  const data = new TextEncoder().encode(rawValue);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function resetSharedGuestCode(client: ReturnType<typeof cellarServiceClient>, bohUserId: string, reason: string) {
  const cellarGuestCode = generateAccessCode();
  const cellarCodeHash = await sha256Hex(normalizeAccessCode(cellarGuestCode));
  const { data, error } = await client.rpc('cellar_reset_guest_access_code', {
    p_code_hash: cellarCodeHash,
    p_boh_user_id: bohUserId,
    p_reset_reason: reason,
    p_metadata: { source: 'cellar_manage_guest_access_code' },
    p_cellar_display_code: cellarGuestCode,
  });
  if (error) throw new Error(error.message);
  const { data: summary, error: summaryError } = await client.rpc('cellar_current_guest_access_code_summary');
  if (summaryError) throw new Error(summaryError.message);
  return {
    cellar_guest_code: cellarGuestCode,
    cellar_guest_access_code: summary?.[0] ?? data?.[0] ?? null,
  };
}

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const staffUser = await cellarAuthenticatedBohUser(request);
    if (!staffUser) return cellarError('CELLAR_STAFF_AUTH_REQUIRED', 401);

    const body = await request.json().catch(() => ({}));
    const action = normalizeText(body.cellar_action || 'summary');
    const client = cellarServiceClient();

    if (action === 'summary') {
      const { data, error } = await client.rpc('cellar_current_guest_access_code_summary');
      if (error) return cellarError(error.message, 400);
      return cellarJson({ cellar_guest_access_code: data?.[0] ?? null });
    }

    if (action === 'reset') {
      const reset = await resetSharedGuestCode(
        client,
        staffUser.bohUserId,
        normalizeText(body.cellar_reset_reason) || 'manual_staff_reset',
      );
      return cellarJson({
        ...reset,
        cellar_plaintext_notice: 'CELLAR shared guest code is visible to staff for the active 14-day guest cycle.',
      }, 201);
    }

    return cellarError('CELLAR_GUEST_CODE_ACTION_UNKNOWN', 400);
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_GUEST_CODE_MANAGEMENT_FAILED', 500);
  }
});

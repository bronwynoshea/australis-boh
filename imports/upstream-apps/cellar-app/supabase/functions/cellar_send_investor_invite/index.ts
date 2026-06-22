import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarSendEmail } from '../_shared/cellar_email.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedBohUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function currentSharedGuestCode(client: ReturnType<typeof cellarServiceClient>) {
  const { data, error } = await client.rpc('cellar_current_guest_access_code_summary');
  if (error) throw new Error(error.message);
  const summary = data?.[0] ?? null;
  if (!summary?.guest_access_code_id || !summary?.cellar_guest_code) {
    throw new Error('CELLAR_ACTIVE_GUEST_CODE_REQUIRED');
  }
  return { cellar_guest_code: summary.cellar_guest_code, cellar_guest_access_code: summary };
}

async function isBohUserEmail(client: ReturnType<typeof cellarServiceClient>, email: string) {
  const { data, error } = await client.from('boh_user').select('id').ilike('email', email).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const staffUser = await cellarAuthenticatedBohUser(request);
    if (!staffUser) return cellarError('CELLAR_STAFF_AUTH_REQUIRED', 401);

    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.cellar_email);
    if (!email || !email.includes('@')) return cellarError('CELLAR_INVESTOR_EMAIL_REQUIRED', 400);

    const client = cellarServiceClient();
    const sentFromBohUserId = normalizeText(body.cellar_sent_from_boh_user_id) || staffUser.bohUserId;
    const { data: senderUser, error: senderError } = await client
      .from('boh_user')
      .select('id, email, display_name')
      .eq('id', sentFromBohUserId)
      .maybeSingle();
    if (senderError) return cellarError(senderError.message, 400);
    if (!senderUser?.id) return cellarError('CELLAR_SENT_FROM_USER_NOT_FOUND', 400);

    if (await isBohUserEmail(client, email)) {
      return cellarError('CELLAR_INVITE_RECIPIENT_IS_BOH_USER', 400);
    }

    const guestCode = await currentSharedGuestCode(client);
    const { data, error } = await client.rpc('cellar_prepare_guest_code_email', {
      p_email: email,
      p_full_name: normalizeText(body.cellar_full_name) || null,
      p_company: normalizeText(body.cellar_company) || null,
      p_title: normalizeText(body.cellar_title) || null,
      p_boh_user_id: staffUser.bohUserId,
      p_source_access_code_id: guestCode.cellar_guest_access_code.guest_access_code_id,
      p_metadata: {
        source: 'cellar_send_investor_invite',
        requested_by_boh_user_id: staffUser.bohUserId,
        sent_from_boh_user_id: String(senderUser.id),
      },
    });
    if (error) return cellarError(error.message, 400);

    const prepared = data?.[0] ?? null;
    if (prepared?.is_staff_email) return cellarError('CELLAR_INVITE_RECIPIENT_IS_BOH_USER', 400);
    if (!prepared?.investor_access_id) return cellarError('CELLAR_INVITE_RECORD_NOT_CREATED', 400);

    const { error: auditError } = await client
      .from('cellar_investor_access')
      .update({
        assigned_boh_user_id: String(senderUser.id),
        guest_code_sent_by_boh_user_id: staffUser.bohUserId,
        guest_code_sent_from_boh_user_id: String(senderUser.id),
        guest_code_sent_at: new Date().toISOString(),
      })
      .eq('id', prepared.investor_access_id);
    if (auditError) return cellarError(auditError.message, 400);

    const senderName = normalizeText(senderUser.display_name) || 'JOBZ CAFE®';
    const subject = `${senderName} has invited you to view the JOBZ CAFE® presentation`;
    const text = [
      `${senderName} has invited you to access the JOBZ CAFE® investor presentation through CELLAR, our private presentation workspace.`,
      '',
      'Your access code:',
      guestCode.cellar_guest_code,
      '',
      'Use this code to enter the presentation workspace and review the current JOBZ CAFE® materials.',
      '',
      'JOBZ CAFE®',
    ].join('\n');
    const html = [
      '<div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#24151f;max-width:620px;">',
      '<p style="margin:0 0 10px;color:#7a6673;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">JOBZ CAFE® investor presentation</p>',
      '<h1 style="margin:0 0 16px;color:#24151f;font-size:28px;line-height:1.16;">You have been invited to view the JOBZ CAFE® presentation</h1>',
      `<p style="margin:0 0 16px;color:#5f505b;font-size:15px;">${escapeHtml(senderName)} has invited you to access the JOBZ CAFE® investor presentation through CELLAR, our private presentation workspace.</p>`,
      '<p style="margin:0 0 18px;color:#5f505b;font-size:15px;">Use the access code below to enter the workspace and review the current materials prepared for invited investors.</p>',
      '<div style="margin:22px 0;padding:18px 20px;border:1px solid #e7dbe3;border-radius:10px;background:#fbf7fa;">',
      '<p style="margin:0 0 8px;color:#7a6673;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Access code</p>',
      `<div style="color:#24151f;font-size:28px;font-weight:750;letter-spacing:0.12em;">${escapeHtml(guestCode.cellar_guest_code)}</div>`,
      '</div>',
      `<p style="margin:20px 0 0;color:#7a6673;font-size:13px;">Invitation sent by ${escapeHtml(senderName)}.</p>`,
      '<p style="margin:6px 0 0;color:#7a6673;font-size:13px;">JOBZ CAFE®</p>',
      '</div>',
    ].join('');
    const delivery = await cellarSendEmail({ subject, html, text, to: [email] });

    return cellarJson({
      cellar_send_status: delivery.sent ? 'sent' : 'delivery_not_configured',
      cellar_delivery: delivery,
      cellar_email: { to: email, subject, text, html, from_name: senderUser.display_name, from_email: senderUser.email },
      cellar_recipient: prepared,
      cellar_guest_access_code: guestCode.cellar_guest_access_code,
      cellar_guest_code: guestCode.cellar_guest_code,
    }, delivery.sent ? 200 : 202);
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_SEND_INVESTOR_INVITE_FAILED', 500);
  }
});

import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarInvestorMessageEmail, cellarSendEmail } from '../_shared/cellar_email.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

const CELLAR_APPROVED_ACCESS_STATUSES = ['verified', 'appendix_requested', 'appendix_granted'];

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const body = await request.json().catch(() => ({}));
    const subject = String(body.cellar_subject ?? 'Investor question').trim();
    const messageBody = String(body.cellar_body ?? '').trim();
    const sessionId = String(body.cellar_session_id ?? '').trim();
    if (!messageBody) return cellarError('CELLAR_MESSAGE_BODY_REQUIRED', 400);

    const client = cellarServiceClient();
    const user = await cellarAuthenticatedUser(request);

    const { data: firstAuthAccess, error: authAccessError } = user
      ? await client
          .from('cellar_investor_access')
          .select('id, auth_user_id')
          .eq('auth_user_id', user.id)
          .in('access_status', CELLAR_APPROVED_ACCESS_STATUSES)
          .maybeSingle()
      : { data: null, error: null };
    if (authAccessError) return cellarError(authAccessError.message, 400);
    let authAccess = firstAuthAccess;

    if (!authAccess?.id && user?.email) {
      const byEmail = await client
        .from('cellar_investor_access')
        .select('id, auth_user_id')
        .ilike('email', normalizeEmail(user.email))
        .in('access_status', CELLAR_APPROVED_ACCESS_STATUSES)
        .maybeSingle();
      if (byEmail.error) return cellarError(byEmail.error.message, 400);
      authAccess = byEmail.data;

      if (authAccess?.id && authAccess.auth_user_id !== user.id) {
        await client
          .from('cellar_investor_access')
          .update({ auth_user_id: user.id })
          .eq('id', authAccess.id);
      }
    }

    const { data: sessionAccess, error: sessionAccessError } = !authAccess?.id && sessionId
      ? await client
          .from('cellar_investor_sessions')
          .select('investor_access_id')
          .eq('id', sessionId)
          .eq('session_kind', 'guest_code')
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()
      : { data: null, error: null };
    if (sessionAccessError) return cellarError(sessionAccessError.message, 400);

    const access = authAccess?.id ? authAccess : { id: sessionAccess?.investor_access_id };
    if (!access?.id) return cellarError('CELLAR_VERIFIED_INVESTOR_REQUIRED', 403);

    const { data: investorAccess, error: investorAccessError } = await client
      .from('cellar_investor_access')
      .select('email, full_name')
      .eq('id', access.id)
      .maybeSingle();
    if (investorAccessError) return cellarError(investorAccessError.message, 400);

    const { data: thread, error: threadError } = await client
      .from('cellar_message_threads')
      .insert({
        investor_access_id: access.id,
        subject: subject || 'Investor question',
        status: 'waiting_on_staff',
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (threadError) return cellarError(threadError.message, 400);

    const { data: message, error: messageError } = await client
      .from('cellar_messages')
      .insert({
        thread_id: thread.id,
        investor_access_id: access.id,
        sender_kind: 'investor',
        sender_auth_user_id: user?.id ?? null,
        body: messageBody,
      })
      .select('id')
      .single();
    if (messageError) return cellarError(messageError.message, 400);

    const cellarNotification = await cellarSendEmail(cellarInvestorMessageEmail({
      investorEmail: investorAccess?.email ?? user?.email ?? null,
      investorName: investorAccess?.full_name ?? null,
      subject: subject || 'Investor question',
      body: messageBody,
    }));

    return cellarJson({
      cellar_thread_id: thread.id,
      cellar_message_id: message.id,
      cellar_notification: cellarNotification,
    });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_CREATE_MESSAGE_THREAD_FAILED', 500);
  }
});

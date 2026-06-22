import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
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
    const body = await request.json();
    const client = cellarServiceClient();
    const user = await cellarAuthenticatedUser(request);
    if (!user) return cellarError('CELLAR_AUTH_REQUIRED', 401);
    const investorId = String(body.cellar_investor_access_id ?? '');
    const threadId = String(body.cellar_thread_id ?? '');
    const messageBody = String(body.cellar_body ?? '');
    if (!investorId || !threadId || !messageBody.trim()) return cellarError('CELLAR_MESSAGE_FIELDS_REQUIRED', 400);
    let { data: access } = await client.from('cellar_investor_access')
      .select('id, auth_user_id')
      .eq('id', investorId)
      .in('access_status', CELLAR_APPROVED_ACCESS_STATUSES)
      .maybeSingle();
    if (!access?.id && user.email) {
      const byEmail = await client
        .from('cellar_investor_access')
        .select('id, auth_user_id')
        .eq('id', investorId)
        .ilike('email', normalizeEmail(user.email))
        .in('access_status', CELLAR_APPROVED_ACCESS_STATUSES)
        .maybeSingle();
      access = byEmail.data;
    }

    if (!access?.id) return cellarError('CELLAR_MESSAGE_ACCESS_DENIED', 403);

    if (access.auth_user_id !== user.id) {
      await client
        .from('cellar_investor_access')
        .update({ auth_user_id: user.id })
        .eq('id', access.id);
    }

    const { data: thread } = await client
      .from('cellar_message_threads')
      .select('id')
      .eq('id', threadId)
      .eq('investor_access_id', investorId)
      .maybeSingle();
    if (!thread?.id) return cellarError('CELLAR_MESSAGE_THREAD_ACCESS_DENIED', 403);

    const { data, error } = await client.from('cellar_messages').insert({
      thread_id: threadId,
      investor_access_id: investorId,
      sender_kind: 'investor',
      sender_auth_user_id: user.id,
      body: messageBody,
    }).select('id').single();
    if (error) return cellarError(error.message, 400);
    await client
      .from('cellar_message_threads')
      .update({ status: 'waiting_on_staff', last_message_at: new Date().toISOString() })
      .eq('id', threadId);
    return cellarJson({ cellar_message_id: data.id });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_MESSAGE_SEND_FAILED', 500);
  }
});

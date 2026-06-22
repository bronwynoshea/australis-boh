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
    const body = await request.json().catch(() => ({}));
    const action = String(body.cellar_action ?? '').trim().toLowerCase();
    const threadId = String(body.cellar_thread_id ?? '').trim();
    const subject = String(body.cellar_subject ?? '').trim();

    if (!['rename', 'delete'].includes(action)) return cellarError('CELLAR_THREAD_ACTION_REQUIRED', 400);
    if (!threadId) return cellarError('CELLAR_THREAD_ID_REQUIRED', 400);
    if (action === 'rename' && !subject) return cellarError('CELLAR_THREAD_SUBJECT_REQUIRED', 400);

    const user = await cellarAuthenticatedUser(request);
    if (!user) return cellarError('CELLAR_VERIFIED_INVESTOR_REQUIRED', 403);

    const client = cellarServiceClient();
    const { data: thread, error: threadError } = await client
      .from('cellar_message_threads')
      .select('id, investor_access_id')
      .eq('id', threadId)
      .maybeSingle();
    if (threadError) return cellarError(threadError.message, 400);
    if (!thread?.id) return cellarError('CELLAR_MESSAGE_THREAD_NOT_FOUND', 404);

    const { data: access, error: accessError } = await client
      .from('cellar_investor_access')
      .select('id, auth_user_id, email, access_status')
      .eq('id', thread.investor_access_id)
      .maybeSingle();
    if (accessError) return cellarError(accessError.message, 400);

    const ownsThread =
      access?.id &&
      CELLAR_APPROVED_ACCESS_STATUSES.includes(access.access_status) &&
      (access.auth_user_id === user.id || normalizeEmail(access.email) === normalizeEmail(user.email));
    if (!ownsThread) return cellarError('CELLAR_MESSAGE_THREAD_ACCESS_DENIED', 403);

    if (action === 'rename') {
      const { error: renameError } = await client
        .from('cellar_message_threads')
        .update({ subject })
        .eq('id', thread.id);
      if (renameError) return cellarError(renameError.message, 400);
      return cellarJson({ cellar_thread_id: thread.id, cellar_subject: subject });
    }

    const { error: messagesError } = await client
      .from('cellar_messages')
      .delete()
      .eq('thread_id', thread.id);
    if (messagesError) return cellarError(messagesError.message, 400);

    const { error: deleteError } = await client
      .from('cellar_message_threads')
      .delete()
      .eq('id', thread.id);
    if (deleteError) return cellarError(deleteError.message, 400);

    return cellarJson({ cellar_thread_id: thread.id, cellar_deleted: true });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_MANAGE_MESSAGE_THREAD_FAILED', 500);
  }
});

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
    const client = cellarServiceClient();
    const user = await cellarAuthenticatedUser(request);
    if (!user) return cellarError('CELLAR_AUTH_REQUIRED', 401);

    const { data: firstAccess, error: accessError } = await client
      .from('cellar_investor_access')
      .select('id, auth_user_id')
      .eq('auth_user_id', user.id)
      .in('access_status', CELLAR_APPROVED_ACCESS_STATUSES)
      .maybeSingle();
    if (accessError) return cellarError(accessError.message, 400);
    let access = firstAccess;

    if (!access?.id && user.email) {
      const byEmail = await client
        .from('cellar_investor_access')
        .select('id, auth_user_id')
        .ilike('email', normalizeEmail(user.email))
        .in('access_status', CELLAR_APPROVED_ACCESS_STATUSES)
        .maybeSingle();
      if (byEmail.error) return cellarError(byEmail.error.message, 400);
      access = byEmail.data;

      if (access?.id && access.auth_user_id !== user.id) {
        await client
          .from('cellar_investor_access')
          .update({ auth_user_id: user.id })
          .eq('id', access.id);
      }
    }

    if (!access?.id) return cellarJson({ cellar_messages_enabled: false, cellar_message_threads: [] });

    const { data: threads, error: threadError } = await client
      .from('cellar_message_threads')
      .select('id, investor_access_id, subject, status, last_message_at, created_at')
      .eq('investor_access_id', access.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(25);
    if (threadError) return cellarError(threadError.message, 400);

    const threadIds = (threads ?? []).map((thread) => thread.id);
    const { data: messages, error: messageError } = threadIds.length
      ? await client
          .from('cellar_messages')
          .select('id, thread_id, sender_kind, sender_boh_user_id, body, sent_at')
          .in('thread_id', threadIds)
          .order('sent_at', { ascending: true })
      : { data: [], error: null };
    if (messageError) return cellarError(messageError.message, 400);

    const staffSenderIds = Array.from(new Set(
      (messages ?? [])
        .map((message) => message.sender_boh_user_id)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    ));
    const { data: staffSenders, error: staffSenderError } = staffSenderIds.length
      ? await client
          .from('boh_user')
          .select('id, email, display_name')
          .in('id', staffSenderIds)
      : { data: [], error: null };
    if (staffSenderError) return cellarError(staffSenderError.message, 400);

    const staffSenderById = new Map(
      (staffSenders ?? []).map((staff) => [
        String(staff.id),
        String(staff.display_name || staff.email?.split('@')[0] || 'JOBZ CAFE').trim(),
      ]),
    );

    const cellarThreads = (threads ?? []).map((thread) => ({
      ...thread,
      messages: (messages ?? [])
        .filter((message) => message.thread_id === thread.id)
        .map((message) => ({
          ...message,
          sender_display_name: message.sender_boh_user_id
            ? staffSenderById.get(String(message.sender_boh_user_id)) ?? null
            : null,
        })),
    }));

    return cellarJson({ cellar_messages_enabled: true, cellar_message_threads: cellarThreads });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_LIST_MESSAGES_FAILED', 500);
  }
});

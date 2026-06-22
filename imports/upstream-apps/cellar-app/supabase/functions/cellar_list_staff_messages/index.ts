import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedBohUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

type CellarStaffVisibilityPermission = {
  investor_access_id: string;
  permission_level: string;
  expires_at: string | null;
};

function cellarPermissionIsActive(permission: CellarStaffVisibilityPermission) {
  return !permission.expires_at || new Date(permission.expires_at).getTime() > Date.now();
}

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const staffUser = await cellarAuthenticatedBohUser(request);
    if (!staffUser) return cellarError('CELLAR_STAFF_AUTH_REQUIRED', 401);

    const client = cellarServiceClient();
    const { data: staffVisibleAccess, error: staffVisibleAccessError } = await client
      .from('cellar_investor_access')
      .select('id')
      .in('access_status', ['verified', 'appendix_requested', 'appendix_granted']);
    if (staffVisibleAccessError) return cellarError(staffVisibleAccessError.message, 400);

    const { data: visibilityRows, error: visibilityError } = await client
      .from('cellar_staff_visibility_permissions')
      .select('investor_access_id, permission_level, expires_at')
      .eq('boh_user_id', staffUser.bohUserId);
    if (visibilityError) return cellarError(visibilityError.message, 400);

    const visibleInvestorIds = new Set((staffVisibleAccess ?? []).map((access) => String(access.id)));
    const hiddenInvestorIds = new Set<string>();
    for (const permission of (visibilityRows ?? []) as CellarStaffVisibilityPermission[]) {
      if (!cellarPermissionIsActive(permission)) continue;
      if (permission.permission_level === 'hidden') {
        hiddenInvestorIds.add(permission.investor_access_id);
        visibleInvestorIds.delete(permission.investor_access_id);
      }
      if (['viewer', 'responder', 'owner'].includes(permission.permission_level)) {
        visibleInvestorIds.add(permission.investor_access_id);
      }
    }
    for (const investorId of hiddenInvestorIds) visibleInvestorIds.delete(investorId);

    const visibleIds = [...visibleInvestorIds];
    if (!visibleIds.length) {
      return cellarJson({
        cellar_staff_boh_user_id: staffUser.bohUserId,
        cellar_message_threads: [],
      });
    }

    const { data: threads, error: threadError } = await client
      .from('cellar_message_threads')
      .select(`
        id,
        investor_access_id,
        subject,
        status,
        last_message_at,
        created_at,
        cellar_investor_access:investor_access_id (
          email,
          full_name,
          company,
          title,
          access_status,
          pipeline_status
        )
      `)
      .in('investor_access_id', visibleIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(50);
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

    const cellarThreads = (threads ?? []).map((thread) => ({
      ...thread,
      messages: (messages ?? []).filter((message) => message.thread_id === thread.id),
    }));

    return cellarJson({
      cellar_staff_boh_user_id: staffUser.bohUserId,
      cellar_message_threads: cellarThreads,
    });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_LIST_STAFF_MESSAGES_FAILED', 500);
  }
});

import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarAuthenticatedBohUser, cellarServiceClient } from '../_shared/cellar_supabase.ts';

type CellarStaffVisibilityPermission = {
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

    const body = await request.json().catch(() => ({}));
    const threadId = String(body.cellar_thread_id ?? '').trim();
    const messageBody = String(body.cellar_body ?? '').trim();
    if (!threadId || !messageBody) return cellarError('CELLAR_STAFF_MESSAGE_FIELDS_REQUIRED', 400);

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
      .select('assigned_boh_user_id, access_status')
      .eq('id', thread.investor_access_id)
      .maybeSingle();
    if (accessError) return cellarError(accessError.message, 400);

    const { data: visibilityRows, error: visibilityError } = await client
      .from('cellar_staff_visibility_permissions')
      .select('permission_level, expires_at')
      .eq('investor_access_id', thread.investor_access_id)
      .eq('boh_user_id', staffUser.bohUserId);
    if (visibilityError) return cellarError(visibilityError.message, 400);

    const activePermissions = ((visibilityRows ?? []) as CellarStaffVisibilityPermission[])
      .filter(cellarPermissionIsActive);
    const isHidden = activePermissions.some((permission) => permission.permission_level === 'hidden');
    const canRespond =
      !isHidden &&
      (
        ['verified', 'appendix_requested', 'appendix_granted'].includes(String(access?.access_status ?? '')) ||
        access?.assigned_boh_user_id === staffUser.bohUserId ||
        activePermissions.some((permission) => ['responder', 'owner'].includes(permission.permission_level))
      );
    if (!canRespond) return cellarError('CELLAR_MESSAGE_ACCESS_DENIED', 403);

    const { data: message, error: messageError } = await client
      .from('cellar_messages')
      .insert({
        thread_id: thread.id,
        investor_access_id: thread.investor_access_id,
        sender_kind: 'staff',
        sender_auth_user_id: staffUser.authUserId,
        sender_boh_user_id: staffUser.bohUserId,
        body: messageBody,
      })
      .select('id')
      .single();
    if (messageError) return cellarError(messageError.message, 400);

    await client
      .from('cellar_message_threads')
      .update({
        assigned_boh_user_id: staffUser.bohUserId,
        status: 'waiting_on_investor',
        last_message_at: new Date().toISOString(),
      })
      .eq('id', thread.id);

    return cellarJson({ cellar_message_id: message.id });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_SEND_STAFF_MESSAGE_FAILED', 500);
  }
});

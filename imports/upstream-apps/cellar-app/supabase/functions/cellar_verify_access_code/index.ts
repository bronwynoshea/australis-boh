import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarServiceClient } from '../_shared/cellar_supabase.ts';

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const body = await request.json();
    const cellarAccessCode = String(body.cellar_access_code ?? '');
    if (!cellarAccessCode.trim()) return cellarError('CELLAR_ACCESS_CODE_REQUIRED', 400);

    const client = cellarServiceClient();
    const { data, error } = await client.rpc('cellar_verify_guest_access_code', {
      p_raw_code: cellarAccessCode,
      p_user_agent: request.headers.get('user-agent'),
      p_ip_hash: body.cellar_ip_hash ?? null,
    });
    if (error) return cellarError(error.message, 401);
    return cellarJson({ cellar_session: data?.[0] ?? null });
  } catch (error) {
    return cellarError(error instanceof Error ? error.message : 'CELLAR_VERIFY_ACCESS_FAILED', 500);
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import { cellarBearerToken, cellarServiceClient } from '../_shared/cellar_supabase.ts';

const CELLAR_ALLOWED_BOH_ORIGINS = new Set([
  'https://boh.jobzcafe.com',
  'https://dev-boh.jobzcafe.com',
  'https://boh.australis.cloud',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? '';
  const allowedOrigin = CELLAR_ALLOWED_BOH_ORIGINS.has(origin) ? origin : 'https://boh.jobzcafe.com';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(request: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}

function error(request: Request, message: string, status = 400) {
  return json(request, { error: message }, status);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return error(request, 'CELLAR_METHOD_NOT_ALLOWED', 405);

  const origin = request.headers.get('origin') ?? '';
  if (!CELLAR_ALLOWED_BOH_ORIGINS.has(origin)) {
    return error(request, 'CELLAR_BOH_ORIGIN_NOT_ALLOWED', 403);
  }

  try {
    const token = cellarBearerToken(request);
    if (!token) return error(request, 'CELLAR_BOH_AUTH_REQUIRED', 401);

    const adminClient = cellarServiceClient();
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    const user = userData.user;
    if (userError || !user?.id) return error(request, 'CELLAR_BOH_AUTH_INVALID', 401);

    const { data: bohUser, error: bohUserError } = await adminClient
      .from('boh_user')
      .select('id, email, status')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (bohUserError) return error(request, bohUserError.message, 400);
    if (!bohUser?.id || bohUser.status === 'inactive') {
      return error(request, 'CELLAR_BOH_STAFF_ACCESS_REQUIRED', 403);
    }

    const email = String(bohUser.email ?? user.email ?? '').trim().toLowerCase();
    if (!email) return error(request, 'CELLAR_BOH_STAFF_EMAIL_REQUIRED', 400);

    const supabaseUrl = Deno.env.get('CELLAR_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('CELLAR_SUPABASE_ADMIN_KEY');
    if (!supabaseUrl || !serviceKey) return error(request, 'CELLAR_SUPABASE_SERVICE_CONFIG_MISSING', 500);

    const authAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: linkData, error: linkError } = await authAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError) return error(request, linkError.message, 400);
    const tokenHash = linkData.properties?.hashed_token;
    if (!tokenHash) return error(request, 'CELLAR_BOH_HANDOFF_TOKEN_MISSING', 500);

    return json(request, {
      cellar_boh_embed_handoff: {
        type: 'CELLAR_BOH_EMBED_HANDOFF',
        email,
        token_hash: tokenHash,
        expires_in_seconds: 300,
      },
    });
  } catch (caught) {
    return error(
      request,
      caught instanceof Error ? caught.message : 'CELLAR_BOH_EMBED_HANDOFF_FAILED',
      500,
    );
  }
});

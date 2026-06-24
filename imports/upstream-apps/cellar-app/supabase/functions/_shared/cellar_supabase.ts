import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

// CELLAR functions use current Supabase Auth bearer validation, not the legacy JWT secret.
export function cellarServiceClient() {
  const cellarUrl = Deno.env.get('CELLAR_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL');
  const cellarAdminKey = Deno.env.get('CELLAR_SUPABASE_ADMIN_KEY');
  if (!cellarUrl || !cellarAdminKey) {
    throw new Error('CELLAR_SUPABASE_SERVICE_CONFIG_MISSING');
  }
  return createClient(cellarUrl, cellarAdminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function cellarBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function cellarAuthenticatedUser(request: Request) {
  const token = cellarBearerToken(request);
  if (!token) return null;
  const client = cellarServiceClient();
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user ?? null;
}

export async function cellarAuthenticatedBohUser(request: Request) {
  const user = await cellarAuthenticatedUser(request);
  if (!user) return null;
  const client = cellarServiceClient();
  const { data } = await client.from('boh_user')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('app_context', 'boh')
    .maybeSingle();
  return data?.id && data?.tenant_id
    ? { authUserId: user.id, bohUserId: String(data.id), tenantId: String(data.tenant_id) }
    : null;
}

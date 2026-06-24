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
    const user = await cellarAuthenticatedUser(request);
    if (!user?.id) {
      return cellarJson({
        cellar_workspace_access: {
          mode: 'anonymous',
          can_staff: false,
          can_investor: false,
          auth_user_id: null,
          boh_user_id: null,
          tenant_id: null,
          investor_access_id: null,
          access_status: null,
          email: null,
          first_name: null,
          last_name: null,
          full_name: null,
        },
      });
    }

    const client = cellarServiceClient();
    const email = normalizeEmail(user.email);
    const { data: bohUser, error: bohUserError } = await client
      .from('boh_user')
      .select('id, email, status, tenant_id')
      .eq('auth_user_id', user.id)
      .eq('app_context', 'boh')
      .maybeSingle();

    if (bohUserError) return cellarError(bohUserError.message, 400);

    if (bohUser?.id) {
      return cellarJson({
        cellar_workspace_access: {
          mode: 'staff',
          can_staff: true,
          can_investor: false,
          auth_user_id: user.id,
          boh_user_id: String(bohUser.id),
          tenant_id: bohUser.tenant_id ? String(bohUser.tenant_id) : null,
          investor_access_id: null,
          access_status: null,
          email: String(bohUser.email ?? user.email ?? ''),
          first_name: null,
          last_name: null,
          full_name: null,
        },
      });
    }

    const { data: firstInvestorAccess, error: investorAccessError } = await client
      .from('cellar_investor_access')
      .select('id, email, full_name, access_status, verified_at, auth_user_id, tenant_id')
      .eq('auth_user_id', user.id)
      .in('access_status', CELLAR_APPROVED_ACCESS_STATUSES)
      .order('verified_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (investorAccessError) return cellarError(investorAccessError.message, 400);
    let investorAccess = firstInvestorAccess;

    if (!investorAccess?.id && email) {
      const byEmail = await client
        .from('cellar_investor_access')
        .select('id, email, full_name, access_status, verified_at, auth_user_id, tenant_id')
        .ilike('email', email)
        .in('access_status', CELLAR_APPROVED_ACCESS_STATUSES)
        .order('verified_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byEmail.error) return cellarError(byEmail.error.message, 400);
      investorAccess = byEmail.data;
    }

    const { data: firstInvestorProfile, error: investorProfileError } = investorAccess?.id
      ? await client
          .from('cellar_investor_profiles')
          .select('email, first_name, last_name, title, company, metadata, profile_status, reviewed_at, auth_user_id, tenant_id')
          .eq('investor_access_id', investorAccess.id)
          .eq('tenant_id', investorAccess.tenant_id)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };

    if (investorProfileError) return cellarError(investorProfileError.message, 400);
    let investorProfile = firstInvestorProfile;

    if (!investorAccess?.id && email) {
      const byProfile = await client
        .from('cellar_investor_profiles')
        .select('email, first_name, last_name, title, company, metadata, profile_status, reviewed_at, auth_user_id, investor_access_id, tenant_id')
        .ilike('email', email)
        .eq('profile_status', 'verified')
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byProfile.error) return cellarError(byProfile.error.message, 400);

      if (byProfile.data?.investor_access_id) {
        const byProfileAccess = await client
          .from('cellar_investor_access')
          .select('id, email, full_name, access_status, verified_at, auth_user_id, tenant_id')
          .eq('id', byProfile.data.investor_access_id)
          .eq('tenant_id', byProfile.data.tenant_id)
          .in('access_status', CELLAR_APPROVED_ACCESS_STATUSES)
          .maybeSingle();
        if (byProfileAccess.error) return cellarError(byProfileAccess.error.message, 400);
        investorAccess = byProfileAccess.data;
        investorProfile = byProfile.data;
      }
    }

    if (investorAccess?.id && investorAccess.auth_user_id !== user.id) {
      await client
        .from('cellar_investor_access')
        .update({ auth_user_id: user.id })
        .eq('id', investorAccess.id)
        .eq('tenant_id', investorAccess.tenant_id);
    }

    if (investorAccess?.id && investorProfile && investorProfile.auth_user_id !== user.id) {
      await client
        .from('cellar_investor_profiles')
        .update({ auth_user_id: user.id })
        .eq('investor_access_id', investorAccess.id)
        .eq('tenant_id', investorAccess.tenant_id)
        .ilike('email', investorProfile.email ?? email);
    }

    return cellarJson({
      cellar_workspace_access: {
        mode: investorAccess?.id ? 'investor' : 'unverified',
        can_staff: false,
        can_investor: Boolean(investorAccess?.id),
        auth_user_id: user.id,
        boh_user_id: null,
        tenant_id: investorAccess?.tenant_id ?? investorProfile?.tenant_id ?? null,
        investor_access_id: investorAccess?.id ?? null,
        access_status: investorAccess?.access_status ?? null,
        email: investorProfile?.email ?? investorAccess?.email ?? user.email ?? null,
        first_name: investorProfile?.first_name ?? null,
        last_name: investorProfile?.last_name ?? null,
        full_name: investorAccess?.full_name ?? null,
        title: investorProfile?.title ?? null,
        company: investorProfile?.company ?? null,
        phone: typeof investorProfile?.metadata?.phone === 'string'
          ? investorProfile.metadata.phone
          : typeof investorProfile?.metadata?.phone_number === 'string'
            ? investorProfile.metadata.phone_number
            : null,
        verified_at: investorAccess?.verified_at ?? investorProfile?.reviewed_at ?? null,
      },
    });
  } catch (error) {
    return cellarError(
      error instanceof Error ? error.message : 'CELLAR_WORKSPACE_ACCESS_RESOLVE_FAILED',
      500,
    );
  }
});

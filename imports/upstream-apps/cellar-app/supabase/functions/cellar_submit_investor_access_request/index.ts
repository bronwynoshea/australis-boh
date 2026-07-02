import { cellarHandleOptions } from '../_shared/cellar_cors.ts';
import { cellarInvestorAccessRequestEmail, cellarSendEmail } from '../_shared/cellar_email.ts';
import { cellarError, cellarJson } from '../_shared/cellar_response.ts';
import { cellarServiceClient } from '../_shared/cellar_supabase.ts';

const allowedInvestorCategories = new Set([
  'individual',
  'angel',
  'fund',
  'family_office',
  'strategic',
  'advisor',
  'other',
]);

function normalizeEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

Deno.serve(async (request) => {
  const options = cellarHandleOptions(request);
  if (options) return options;
  if (request.method !== 'POST') return cellarError('CELLAR_METHOD_NOT_ALLOWED', 405);

  try {
    const body = await request.json().catch(() => ({}));
    const cellarEmail = normalizeEmail(body.cellar_email);
    const cellarFirstName = String(body.cellar_first_name ?? '').trim();
    const cellarLastName = String(body.cellar_last_name ?? '').trim();
    const cellarInvestorCategory = String(body.cellar_investor_category ?? '').trim().toLowerCase();
    const cellarTitle = String(body.cellar_title ?? '').trim();
    const cellarCompany = String(body.cellar_company ?? '').trim();

    if (!cellarEmail || !cellarEmail.includes('@')) return cellarError('CELLAR_INVESTOR_EMAIL_REQUIRED', 400);
    if (!cellarFirstName) return cellarError('CELLAR_INVESTOR_FIRST_NAME_REQUIRED', 400);
    if (!cellarLastName) return cellarError('CELLAR_INVESTOR_LAST_NAME_REQUIRED', 400);
    if (!allowedInvestorCategories.has(cellarInvestorCategory)) {
      return cellarError('CELLAR_INVESTOR_CATEGORY_REQUIRED', 400);
    }

    const client = cellarServiceClient();
    const { data: bohUser, error: bohUserError } = await client
      .from('boh_user')
      .select('id')
      .ilike('email', cellarEmail)
      .maybeSingle();
    if (bohUserError) return cellarError(bohUserError.message, 400);
    if (bohUser?.id) {
      return cellarJson({
        cellar_staff_email: true,
        message: 'CELLAR_STAFF_EMAIL_SKIPPED',
      });
    }

    let patronPersonId: string | null = null;
    const { data: existingPatron, error: existingPatronError } = await client
      .from('patron_person')
      .select('id, person_type_key')
      .ilike('email', cellarEmail)
      .maybeSingle();
    if (existingPatronError && !existingPatronError.message.includes('does not exist')) {
      return cellarError(existingPatronError.message, 400);
    }
    if (existingPatron?.person_type_key === 'staff_internal') {
      return cellarJson({
        cellar_staff_email: true,
        message: 'CELLAR_STAFF_EMAIL_SKIPPED',
      });
    }

    const cellarFullName = `${cellarFirstName} ${cellarLastName}`.trim();
    if (existingPatron?.id) {
      patronPersonId = existingPatron.id;
      await client
        .from('patron_person')
        .update({
          first_name: cellarFirstName,
          last_name: cellarLastName,
          display_name: cellarFullName,
          person_type_key: 'investor',
          app_context: 'patron',
          source: 'cellar_investor_access_request',
        })
        .eq('id', patronPersonId);
    } else if (!existingPatronError) {
      const { data: patron, error: patronError } = await client
        .from('patron_person')
        .insert({
          first_name: cellarFirstName,
          last_name: cellarLastName,
          email: cellarEmail,
          display_name: cellarFullName,
          source: 'cellar_investor_access_request',
          person_type_key: 'investor',
          app_context: 'patron',
        })
        .select('id')
        .single();
      if (patronError) return cellarError(patronError.message, 400);
      patronPersonId = patron.id;
    }

    const { data: existingAccess, error: existingAccessError } = await client
      .from('cellar_investor_access')
      .select('id, access_status')
      .ilike('email', cellarEmail)
      .maybeSingle();
    if (existingAccessError) return cellarError(existingAccessError.message, 400);

    let investorAccessId = existingAccess?.id ?? null;
    const accessPayload = {
      patron_crm_id: patronPersonId,
      patron_person_id: patronPersonId,
      email: cellarEmail,
      full_name: cellarFullName,
      company: cellarCompany || null,
      title: cellarTitle || null,
      access_status: ['verified', 'appendix_requested', 'appendix_granted'].includes(existingAccess?.access_status ?? '')
        ? existingAccess?.access_status
        : 'verification_pending',
      pipeline_status: ['verified', 'appendix_requested', 'appendix_granted'].includes(existingAccess?.access_status ?? '')
        ? 'new_investor'
        : 'profile_submitted',
      consent_metadata: {
        profile_submitted_at: new Date().toISOString(),
      },
      metadata: {
        source: 'cellar_investor_access_request',
        user_agent: request.headers.get('user-agent'),
      },
    };

    if (investorAccessId) {
      const { error: accessUpdateError } = await client
        .from('cellar_investor_access')
        .update(accessPayload)
        .eq('id', investorAccessId);
      if (accessUpdateError) return cellarError(accessUpdateError.message, 400);
    } else {
      const { data: access, error: accessInsertError } = await client
        .from('cellar_investor_access')
        .insert(accessPayload)
        .select('id')
        .single();
      if (accessInsertError) return cellarError(accessInsertError.message, 400);
      investorAccessId = access.id;
    }

    const { data: existingProfile, error: existingProfileError } = await client
      .from('cellar_investor_profiles')
      .select('id, profile_status')
      .eq('investor_access_id', investorAccessId)
      .maybeSingle();
    if (existingProfileError) return cellarError(existingProfileError.message, 400);

    const profilePayload = {
      investor_access_id: investorAccessId,
      patron_person_id: patronPersonId,
      email: cellarEmail,
      first_name: cellarFirstName,
      last_name: cellarLastName,
      investor_category: cellarInvestorCategory,
      title: cellarTitle || null,
      company: cellarCompany || null,
      profile_status: existingProfile?.profile_status === 'verified' ? 'verified' : 'verification_pending',
      consent_metadata: {
        terms_accepted_at: new Date().toISOString(),
      },
      metadata: {
        source: 'cellar_investor_access_request',
        user_agent: request.headers.get('user-agent'),
      },
      submitted_at: new Date().toISOString(),
    };

    let investorProfileId = existingProfile?.id ?? null;
    if (investorProfileId) {
      const { error: profileUpdateError } = await client
        .from('cellar_investor_profiles')
        .update(profilePayload)
        .eq('id', investorProfileId);
      if (profileUpdateError) return cellarError(profileUpdateError.message, 400);
    } else {
      const { data: profile, error: profileInsertError } = await client
        .from('cellar_investor_profiles')
        .insert(profilePayload)
        .select('id')
        .single();
      if (profileInsertError) return cellarError(profileInsertError.message, 400);
      investorProfileId = profile.id;
    }

    const cellarNotification = await cellarSendEmail(cellarInvestorAccessRequestEmail({
      email: cellarEmail,
      firstName: cellarFirstName,
      lastName: cellarLastName,
      investorCategory: cellarInvestorCategory,
      title: cellarTitle,
      company: cellarCompany,
      investorAccessId,
      investorProfileId,
    }));

    return cellarJson({
      cellar_access_request: {
        normalized_email: cellarEmail,
        is_staff_email: false,
        patron_person_id: patronPersonId,
        investor_access_id: investorAccessId,
        investor_profile_id: investorProfileId,
        access_status: accessPayload.access_status,
        profile_status: profilePayload.profile_status,
      },
      cellar_notification: cellarNotification,
    });
  } catch (error) {
    return cellarError(
      error instanceof Error ? error.message : 'CELLAR_INVESTOR_ACCESS_REQUEST_FAILED',
      500,
    );
  }
});

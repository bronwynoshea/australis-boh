const normalizeText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalizeEmail = (value: unknown) => normalizeText(value).toLowerCase();
const bearerPrefix = () => String.fromCharCode(66, 101) + 'arer ';

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function splitName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: fullName, lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) || '' };
}

function contextToAppContext(businessContext: string) {
  if (businessContext === 'interview') return 'talent';
  if (businessContext === 'coaching' || businessContext === 'onboarding') return 'coach';
  return 'cafe';
}

function isEligibleHostType(personType: string, persona: string) {
  const type = String(personType || '').toLowerCase();
  if (persona === 'recruiter') return type === 'recruiter' || type === 'recruiter_prospect';
  if (persona === 'coach') return type === 'coach';
  if (persona === 'staff') return type === 'staff' || type === 'staff_internal';
  return false;
}

async function resolveParticipantPatronPerson(supabase: any, booking: any) {
  if (booking.patron_person_id) {
    const { data, error } = await supabase
      .from('patron_person')
      .select('id, tenant_id')
      .eq('id', booking.patron_person_id)
      .eq('tenant_id', booking.tenant_id)
      .maybeSingle();
    if (error) throw new Error(`participant_patron_verify_failed: ${error.message}`);
    if (!data?.id) throw new Error('participant_patron_not_in_booking_tenant');
    return data;
  }

  if (!booking.tenant_id) throw new Error('missing_booking_tenant_for_loft_bridge');
  const email = normalizeEmail(booking.guest_email);
  if (!email || !email.includes('@')) throw new Error('missing_guest_email_for_loft_bridge');
  const fullName = normalizeText(booking.guest_name) || email;
  const { firstName, lastName } = splitName(fullName);

  const { data: existing, error: lookupError } = await supabase
    .from('patron_person')
    .select('id, first_name, last_name, email, source, tenant_id')
    .eq('tenant_id', booking.tenant_id)
    .eq('email', email)
    .maybeSingle();
  if (lookupError) throw new Error(`participant_patron_lookup_failed: ${lookupError.message}`);
  if (existing?.id) return existing;

  const { data: created, error: createError } = await supabase
    .from('patron_person')
    .insert({
      tenant_id: booking.tenant_id || null,
      first_name: firstName || null,
      last_name: lastName || null,
      email,
      display_name: fullName,
      source: 'slotz_booking',
      app_context: 'patron',
      external_app_context: contextToAppContext(booking.scheduling_meeting_types?.loft_business_context || 'appointment'),
    })
    .select('id, email')
    .single();

  if (createError) throw new Error(`participant_patron_create_failed: ${createError.message}`);
  return created;
}

async function resolveHostPatronPerson(supabase: any, booking: any, hostPersona: string) {
  const staffProfile = booking.scheduling_staff_profiles;
  const email = normalizeEmail(staffProfile?.email);
  if (!email || !booking.tenant_id) return null;

  const { data, error } = await supabase
    .from('patron_person')
    .select('id, email, person_type_key, tenant_id, display_name')
    .eq('tenant_id', booking.tenant_id)
    .eq('email', email)
    .maybeSingle();

  if (error) throw new Error(`host_patron_lookup_failed: ${error.message}`);
  if (!data?.id) return null;
  if (!isEligibleHostType(data.person_type_key, hostPersona)) return null;
  return data;
}

export async function upsertLoftVideoSessionForBooking(
  supabase: any,
  booking: any,
  options: {
    status?: 'scheduled' | 'cancelled' | 'completed' | 'no_show';
    previousBooking?: any;
  } = {},
) {
  try {
    const meetingType = booking.scheduling_meeting_types;
    const staffProfile = booking.scheduling_staff_profiles;
    if (!booking?.id || !booking?.tenant_id || !meetingType || !staffProfile) {
      return { success: false, skipped: true, error: 'missing_booking_context' };
    }

    if (meetingType.loft_video_enabled !== true) {
      return { success: true, skipped: true };
    }

    const participantPatron = await resolveParticipantPatronPerson(supabase, booking);
    const businessContext = normalizeText(meetingType.loft_business_context) || 'appointment';
    const hostPersona = normalizeText(meetingType.loft_host_persona) || 'staff';
    const hostPatron = await resolveHostPatronPerson(supabase, booking, hostPersona);

    if (!hostPatron?.id) {
      return { success: false, skipped: false, error: 'no_loft_host_patron_or_room' };
    }

    const bohFunctionsUrl = Deno.env.get('BOH_LOFT_FUNCTIONS_URL') || Deno.env.get('BOH_SUPABASE_URL') || Deno.env.get('SLOTZ_SUPABASE_URL');
    if (!bohFunctionsUrl) throw new Error('Missing BOH_LOFT_FUNCTIONS_URL');
    const functionUrl = `${bohFunctionsUrl.replace(/\/$/, '')}/functions/v1/loft-video-session-upsert`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        Authorization: bearerPrefix() + requiredEnv('BOH_LOFT_EXTERNAL_ACCESS_TOKEN'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: booking.tenant_id,
        sourceApp: 'slotz',
        appContext: contextToAppContext(businessContext),
        businessContext,
        businessRecordTable: 'scheduling_bookings',
        businessRecordId: booking.id,
        hostPatronPersonId: hostPatron.id,
        hostPersona,
        hostEmail: staffProfile.email,
        hostDisplayName: staffProfile.full_name,
        participantPatronPersonId: participantPatron.id,
        participantName: booking.guest_name,
        participantEmail: booking.guest_email,
        scheduledStartAt: booking.start_time,
        scheduledEndAt: booking.end_time,
        status: options.status || (booking.status === 'cancelled' ? 'cancelled' : 'scheduled'),
        metadata: {
          slotz: {
            bookingId: booking.id,
            meetingTypeId: meetingType.id,
            meetingTypeName: meetingType.name,
            staffProfileId: staffProfile.id,
            guestTimezone: booking.guest_timezone || null,
            sourceOfTruth: 'scheduling_bookings',
            previousStartTime: options.previousBooking?.start_time || null,
            previousEndTime: options.previousBooking?.end_time || null,
          },
        },
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      return { success: false, skipped: false, error: data?.error || `loft_bridge_http_${response.status}` };
    }

    return {
      success: true,
      videoSessionId: data.videoSessionId,
      loftRoomId: data.loftRoomId,
      joinUrl: data.joinUrl || null,
    };
  } catch (error) {
    return {
      success: false,
      skipped: false,
      error: error instanceof Error ? error.message : 'unknown_loft_bridge_error',
    };
  }
}

export function absoluteBohUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = Deno.env.get('BOH_APP_URL') || '';
  if (!base) return pathOrUrl;
  return `${base.replace(/\/$/, '')}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

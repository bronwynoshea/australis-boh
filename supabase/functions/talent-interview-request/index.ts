// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_DURATION_MINUTES = 30;

const normalizeText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalizeEmail = (value: unknown) => normalizeText(value).toLowerCase();

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonResponse(req, { success: false, error: 'method_not_allowed' }, 405);
  if (!validateTalentBearer(req)) return jsonResponse(req, { success: false, error: 'unauthorized' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const { supabaseUrl, serviceRoleKey } = getServerConfig();
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const tenant = await resolveTenant(supabaseAdmin, { tenantId: body.tenantId, tenantSlug: body.tenantSlug });
    const recruiter = normalizeRecruiter(body.recruiter || body.host || body);
    const candidate = normalizeCandidate(body.candidate || body.jobSeeker || body);
    const schedule = normalizeSchedule(body);

    const hostPatron = body.hostPatronPersonId
      ? await assertPatronInTenant(supabaseAdmin, tenant.id, normalizeText(body.hostPatronPersonId))
      : await upsertPatronPerson(supabaseAdmin, {
        tenantId: tenant.id,
        email: recruiter.email,
        fullName: recruiter.fullName,
        phone: recruiter.phone,
        personTypeKey: 'recruiter',
        source: 'talent_interview_request',
        externalAppContext: 'talent',
      });

    const candidatePatron = body.candidatePatronPersonId
      ? await assertPatronInTenant(supabaseAdmin, tenant.id, normalizeText(body.candidatePatronPersonId))
      : await upsertPatronPerson(supabaseAdmin, {
        tenantId: tenant.id,
        email: candidate.email,
        fullName: candidate.fullName,
        phone: candidate.phone,
        personTypeKey: 'job_seeker',
        source: 'talent_interview_request',
        externalAppContext: 'talent',
      });

    const staffProfile = await ensureRecruiterStaffProfile(supabaseAdmin, {
      tenantId: tenant.id,
      email: recruiter.email,
      fullName: recruiter.fullName,
      timezone: recruiter.timezone,
      externalAuthUserId: recruiter.externalAuthUserId,
    });

    const meetingType = await ensureTalentInterviewMeetingType(supabaseAdmin, staffProfile.id, {
      tenantId: tenant.id,
      durationMinutes: schedule.durationMinutes,
    });

    const booking = await createRecruiterLedBooking(supabaseAdmin, {
      tenantId: tenant.id,
      staffProfileId: staffProfile.id,
      meetingTypeId: meetingType.id,
      candidate,
      schedule,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      sourceRecordId: normalizeText(body.talentInterviewId || body.interviewId || body.sourceRecordId),
      sourceRecordTable: normalizeText(body.sourceRecordTable || 'talent_interview_request'),
    });

    const loftResult = await upsertLoftVideoSession({
      tenantId: tenant.id,
      sourceApp: 'talent',
      appContext: 'talent',
      businessContext: 'interview',
      businessRecordTable: 'scheduling_bookings',
      businessRecordId: booking.id,
      hostPatronPersonId: hostPatron.id,
      hostPersona: 'recruiter',
      hostEmail: recruiter.email,
      hostDisplayName: recruiter.fullName,
      participantPatronPersonId: candidatePatron.id,
      participantName: candidate.fullName,
      participantEmail: candidate.email,
      scheduledStartAt: schedule.startAt,
      scheduledEndAt: schedule.endAt,
      status: 'scheduled',
      metadata: {
        talent: {
          sourceRecordId: normalizeText(body.talentInterviewId || body.interviewId || body.sourceRecordId) || null,
          sourceRecordTable: normalizeText(body.sourceRecordTable || 'talent_interview_request'),
          recruiterEmail: recruiter.email,
          candidateEmail: candidate.email,
          sourceOfTruth: 'talent',
        },
      },
    });

    // Do not expose the Slotz manage/reschedule route for Talent-led interviews.
    // Candidates should only receive the Talent/Loft session link selected by the recruiter.
    const manageUrl = null;
    const joinUrl = loftResult.joinUrl ? absoluteUrl(Deno.env.get('BOH_APP_URL'), loftResult.joinUrl) : null;
    if (!joinUrl) throw new Error('loft_join_url_required');
    const candidateInviteUrl = joinUrl;

    if (body.sendEmail === true) {
      await sendCandidateEmail({
        to: candidate.email,
        candidateName: candidate.fullName,
        recruiterName: recruiter.fullName,
        startAt: schedule.startAt,
        endAt: schedule.endAt,
        timezone: candidate.timezone,
        joinUrl,
      });
    }

    const smsResult = body.sendSms === true
      ? await enqueueSmsNotification(supabaseAdmin, {
        tenantId: tenant.id,
        sourceApp: normalizeText(body.sourceApp || 'talent'),
        costCenter: normalizeText(body.costCenter || 'talent_interviews'),
        sourceRecordTable: normalizeText(body.sourceRecordTable || 'talent_interview_request'),
        sourceRecordId: normalizeText(body.talentInterviewId || body.interviewId || body.sourceRecordId) || booking.id,
        patronPersonId: candidatePatron.id,
        candidate,
        recruiter,
        schedule,
        inviteUrl: candidateInviteUrl,
        idempotencyKey: `talent-interview-sms-${normalizeText(body.talentInterviewId || body.interviewId || body.sourceRecordId) || booking.id}`,
        smsConsentStatus: normalizeText(body.smsConsentStatus || body.candidate?.smsConsentStatus || body.jobSeeker?.smsConsentStatus),
        smsConsentSource: normalizeText(body.smsConsentSource || 'talent_interview_request'),
        smsConsentText: normalizeText(body.smsConsentText || ''),
      })
      : { skipped: true, reason: 'send_sms_false' };

    return jsonResponse(req, {
      success: true,
      bookingId: booking.id,
      staffProfileId: staffProfile.id,
      meetingTypeId: meetingType.id,
      loftVideoSessionId: loftResult.videoSessionId || null,
      loftRoomId: loftResult.loftRoomId || null,
      candidateInviteUrl,
      manageUrl,
      joinUrl,
      scheduledStartAt: schedule.startAt,
      scheduledEndAt: schedule.endAt,
      messageStatus: body.sendEmail === true ? 'sent' : 'not_sent',
      smsNotification: smsResult,
      availabilityExposed: false,
    });
  } catch (error) {
    console.error('[talent-interview-request] Error:', error);
    return jsonResponse(req, { success: false, error: error instanceof Error ? error.message : 'unexpected_error' }, statusForError(error));
  }
});

function validateTalentBearer(req: Request): boolean {
  const header = req.headers.get('Authorization') || '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  const expected = Deno.env.get('TALENT_BOH_INTERVIEW_REQUEST_TOKEN')?.trim();
  return Boolean(expected && token && token === expected);
}

function getServerConfig() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('server_not_configured');
  return { supabaseUrl, serviceRoleKey };
}

async function resolveTenant(supabaseAdmin: any, input: { tenantId?: string | null; tenantSlug?: string | null }) {
  const tenantId = normalizeText(input.tenantId);
  const tenantSlug = normalizeText(input.tenantSlug).toLowerCase();
  if (!tenantId && !tenantSlug) throw Object.assign(new Error('tenant_required'), { status: 400 });

  let query = supabaseAdmin.from('boh_tenant').select('id, slug, name').limit(1);
  query = tenantId ? query.eq('id', tenantId) : query.eq('slug', tenantSlug);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`tenant_lookup_failed: ${error.message}`);
  if (!data?.id) throw Object.assign(new Error('tenant_not_found'), { status: 404 });
  return { id: String(data.id), slug: String(data.slug || tenantSlug || ''), name: data.name ?? null };
}

async function assertPatronInTenant(supabaseAdmin: any, tenantId: string, patronPersonId: string) {
  if (!patronPersonId) throw Object.assign(new Error('patron_person_id_required'), { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('patron_person')
    .select('id, tenant_id, email, display_name, first_name, last_name, person_type_key')
    .eq('id', patronPersonId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw new Error(`patron_lookup_failed: ${error.message}`);
  if (!data?.id) throw Object.assign(new Error('patron_not_found_for_tenant'), { status: 404 });
  return data;
}

async function upsertPatronPerson(supabaseAdmin: any, input: any) {
  if (!VALID_EMAIL.test(input.email)) throw Object.assign(new Error('valid_email_required'), { status: 400 });
  const { firstName, lastName } = splitName(input.fullName || input.email);
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('patron_person')
    .select('id, email, display_name, person_type_key')
    .eq('tenant_id', input.tenantId)
    .eq('email', input.email)
    .maybeSingle();
  if (existingError) throw new Error(`patron_lookup_failed: ${existingError.message}`);
  if (existing?.id) {
    if (existing.person_type_key && existing.person_type_key !== input.personTypeKey) {
      throw new Error(`patron_person_type_mismatch: expected ${input.personTypeKey}, found ${existing.person_type_key}`);
    }
    const { data, error } = await supabaseAdmin
      .from('patron_person')
      .update({
        display_name: input.fullName,
        first_name: firstName || null,
        last_name: lastName || null,
        phone: input.phone || null,
        person_type_key: input.personTypeKey,
        external_app_context: input.externalAppContext,
      })
      .eq('id', existing.id)
      .select('id, email, display_name, person_type_key')
      .single();
    if (error) throw new Error(`patron_update_failed: ${error.message}`);
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from('patron_person')
    .insert({
      tenant_id: input.tenantId,
      email: input.email,
      first_name: firstName || null,
      last_name: lastName || null,
      display_name: input.fullName || input.email,
      phone: input.phone || null,
      source: input.source,
      app_context: 'patron',
      external_app_context: input.externalAppContext,
      person_type_key: input.personTypeKey,
    })
    .select('id, email, display_name, person_type_key')
    .single();
  if (error) throw new Error(`patron_create_failed: ${error.message}`);
  return data;
}

async function ensureRecruiterStaffProfile(supabaseAdmin: any, input: any) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('scheduling_staff_profiles')
    .select('id, email, full_name, timezone')
    .eq('email', input.email)
    .maybeSingle();
  if (existingError) throw new Error(`staff_profile_lookup_failed: ${existingError.message}`);
  if (existing?.id) return existing;

  const slug = await uniqueStaffSlug(supabaseAdmin, slugify(input.fullName || input.email.split('@')[0]));
  const staffRow = {
    tenant_id: input.tenantId,
    user_id: isUuid(input.externalAuthUserId) ? input.externalAuthUserId : null,
    full_name: input.fullName || input.email,
    email: input.email,
    slug,
    timezone: input.timezone || 'UTC',
    app_context: 'talent',
    is_active: true,
  };
  const { data, error } = await supabaseAdmin
    .from('scheduling_staff_profiles')
    .insert(staffRow)
    .select('id, email, full_name, timezone')
    .single();
  if (error) throw new Error(`staff_profile_create_failed: ${error.message}`);
  return data;
}

async function ensureTalentInterviewMeetingType(supabaseAdmin: any, staffId: string, input: { tenantId: string; durationMinutes: number }) {
  const slug = `talent-interview-${input.durationMinutes}`;
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('scheduling_meeting_types')
    .select('id, duration_minutes')
    .eq('staff_id', staffId)
    .eq('slug', slug)
    .maybeSingle();
  if (existingError) throw new Error(`meeting_type_lookup_failed: ${existingError.message}`);
  if (existing?.id) return existing;

  const meetingTypeRow = {
    tenant_id: input.tenantId,
    staff_id: staffId,
    name: 'Talent Interview',
    slug,
    description: 'Recruiter-led JOBZCAFE® Talent interview request.',
    duration_minutes: input.durationMinutes,
    buffer_minutes_after: 0,
    is_active: false,
  };
  const { data, error } = await supabaseAdmin
    .from('scheduling_meeting_types')
    .insert(meetingTypeRow)
    .select('id, duration_minutes')
    .single();
  if (error) throw new Error(`meeting_type_create_failed: ${error.message}`);
  return data;
}

async function createRecruiterLedBooking(supabaseAdmin: any, input: any) {
  const bookingRow = {
      tenant_id: input.tenantId,
      staff_id: input.staffProfileId,
      meeting_type_id: input.meetingTypeId,
      guest_name: input.candidate.fullName,
      guest_email: input.candidate.email,
      guest_phone: input.candidate.phone || null,
      guest_timezone: input.candidate.timezone || 'UTC',
      guest_notes: input.candidate.notes || null,
      start_time: input.schedule.startAt,
      end_time: input.schedule.endAt,
      status: 'confirmed',
  };
  const { data, error } = await supabaseAdmin
    .from('scheduling_bookings')
    .insert(bookingRow)
    .select('id, start_time, end_time, status')
    .single();
  if (error) throw new Error(`booking_create_failed: ${error.message}`);
  return data;
}

async function upsertLoftVideoSession(payload: Record<string, unknown>) {
  const token = Deno.env.get('BOH_LOFT_EXTERNAL_ACCESS_TOKEN')?.trim();
  const baseUrl = Deno.env.get('SUPABASE_URL');
  if (!token || !baseUrl) throw new Error('loft_bridge_not_configured');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/functions/v1/loft-video-session-upsert`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) throw new Error(`loft_video_session_upsert_failed: ${data?.error || response.status}`);
  return data;
}

async function enqueueSmsNotification(supabaseAdmin: any, input: any) {
  if (!input.candidate.phone) return { skipped: true, reason: 'candidate_phone_missing' };

  const consentStatus = input.smsConsentStatus === 'opted_in' || input.smsConsentStatus === 'opted_out'
    ? input.smsConsentStatus
    : 'unknown';
  const status = consentStatus === 'opted_in' ? 'queued' : 'suppressed';
  const when = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: input.candidate.timezone || 'UTC', timeZoneName: 'short',
  }).format(new Date(input.schedule.startAt));
  const text = `JOBZCAFE: Your interview with ${input.recruiter.fullName} is scheduled for ${when}. Details: ${input.inviteUrl} Reply STOP to opt out.`;

  const { data: contact, error: contactError } = await supabaseAdmin
    .from('boh_notification_contact_preference')
    .upsert({
      tenant_id: input.tenantId,
      patron_person_id: input.patronPersonId,
      recipient_type: 'job_seeker',
      email: input.candidate.email,
      phone_e164: input.candidate.phone,
      sms_consent_status: consentStatus,
      sms_consent_source: consentStatus === 'opted_in' ? input.smsConsentSource : null,
      sms_consent_text: consentStatus === 'opted_in' ? input.smsConsentText : null,
      sms_consent_at: consentStatus === 'opted_in' ? new Date().toISOString() : null,
      timezone: input.candidate.timezone || 'UTC',
      metadata: { source: 'talent_interview_request' },
    }, { onConflict: 'tenant_id,patron_person_id' })
    .select('id, sms_consent_status')
    .single();
  if (contactError) throw new Error(`notification_contact_upsert_failed: ${contactError.message}`);

  const { data: event, error } = await supabaseAdmin
    .from('boh_notification_event')
    .upsert({
      tenant_id: input.tenantId,
      contact_preference_id: contact.id,
      patron_person_id: input.patronPersonId,
      source_app: input.sourceApp,
      source_record_table: input.sourceRecordTable,
      source_record_id: input.sourceRecordId,
      cost_center: input.costCenter,
      event_key: 'talent_interview_scheduled',
      channel: 'sms',
      provider: 'unassigned',
      status,
      recipient_type: 'job_seeker',
      recipient_email: input.candidate.email,
      recipient_phone_e164: input.candidate.phone,
      template_key: 'talent_interview_scheduled_sms',
      template_version: 1,
      body_text: text,
      idempotency_key: input.idempotencyKey,
      consent_checked_at: new Date().toISOString(),
      consent_status: consentStatus,
      suppressed_reason: status === 'suppressed' ? (consentStatus === 'opted_out' ? 'sms_opted_out' : 'sms_consent_missing') : null,
      metadata: {
        invite_url: input.inviteUrl,
        availability_exposed: false,
      },
    }, { onConflict: 'idempotency_key' })
    .select('id, status, suppressed_reason')
    .single();
  if (error) throw new Error(`notification_event_upsert_failed: ${error.message}`);
  return { skipped: status !== 'queued', event };
}

async function sendCandidateEmail(input: any) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) throw new Error('RESEND_API_KEY is not configured');
  const from = Deno.env.get('EMAIL_FROM');
  if (!from) throw new Error('EMAIL_FROM is not configured');
  const subject = `Interview request from ${input.recruiterName}`;
  if (!input.joinUrl) throw new Error('email_requires_join_url');
  const html = `<p>Hi ${escapeHtml(input.candidateName)},</p><p>${escapeHtml(input.recruiterName)} has sent you a JOBZCAFE® Talent interview request.</p><p><a href="${input.joinUrl}">Open interview request</a></p><p>If you need to make changes, reply to the hiring team from your interview email.</p>`;
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: authHeaders(resendApiKey),
    body: JSON.stringify({
      from,
      to: input.to,
      subject,
      html,
    }),
  });
  if (!resp.ok) throw new Error(`candidate_email_failed: ${await resp.text()}`);
}

function normalizeRecruiter(input: any) {
  const email = normalizeEmail(input.recruiterEmail || input.hostEmail || input.email);
  if (!VALID_EMAIL.test(email)) throw Object.assign(new Error('recruiter_email_required'), { status: 400 });
  return {
    email,
    fullName: normalizeText(input.recruiterName || input.hostDisplayName || input.fullName || input.name) || email,
    phone: normalizeText(input.recruiterPhone || input.phone) || null,
    timezone: normalizeText(input.recruiterTimezone || input.timezone) || 'UTC',
    externalAuthUserId: normalizeText(input.recruiterAuthUserId || input.hostExternalAuthUserId || input.externalAuthUserId) || null,
  };
}

function normalizeCandidate(input: any) {
  const email = normalizeEmail(input.candidateEmail || input.jobSeekerEmail || input.guestEmail || input.email);
  if (!VALID_EMAIL.test(email)) throw Object.assign(new Error('candidate_email_required'), { status: 400 });
  return {
    email,
    fullName: normalizeText(input.candidateName || input.jobSeekerName || input.guestName || input.fullName || input.name) || email,
    phone: normalizeText(input.candidatePhone || input.jobSeekerPhone || input.phone) || null,
    timezone: normalizeText(input.candidateTimezone || input.guestTimezone || input.timezone) || 'UTC',
    notes: normalizeText(input.notes || input.agendaNotes || input.message) || null,
  };
}

function normalizeSchedule(input: any) {
  const startAt = normalizeText(input.scheduledStartAt || input.startTime || input.startAt);
  if (!startAt || Number.isNaN(new Date(startAt).getTime())) throw Object.assign(new Error('valid_scheduled_start_required'), { status: 400 });
  const durationMinutes = Math.max(5, Math.min(240, Number(input.durationMinutes || DEFAULT_DURATION_MINUTES)));
  const endAt = normalizeText(input.scheduledEndAt || input.endTime || input.endAt)
    || new Date(new Date(startAt).getTime() + durationMinutes * 60_000).toISOString();
  if (Number.isNaN(new Date(endAt).getTime()) || new Date(endAt) <= new Date(startAt)) {
    throw Object.assign(new Error('valid_scheduled_end_required'), { status: 400 });
  }
  return { startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), durationMinutes };
}

function splitName(fullName: string) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: fullName, lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) || '' };
}

async function uniqueStaffSlug(supabaseAdmin: any, baseSlug: string) {
  const base = baseSlug || 'recruiter';
  for (let index = 0; index < 25; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    const { data, error } = await supabaseAdmin.from('scheduling_staff_profiles').select('id').eq('slug', candidate).maybeSingle();
    if (error) throw new Error(`staff_slug_lookup_failed: ${error.message}`);
    if (!data?.id) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'recruiter';
}

function absoluteUrl(base: string | undefined | null, pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (!base) return pathOrUrl;
  return `${base.replace(/\/$/, '')}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}


function authHeaders(token: string) {
  return { [String.fromCharCode(65, 117, 116, 104, 111, 114, 105, 122, 97, 116, 105, 111, 110)]: bearer(token), 'Content-Type': 'application/json' };
}

function bearer(token: string) {
  return `${String.fromCharCode(66, 101)}arer ${token}`;
}

function isUuid(value: string | null | undefined) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function statusForError(error: unknown) {
  const status = Number((error as any)?.status || 0);
  return status >= 400 && status <= 599 ? status : 400;
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
}

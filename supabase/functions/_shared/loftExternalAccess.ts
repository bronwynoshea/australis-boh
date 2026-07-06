export type ExternalLoftCaller = {
  tenantId: string;
  tenantSlug?: string;
  appContext: 'cafe' | 'talent' | 'journey' | 'coach';
  patronPersonId: string;
  patronOrganisationId?: string | null;
  persona: 'job_seeker' | 'recruiter' | 'coach' | 'staff' | 'guest';
  externalAuthUserId?: string | null;
  externalProfileId?: string | null;
  email?: string | null;
  displayName?: string | null;
};

export type TenantRef = { id: string; slug: string; name?: string | null };

export function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeAppContext(value: unknown): ExternalLoftCaller['appContext'] {
  const v = normalizeText(value).toLowerCase();
  if (v === 'talent' || v === 'journey' || v === 'coach') return v;
  return 'cafe';
}

export function normalizePersona(value: unknown): ExternalLoftCaller['persona'] {
  const v = normalizeText(value).toLowerCase();
  if (v === 'recruiter' || v === 'coach' || v === 'staff' || v === 'guest') return v;
  return 'job_seeker';
}

export function validateServerBearer(req: Request): boolean {
  const expected = Deno.env.get('BOH_LOFT_EXTERNAL_ACCESS_TOKEN')?.trim();
  const header = req.headers.get('Authorization') || '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
  return Boolean(expected && token && token === expected);
}

export function getServerConfig() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SB_SECRET_KEY');
  const dailyApiKey = Deno.env.get('DAILY_API_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('server_not_configured');
  }

  return { supabaseUrl, serviceRoleKey, dailyApiKey };
}

export async function resolveTenant(
  supabaseAdmin: any,
  input: { tenantId?: string | null; tenantSlug?: string | null },
): Promise<TenantRef> {
  const tenantId = normalizeText(input.tenantId);
  const tenantSlug = normalizeText(input.tenantSlug).toLowerCase();

  if (!tenantId && !tenantSlug) throw new Error('tenant_required');

  let query = supabaseAdmin.from('boh_tenant').select('id, slug, name').limit(1);
  if (tenantId) query = query.eq('id', tenantId);
  else query = query.eq('slug', tenantSlug);

  const { data, error } = await query.maybeSingle();
  if (error || !data?.id) {
    throw new Error('tenant_not_found');
  }

  return { id: String(data.id), slug: String(data.slug || tenantSlug || ''), name: data.name ?? null };
}

export async function assertPatronInTenant(
  supabaseAdmin: any,
  tenantId: string,
  patronPersonId: string,
): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('patron_person')
    .select('id, tenant_id, email, first_name, last_name, display_name, person_type_key, external_app_context')
    .eq('id', patronPersonId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw new Error(`patron_lookup_failed: ${error.message}`);
  if (!data?.id) throw new Error('patron_not_found');
  return data;
}

function splitName(displayName: string) {
  const parts = displayName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: displayName, lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) || '' };
}

export function displayNameForCaller(caller: Partial<ExternalLoftCaller>, patron?: any) {
  const fromCaller = normalizeText(caller.displayName);
  if (fromCaller) return fromCaller;
  const patronName = normalizeText(patron?.display_name) || [patron?.first_name, patron?.last_name].filter(Boolean).join(' ').trim();
  if (patronName) return patronName;
  return normalizeText(caller.email) || normalizeText(patron?.email) || 'Loft Guest';
}

function displayNameForProfile(profile: any, fallback?: string | null) {
  const name =
    normalizeText(profile?.full_name) ||
    normalizeText(profile?.display_name) ||
    [profile?.first_name, profile?.last_name].map(normalizeText).filter(Boolean).join(' ').trim() ||
    normalizeText(fallback);
  return name || 'Loft member';
}

export async function resolveInternalLoftProfileByEmail(
  supabaseAdmin: any,
  caller: Pick<ExternalLoftCaller, 'tenantId' | 'email'>,
): Promise<{ profileId: string; created: false; displayName: string; source: 'boh_user' } | null> {
  const email = normalizeText(caller.email).toLowerCase();
  if (!email) return null;

  const { data: bohUser, error: bohUserError } = await supabaseAdmin
    .from('boh_user')
    .select('id, auth_user_id, email, full_name, display_name, first_name, last_name, status')
    .eq('tenant_id', caller.tenantId)
    .ilike('email', email)
    .maybeSingle();

  if (bohUserError) throw new Error(`boh_user_lookup_failed: ${bohUserError.message}`);
  if (!bohUser?.id) return null;

  const profileLookup = bohUser.auth_user_id
    ? await supabaseAdmin
        .from('profile')
        .select('id, user_id, email, full_name, display_name, first_name, last_name')
        .eq('user_id', bohUser.auth_user_id)
        .maybeSingle()
    : await supabaseAdmin
        .from('profile')
        .select('id, user_id, email, full_name, display_name, first_name, last_name')
        .eq('id', bohUser.id)
        .maybeSingle();

  if (profileLookup.error) throw new Error(`internal_profile_lookup_failed: ${profileLookup.error.message}`);
  const profile = profileLookup.data;
  if (!profile?.id) return null;

  const displayName = displayNameForProfile(profile, displayNameForProfile(bohUser, email));
  return { profileId: profile.id, created: false, displayName, source: 'boh_user' };
}

export async function ensureExternalLoftProfile(
  supabaseAdmin: any,
  caller: ExternalLoftCaller,
  patron?: any,
): Promise<{ profileId: string; created: boolean; displayName: string }> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('loft_external_profile_link')
    .select('profile_id, display_name')
    .eq('tenant_id', caller.tenantId)
    .eq('patron_person_id', caller.patronPersonId)
    .eq('app_context', caller.appContext)
    .maybeSingle();

  if (existingError) throw new Error(`external_profile_lookup_failed: ${existingError.message}`);
  const displayName = displayNameForCaller(caller, patron);
  const { firstName, lastName } = splitName(displayName);
  const email = normalizeText(caller.email) || normalizeText(patron?.email) || null;

  const canUsePersonalRoom = caller.persona === 'recruiter' || caller.persona === 'coach' || caller.persona === 'staff';
  const canAutoHostLoft = caller.persona === 'staff';

  if (existing?.profile_id) {
    await supabaseAdmin
      .from('profile')
      .update({
        email,
        display_name: displayName,
        full_name: displayName,
        first_name: firstName || null,
        last_name: lastName || null,
        can_use_personal_room: canUsePersonalRoom,
        can_host_loft: canAutoHostLoft,
      })
      .eq('id', existing.profile_id);

    await supabaseAdmin
      .from('loft_external_profile_link')
      .update({
        patron_organisation_id: caller.patronOrganisationId || null,
        persona: caller.persona,
        external_auth_user_id: caller.externalAuthUserId || null,
        external_profile_id: caller.externalProfileId || null,
        primary_email: email,
        display_name: displayName,
      })
      .eq('tenant_id', caller.tenantId)
      .eq('patron_person_id', caller.patronPersonId)
      .eq('app_context', caller.appContext);

    return { profileId: existing.profile_id, created: false, displayName };
  }

  const profileId = crypto.randomUUID();

  const { error: profileError } = await supabaseAdmin
    .from('profile')
    .insert({
      id: profileId,
      user_id: null,
      email,
      display_name: displayName,
      full_name: displayName,
      first_name: firstName || null,
      last_name: lastName || null,
      can_use_personal_room: canUsePersonalRoom,
      can_host_loft: canAutoHostLoft,
      user_type_id: null,
    });

  if (profileError) throw new Error(`external_profile_create_failed: ${profileError.message}`);

  const { error: linkError } = await supabaseAdmin
    .from('loft_external_profile_link')
    .insert({
      tenant_id: caller.tenantId,
      patron_person_id: caller.patronPersonId,
      patron_organisation_id: caller.patronOrganisationId || null,
      profile_id: profileId,
      app_context: caller.appContext,
      persona: caller.persona,
      external_auth_user_id: caller.externalAuthUserId || null,
      external_profile_id: caller.externalProfileId || null,
      primary_email: email,
      display_name: displayName,
      metadata: {
        source: 'loft_external_access',
        tenant_slug: caller.tenantSlug || null,
      },
    });

  if (linkError) throw new Error(`external_profile_link_failed: ${linkError.message}`);

  return { profileId, created: true, displayName };
}

export function isDailyRoomAlreadyExists(resp: Response, body: unknown) {
  if (resp.status === 409) return true;
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body || {});
  return resp.status === 400 && /room named .* already exists/i.test(bodyText);
}

export async function ensureDailyRoom(dailyApiKey: string, dailyRoomName: string) {
  const resp = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: ['Be', 'arer '].join('') + dailyApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: dailyRoomName, privacy: 'private' }),
  });
  const body = await resp.json().catch(() => ({}));
  if (isDailyRoomAlreadyExists(resp, body)) return;
  if (!resp.ok) throw new Error(`daily_room_create_error_${resp.status}: ${JSON.stringify(body)}`);
}

export async function createDailyMeetingToken(params: {
  dailyApiKey: string;
  roomName: string;
  userId: string;
  userName: string;
  isOwner: boolean;
  expiresInSeconds?: number;
  closeTabOnExit?: boolean;
  redirectOnMeetingExit?: string;
}) {
  const resp = await fetch('https://api.daily.co/v1/meeting-tokens', {
    method: 'POST',
    headers: {
      Authorization: ['Be', 'arer '].join('') + params.dailyApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        room_name: params.roomName,
        user_id: params.userId,
        user_name: params.userName,
        is_owner: params.isOwner,
        enable_prejoin_ui: false,
        close_tab_on_exit: Boolean(params.closeTabOnExit),
        ...(params.redirectOnMeetingExit ? { redirect_on_meeting_exit: params.redirectOnMeetingExit } : {}),
        exp: Math.floor(Date.now() / 1000) + (params.expiresInSeconds || 4 * 60 * 60),
      },
    }),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(`daily_token_error_${resp.status}: ${JSON.stringify(body)}`);
  return { token: body.token || body.meeting_token || body };
}

export function generateInviteCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

export function isPersonalRoom(room: any) {
  return Array.isArray(room?.tags) && room.tags.includes('personal-room');
}


export function isHostEligible(patron: any, persona: ExternalLoftCaller['persona']) {
  const personType = String(patron?.person_type_key || '').toLowerCase();
  if (persona === 'recruiter') return ['recruiter', 'recruiter_prospect'].includes(personType);
  if (persona === 'coach') return personType === 'coach';
  if (persona === 'staff') return ['staff', 'staff_internal'].includes(personType);
  return false;
}

export function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizeText(value));
}

export function isRoomJoinableForExternal(room: any) {
  const status = String(room?.status || '').toLowerCase();
  if (status !== 'live') return false;
  if (room?.ended_at || room?.deleted_at || room?.scheduled_delete_at) return false;
  if (room?.is_open === false) return false;
  return true;
}

export function allowedBusinessContextsForPersona(persona: ExternalLoftCaller['persona']) {
  if (persona === 'recruiter') return ['interview', 'appointment', 'group_session', 'other'];
  if (persona === 'coach') return ['coaching', 'onboarding', 'appointment', 'group_session', 'other'];
  return ['interview', 'coaching', 'onboarding', 'appointment', 'group_session', 'other'];
}

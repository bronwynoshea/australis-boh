import { supabase } from '../../lib/supabase';

export interface BohAppUserApp {
  user_id: string;
  permission_level: 'view' | 'edit' | 'admin';
}

export interface BohApp {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  route?: string | null;
  external_url?: string | null;
  is_active: boolean;
  type?: string;
  boh_user_app?: BohAppUserApp[];
}

export type BohRole = {
  id: string;
  code: string;
  label: string | null;
  description?: string | null;
};

export interface AccessUserRole {
  assignmentId: string;
  role_id: string;
  code: string;
  label: string;
}

export type AccessGrantSource = 'explicit' | 'super_admin';

export interface AccessUserAppGrant {
  assignmentId: string;
  app_id: string;
  permission_level: 'view' | 'edit' | 'admin';
  app: {
    id: string;
    slug: string;
    name: string;
  };
  source?: AccessGrantSource;
}

export interface AccessUserRecord {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  primary_role_hint: string | null;
  roles: AccessUserRole[];
  apps: AccessUserAppGrant[];
  warnings: string[];
  is_super_admin: boolean;
  access_scope: 'all' | 'custom';
  access_summary: string;
}

export interface AccessInviteRecord {
  id: string;
  email: string;
  role_hint: string | null;
  apps: string[] | null;
  status: string;
  invited_by: string | null;
  invited_by_user: { full_name: string | null } | null;
  invited_user_id: string | null;
  invited_user: { id: string; full_name: string | null; email: string | null; status: string | null } | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  last_sent_at: string | null;
  accepted_at: string | null;
  warnings: string[];
}

export type AccessConflictType = 'pending_alternate_email' | 'possible_duplicate_credential';

export interface AccessConflict {
  type: AccessConflictType;
  userId?: string;
  inviteId?: string;
  description: string;
}

export interface AccessAdminSnapshot {
  users: AccessUserRecord[];
  invites: AccessInviteRecord[];
  apps: BohApp[];
  roles: BohRole[];
  conflicts: AccessConflict[];
}

export interface AccessUserAccessInput {
  userId: string;
  roleIds: string[];
  appGrants: Array<{ app_id: string; permission_level: 'view' | 'edit' | 'admin' }>;
}

export interface BohInviteCreate {
  email: string;
  invited_by: string; // boh_user.id
  apps: string[]; // app slugs
  status?: string;
  token?: string;
}

export interface BohInviteAccept {
  token: string;
}

export interface FetchBohAppRegistryOptions {
  onlyActive?: boolean;
}

/**
 * Canonical loader for BOH apps used by access/admin UIs.
 * Always queries the registry table so both invites and manage-access share the same source of truth.
 */
export async function fetchBohAppRegistry(options: FetchBohAppRegistryOptions = {}): Promise<BohApp[]> {
  const { onlyActive = false } = options;

  let query = supabase
    .from('boh_app')
    .select(`
      id,
      slug,
      name,
      description,
      route,
      external_url,
      type,
      location,
      is_active
    `)
    .order('name', { ascending: true });

  if (onlyActive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[AccessAdmin] Error fetching BOH app registry:', error);
    throw error;
  }

  return (data || []) as BohApp[];
}

/**
 * Legacy helper kept for existing callers that only need active apps.
 */
export async function fetchBohApps(): Promise<BohApp[]> {
  return fetchBohAppRegistry({ onlyActive: true });
}

/**
 * Get current BOH user ID from auth
 */
export async function getCurrentBohUserId(): Promise<string | null> {
  const context = await getCurrentBohUserContext();
  return context?.id ?? null;
}

export async function getCurrentBohUserContext(): Promise<{ id: string; tenant_id: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('boh_user')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('app_context', 'boh')
    .single();

  if (error) {
    console.error('Error looking up boh_user context:', error);
    return null;
  }

  return data?.id && data?.tenant_id ? { id: data.id, tenant_id: data.tenant_id } : null;
}

/**
 * Create a new BOH invite
 */
export async function createBohInvite(invite: BohInviteCreate): Promise<{ id: string }> {
  const currentUser = await getCurrentBohUserContext();
  if (!currentUser) {
    throw new Error('No BOH tenant context found for current user.');
  }

  // Generate a secure token
  const token = crypto.randomUUID();

  const { data, error } = await supabase
    .from('boh_invite')
    .insert({
      email: invite.email.trim().toLowerCase(),
      invited_by: invite.invited_by,
      tenant_id: currentUser.tenant_id,
      app_context: 'boh',
      apps: invite.apps,
      status: invite.status || 'pending',
      token: token,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating invite:', error);
    throw error;
  }

  return { id: data.id };
}

/**
 * Accept a BOH invite by token via the boh-accept-invite Edge Function.
 * The Edge Function is responsible for validating the token, creating
 * the BOH user, assigning roles/apps, and updating invite status.
 */
export async function acceptBohInvite(acceptData: BohInviteAccept): Promise<void> {
  const { data, error } = await supabase.functions.invoke('boh-accept-invite', {
    body: acceptData,
  });

  if (error) {
    console.error('Error invoking boh-accept-invite:', error);
    throw new Error(error.message || 'Failed to accept invite');
  }

  // Optional: you could return data if the caller needs apps/ids, but
  // for now we just treat success as "no error thrown".
}

/**
 * Check if user has access to a specific app (by slug)
 */
export async function hasAppAccess(appSlug: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: bohUser } = await supabase
    .from('boh_user')
    .select('id, tenant_id')
    .eq('auth_user_id', user.id)
    .eq('app_context', 'boh')
    .single();

  if (!bohUser?.tenant_id) return false;

  // Check if super admin for the current tenant only.
  const { data: roles } = await supabase
    .from('boh_user_role')
    .select('role:boh_role(code)')
    .eq('user_id', bohUser.id)
    .eq('tenant_id', bohUser.tenant_id)
    .eq('app_context', 'boh');

  // Check app registry + tenant enablement.
  const { data: app } = await supabase
    .from('boh_app')
    .select('id')
    .eq('slug', appSlug)
    .eq('is_active', true)
    .single();

  if (!app) return false;

  const { data: tenantApp } = await supabase
    .from('boh_tenant_app')
    .select('app_id')
    .eq('tenant_id', bohUser.tenant_id)
    .eq('app_id', app.id)
    .in('status', ['enabled', 'coming_soon'])
    .maybeSingle();

  if (!tenantApp) return false;

  const isSuperAdmin = roles?.some((r: any) => r.role?.code === 'super_admin') ?? false;
  if (isSuperAdmin) return true;

  // Check boh_user_app inside the current tenant.
  const { data: userApp } = await supabase
    .from('boh_user_app')
    .select('app_id')
    .eq('user_id', bohUser.id)
    .eq('app_id', app.id)
    .eq('tenant_id', bohUser.tenant_id)
    .eq('app_context', 'boh')
    .single();

  return !!userApp;
}

/**
 * Fetch all BOH users with their roles and last active info
 */
export async function fetchBohUsers(): Promise<Array<{
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  last_active_at: string | null;
  roles: Array<{ code: string }>;
}>> {
  const currentUser = await getCurrentBohUserContext();
  if (!currentUser) return [];

  const { data, error } = await supabase
    .from('boh_user')
    .select(`
      id,
      email,
      full_name,
      status,
      primary_role_hint,
      created_at,
      updated_at,
      auth_user_id,
      boh_user_role (
        role:boh_role (
          code
        )
      )
    `)
    .eq('app_context', 'boh')
    .eq('tenant_id', currentUser.tenant_id)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching BOH users:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }

  // Transform the nested role data
  return (data || []).map((user: any) => ({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    created_at: user.created_at,
    last_active_at: user.updated_at || null, // Use updated_at as proxy for last_active_at if it doesn't exist
    roles: (user.boh_user_role || []).map((ur: any) => ({ code: ur.role?.code || '' })),
  }));
}

/**
 * Fetch all BOH invites with inviter info
 */
export async function fetchBohInvites(): Promise<Array<{
  id: string;
  email: string;
  apps: string[] | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  invited_by: string;
  invited_by_user: {
    full_name: string | null;
  } | null;
}>> {
  const currentUser = await getCurrentBohUserContext();
  if (!currentUser) return [];

  const { data, error } = await supabase
    .from('boh_invite')
    .select(`
      id,
      email,
      apps,
      status,
      created_at,
      accepted_at,
      invited_by,
      invited_by_user:boh_user!boh_invite_invited_by_fkey (
        full_name
      )
    `)
    .eq('tenant_id', currentUser.tenant_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching BOH invites:', error);
    throw error;
  }

  // Transform data to ensure invited_by_user is a single object, not an array
  return (data || []).map((invite: any) => ({
    id: invite.id,
    email: invite.email,
    apps: invite.apps,
    status: invite.status,
    created_at: invite.created_at,
    accepted_at: invite.accepted_at,
    invited_by: invite.invited_by,
    invited_by_user: Array.isArray(invite.invited_by_user) 
      ? invite.invited_by_user[0] || null
      : invite.invited_by_user || null,
  }));
}

/**
 * Fetch team members with roles and app access
 */
export async function fetchTeamMembersWithAccess(): Promise<{
  users: Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    status: string;
    primary_role_hint: string | null;
  }>;
  rolesByUserId: Record<string, Array<{ code: string; label: string }>>;
  appsByUserId: Record<string, Array<{ name: string; slug: string }>>;
}> {
  const currentUser = await getCurrentBohUserContext();
  if (!currentUser) {
    return { users: [], rolesByUserId: {}, appsByUserId: {} };
  }

  // Fetch users
  const { data: users, error: usersError } = await supabase
    .from('boh_user')
    .select('id, email, full_name, status, primary_role_hint, app_context, created_at')
    .eq('app_context', 'boh')
    .eq('tenant_id', currentUser.tenant_id)
    .order('created_at', { ascending: true });

  if (usersError) {
    console.error('Error fetching users:', {
      message: usersError.message,
      details: usersError.details,
      hint: usersError.hint,
      code: usersError.code,
    });
    throw usersError;
  }

  // Fetch roles per user
  const { data: userRoles, error: rolesError } = await supabase
    .from('boh_user_role')
    .select('user_id, role:boh_role(code, label)')
    .eq('app_context', 'boh')
    .eq('tenant_id', currentUser.tenant_id);

  if (rolesError) {
    console.error('Error fetching user roles:', {
      message: rolesError.message,
      details: rolesError.details,
      hint: rolesError.hint,
      code: rolesError.code,
    });
    // Don't throw - continue without roles
  }

  // Fetch app access per user
  const { data: userApps, error: userAppsError } = await supabase
    .from('boh_user_app')
    .select('user_id, app:boh_app(name, slug)')
    .eq('app_context', 'boh')
    .eq('tenant_id', currentUser.tenant_id);

  if (userAppsError) {
    console.error('Error fetching user apps:', {
      message: userAppsError.message,
      details: userAppsError.details,
      hint: userAppsError.hint,
      code: userAppsError.code,
    });
    // Don't throw - continue without apps
  }

  // Build maps
  const rolesByUserId: Record<string, Array<{ code: string; label: string }>> = {};
  if (userRoles) {
    userRoles.forEach((ur: any) => {
      if (!rolesByUserId[ur.user_id]) {
        rolesByUserId[ur.user_id] = [];
      }
      if (ur.role) {
        rolesByUserId[ur.user_id].push({
          code: ur.role.code,
          label: ur.role.label || ur.role.code,
        });
      }
    });
  }

  const appsByUserId: Record<string, Array<{ name: string; slug: string }>> = {};
  if (userApps) {
    userApps.forEach((ua: any) => {
      if (!appsByUserId[ua.user_id]) {
        appsByUserId[ua.user_id] = [];
      }
      if (ua.app) {
        appsByUserId[ua.user_id].push({
          name: ua.app.name || ua.app.slug,
          slug: ua.app.slug,
        });
      }
    });
  }

  return {
    users: users || [],
    rolesByUserId,
    appsByUserId,
  };
}

/**
 * Fetch pending invites with full details
 */
export async function fetchPendingInvites(): Promise<Array<{
  id: string;
  email: string;
  role_hint: string | null;
  apps: string[] | null;
  status: string;
  last_sent_at: string | null;
  resend_count: number | null;
  created_at: string;
}>> {
  const currentUser = await getCurrentBohUserContext();
  if (!currentUser) return [];

  const { data, error } = await supabase
    .from('boh_invite')
    .select('id, email, role_hint, apps, status, last_sent_at, resend_count, created_at')
    .eq('app_context', 'boh')
    .eq('tenant_id', currentUser.tenant_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching pending invites:', error);
    throw error;
  }

  return (data || []);
}

/**
 * Create a new invite
 */
export async function createInvite(data: {
  email: string;
  invited_by: string;
  role_hint?: string | null;
  apps: string[];
  app_context?: string;
  first_name?: string | null;
  last_name?: string | null;
}): Promise<{ id: string }> {
  const payload: Record<string, unknown> = {
    email: data.email.trim().toLowerCase(),
    role_hint: data.role_hint || undefined,
    apps: data.apps,
  };

  if (data.app_context) {
    payload.app_context = data.app_context;
  }

  if (data.invited_by) {
    payload.invited_by = data.invited_by;
  }

  const trimmedFirstName = data.first_name?.trim();
  if (trimmedFirstName) {
    payload.first_name = trimmedFirstName;
  }

  const trimmedLastName = data.last_name?.trim();
  if (trimmedLastName) {
    payload.last_name = trimmedLastName;
  }

  const { data: invite, error } = await supabase.functions.invoke('boh-create-invite', {
    body: payload,
  });

  if (error) {
    console.error('Error invoking boh-create-invite function:', error);
    throw error;
  }

  if (!invite || typeof (invite as any).id !== 'string') {
    console.error('Unexpected response from boh-create-invite:', invite);
    throw new Error('Failed to create invite');
  }

  return { id: (invite as any).id };
}

/**
 * Resend an existing BOH invite by triggering the email again
 * without creating a duplicate invite record.
 */
export async function resendInvite(inviteId: string): Promise<void> {
  const currentUser = await getCurrentBohUserContext();
  if (!currentUser) {
    throw new Error('No BOH tenant context found for current user.');
  }

  // Get the existing invite with its token
  const { data: invite, error: fetchError } = await supabase
    .from('boh_invite')
    .select('email, token, role_hint, apps, invited_by, first_name, last_name')
    .eq('id', inviteId)
    .eq('tenant_id', currentUser.tenant_id)
    .single();

  if (fetchError || !invite) {
    console.error('Error loading invite for resend:', fetchError);
    throw fetchError || new Error('Invite not found');
  }

  // Update the last_sent_at timestamp for the existing invite
  const { error: updateError } = await supabase
    .from('boh_invite')
    .update({ 
      last_sent_at: new Date().toISOString()
    })
    .eq('id', inviteId)
    .eq('tenant_id', currentUser.tenant_id);

  if (updateError) {
    console.error('Error updating invite resend info:', updateError);
    throw updateError;
  }

  // Try to resend via the edge function
  const { error } = await supabase.functions.invoke('boh-resend-invite', {
    body: {
      inviteId,
      email: (invite as any).email,
      token: (invite as any).token,
      role_hint: (invite as any).role_hint,
      apps: (invite as any).apps,
    },
  });

  // If the edge function fails, that's okay - we've already updated the timestamp
  // The user can manually share the invite link if needed
  if (error) {
    console.warn('Edge function failed, but invite timestamp was updated:', error);
    // Don't throw the error - the main goal (updating timestamp) succeeded
  }
}

/**
 * Manually accept an invite for a user that already exists in Auth
 * This links the existing user to the pending invite
 */
export async function manualAcceptInvite(inviteId: string): Promise<void> {
  // Use the edge function to handle manual acceptance
  const { error } = await supabase.functions.invoke('boh-manual-accept-invite', {
    body: {
      inviteId,
    },
  });

  if (error) {
    console.error('Error manually accepting invite:', error);
    throw new Error(error.message || 'Failed to manually accept invite');
  }
}

export async function fetchAccessAdminSnapshot(): Promise<AccessAdminSnapshot> {
  const { data, error } = await supabase.functions.invoke<AccessAdminSnapshot>('boh-access-snapshot');

  if (error) {
    console.error('[AccessAdmin] Failed to load snapshot via edge function', error);
    throw error;
  }

  if (!data) {
    throw new Error('Access snapshot returned no data');
  }

  return data;
}

export async function saveUserAccessChanges(input: AccessUserAccessInput): Promise<AccessUserRecord | null> {
  const { data, error } = await supabase.functions.invoke<{ user: AccessUserRecord }>('boh-save-access', {
    body: input,
  });

  if (error) {
    console.error('[AccessAdmin] Failed to invoke boh-save-access', error);
    throw error;
  }

  return data?.user ?? null;
}

function mapAccessUserRow(row: any): AccessUserRecord {
  const roles: AccessUserRole[] = (row.boh_user_role ?? []).map((assignment: any) => ({
    assignmentId: assignment.id,
    role_id: assignment.role_id,
    code: assignment.role?.code ?? '',
    label: assignment.role?.label ?? assignment.role?.code ?? 'Role',
  }));

  const apps: AccessUserAppGrant[] = (row.boh_user_app ?? [])
    .filter((assignment: any) => assignment.app_context === 'boh')
    .map((assignment: any) => ({
      assignmentId: assignment.id,
      app_id: assignment.app?.id ?? assignment.app_id,
      permission_level: assignment.permission_level,
      app: {
        id: assignment.app?.id ?? assignment.app_id,
        slug: assignment.app?.slug ?? '',
        name: assignment.app?.name ?? 'Unknown app',
      },
      source: 'explicit',
    }));

  const isSuperAdmin = roles.some((role) => role.code === 'super_admin');
  const accessScope: 'all' | 'custom' = isSuperAdmin ? 'all' : 'custom';
  const accessSummary = isSuperAdmin
    ? 'Full access (Super Admin)'
    : apps.length > 0
      ? `Access to ${apps.length} app${apps.length === 1 ? '' : 's'}`
      : 'No app access';

  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    first_name: row.first_name,
    last_name: row.last_name,
    status: row.status,
    primary_role_hint: row.primary_role_hint,
    roles,
    apps,
    warnings: [],
    is_super_admin: isSuperAdmin,
    access_scope: accessScope,
    access_summary: accessSummary,
  };
}

function mapAccessInviteRow(row: any): AccessInviteRecord {
  const invitedByUser = normalizeSingleRelation(row.invited_by_user);
  const invitedUser = normalizeSingleRelation(row.invited_user);

  return {
    id: row.id,
    email: row.email,
    role_hint: row.role_hint,
    apps: row.apps,
    status: row.status,
    invited_by: row.invited_by,
    invited_by_user: invitedByUser ? { full_name: invitedByUser.full_name ?? null } : null,
    invited_user_id: row.invited_user_id,
    invited_user: invitedUser
      ? {
          id: invitedUser.id,
          full_name: invitedUser.full_name ?? null,
          email: invitedUser.email ?? null,
          status: invitedUser.status ?? null,
        }
      : null,
    first_name: row.first_name,
    last_name: row.last_name,
    created_at: row.created_at,
    last_sent_at: row.last_sent_at,
    accepted_at: row.accepted_at,
    warnings: [],
  };
}

function detectAccessConflicts(
  users: AccessUserRecord[],
  invites: AccessInviteRecord[],
): {
  conflicts: AccessConflict[];
  userWarnings: Map<string, string[]>;
  inviteWarnings: Map<string, string[]>;
} {
  const conflicts: AccessConflict[] = [];
  const userWarnings = new Map<string, string[]>();
  const inviteWarnings = new Map<string, string[]>();

  const usersByEmail = new Map<string, AccessUserRecord>();
  users.forEach((user) => {
    const email = normalizeEmail(user.email);
    if (email) {
      usersByEmail.set(email, user);
    }
  });

  const pendingInvites = invites.filter((invite) => invite.status === 'pending');
  const acceptedInvites = invites.filter((invite) => invite.status === 'accepted');

  const acceptedByUserId = new Map<string, AccessInviteRecord[]>();
  acceptedInvites.forEach((invite) => {
    if (!invite.invited_user_id) return;
    const list = acceptedByUserId.get(invite.invited_user_id) ?? [];
    list.push(invite);
    acceptedByUserId.set(invite.invited_user_id, list);
  });

  pendingInvites.forEach((invite) => {
    const normalizedEmail = normalizeEmail(invite.email);
    if (normalizedEmail && usersByEmail.has(normalizedEmail)) {
      const matchedUser = usersByEmail.get(normalizedEmail)!;
      conflicts.push({
        type: 'possible_duplicate_credential',
        userId: matchedUser.id,
        inviteId: invite.id,
        description: `Pending invite ${invite.email} matches active user ${matchedUser.full_name ?? matchedUser.email}.`,
      });
      pushWarning(userWarnings, matchedUser.id, 'Pending invite uses this email.');
      pushWarning(inviteWarnings, invite.id, 'Email already belongs to an active BOH user.');
    }

    if (invite.invited_user_id) {
      conflicts.push({
        type: 'pending_alternate_email',
        userId: invite.invited_user_id,
        inviteId: invite.id,
        description: 'Invite references an existing BOH user but uses a different email.',
      });
      pushWarning(userWarnings, invite.invited_user_id, 'Alternate email invite is still pending.');
      pushWarning(inviteWarnings, invite.id, 'Invite is linked to an existing BOH user.');
    } else if (invite.first_name && invite.last_name) {
      const match = users.find(
        (user) =>
          user.first_name?.toLowerCase() === invite.first_name?.toLowerCase() &&
          user.last_name?.toLowerCase() === invite.last_name?.toLowerCase(),
      );
      if (match) {
        conflicts.push({
          type: 'possible_duplicate_credential',
          userId: match.id,
          inviteId: invite.id,
          description: 'Pending invite matches an existing user name.',
        });
        pushWarning(userWarnings, match.id, 'Name matches a pending invite.');
        pushWarning(inviteWarnings, invite.id, 'Name matches an active BOH user.');
      }
    }

    if (invite.invited_user_id && acceptedByUserId.has(invite.invited_user_id)) {
      conflicts.push({
        type: 'pending_alternate_email',
        userId: invite.invited_user_id,
        inviteId: invite.id,
        description: 'Additional invite detected for a user who has already accepted access.',
      });
      pushWarning(inviteWarnings, invite.id, 'Another invite for this user is already accepted.');
    }
  });

  return { conflicts, userWarnings, inviteWarnings };
}

function pushWarning(target: Map<string, string[]>, key: string, message: string) {
  const existing = target.get(key) ?? [];
  existing.push(message);
  target.set(key, existing);
}

function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

function normalizeSingleRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

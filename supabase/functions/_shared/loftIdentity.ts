export type LoftSupabaseServerKeys = {
  serviceRoleKey: string;
  publishableKey: string;
};

const isHeaderSafeKey = (value: string | undefined | null): value is string =>
  !!value && /^[\x21-\x7E]+$/.test(value);

export function resolveLoftSupabaseServerKeys(getEnv: (name: string) => string | undefined): LoftSupabaseServerKeys | null {
  const serviceRoleKey = getEnv("SB_SECRET_KEY");
  const publishableKey = getEnv("SB_PUBLISHABLE_KEY");
  return isHeaderSafeKey(serviceRoleKey) && isHeaderSafeKey(publishableKey) ? { serviceRoleKey, publishableKey } : null;
}

export type LoftBohIdentity = {
  bohUserId: string;
  tenantId: string;
  authUserId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  primaryRoleHint?: string | null;
  canHostLoft?: boolean;
  isLoftAdmin?: boolean;
  userTypeId?: number | string | null;
  avatarUrl?: string | null;
};

export type LoftMemberIdentity = {
  profileId?: string | null;
  bohUserId?: string | null;
  patronPersonId?: string | null;
  guestLabel?: string | null;
  userId?: string | null;
  displayName: string;
  avatarUrl?: string | null;
};

export function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function canonicalName(row: any, type: "boh_user" | "patron_person" | "guest" = "boh_user"): string {
  if (type === "guest") {
    const label = normalizeText(row?.guest_label);
    if (!label) throw new Error("guest_label_required");
    return label;
  }

  const firstName = normalizeText(row?.first_name);
  const lastName = normalizeText(row?.last_name);
  if (!firstName || !lastName) {
    throw new Error(type === "patron_person" ? "patron_onboarding_incomplete" : "boh_user_onboarding_incomplete");
  }
  return normalizeText(row?.full_name) || normalizeText(row?.display_name) || `${firstName} ${lastName}`;
}

export function isAdminRole(value: unknown): boolean {
  return ["admin", "owner", "super_admin", "superadmin"].includes(normalizeText(value).toLowerCase());
}

export async function resolveBohLoftIdentity(supabaseAdmin: any, authUserId: string): Promise<LoftBohIdentity> {
  const { data: bohUser, error: bohUserError } = await supabaseAdmin
    .from("boh_user")
    .select("id, tenant_id, auth_user_id, first_name, last_name, full_name, display_name, avatar_url, primary_role_hint")
    .eq("auth_user_id", authUserId)
    .eq("app_context", "boh")
    .maybeSingle();

  if (bohUserError) throw new Error(`boh_user_lookup_failed: ${bohUserError.message}`);
  if (!bohUser?.id || !bohUser?.tenant_id) throw new Error("boh_user_not_found");

  const displayName = canonicalName(bohUser, "boh_user");
  const admin = isAdminRole(bohUser.primary_role_hint);

  return {
    bohUserId: String(bohUser.id),
    tenantId: String(bohUser.tenant_id),
    authUserId,
    displayName,
    firstName: normalizeText(bohUser.first_name),
    lastName: normalizeText(bohUser.last_name),
    primaryRoleHint: bohUser.primary_role_hint || null,
    // public.profile permission flags were removed with the legacy profile table.
    // Host authorization is enforced by canonical loft_room.host_boh_user_id / RLS.
    canHostLoft: true,
    isLoftAdmin: admin,
    userTypeId: admin ? 5 : null,
    avatarUrl: bohUser.avatar_url || null,
  };
}

export async function hydrateLoftMemberIdentities(supabaseAdmin: any, rows: any[]): Promise<Map<string, LoftMemberIdentity>> {
  const byKey = new Map<string, LoftMemberIdentity>();
  const bohIds = Array.from(new Set(rows.map((r) => normalizeText(r?.boh_user_id)).filter(Boolean)));
  const patronIds = Array.from(new Set(rows.map((r) => normalizeText(r?.patron_person_id)).filter(Boolean)));

  if (bohIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("boh_user")
      .select("id, auth_user_id, first_name, last_name, avatar_url")
      .in("id", bohIds);
    if (error) throw new Error(`boh_user_identity_lookup_failed: ${error.message}`);
    (data || []).forEach((row: any) => {
      const id = String(row.id);
      byKey.set(`boh:${id}`, {
        profileId: null,
        bohUserId: id,
        userId: row.auth_user_id ? String(row.auth_user_id) : null,
        displayName: canonicalName(row, "boh_user"),
        avatarUrl: row.avatar_url || null,
      });
    });
  }

  if (patronIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("patron_person")
      .select("id, first_name, last_name")
      .in("id", patronIds);
    if (error) throw new Error(`patron_identity_lookup_failed: ${error.message}`);
    (data || []).forEach((row: any) => {
      const id = String(row.id);
      byKey.set(`patron:${id}`, {
        profileId: null,
        patronPersonId: id,
        displayName: canonicalName(row, "patron_person"),
      });
    });
  }

  rows.forEach((row) => {
    const guestLabel = normalizeText(row?.guest_label);
    if (!guestLabel) return;
    byKey.set(`guest:${guestLabel}`, { profileId: null, guestLabel, displayName: canonicalName({ guest_label: guestLabel }, "guest") });
  });

  return byKey;
}

export function identityForMemberRow(identityMap: Map<string, LoftMemberIdentity>, row: any): LoftMemberIdentity | null {
  const bohUserId = normalizeText(row?.boh_user_id);
  if (bohUserId && identityMap.has(`boh:${bohUserId}`)) return identityMap.get(`boh:${bohUserId}`)!;
  const patronPersonId = normalizeText(row?.patron_person_id);
  if (patronPersonId && identityMap.has(`patron:${patronPersonId}`)) return identityMap.get(`patron:${patronPersonId}`)!;
  const guestLabel = normalizeText(row?.guest_label);
  if (guestLabel) return identityMap.get(`guest:${guestLabel}`) || { profileId: null, guestLabel, displayName: guestLabel };
  return null;
}

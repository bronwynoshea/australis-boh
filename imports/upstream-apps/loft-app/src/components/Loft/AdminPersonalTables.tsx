import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { callEdgeFunction, useSupabaseUser } from '@/services/supabaseApi';
import { CheckCircle, Copy, KeyRound, Loader2, RefreshCw, Shield, UserPlus, XCircle } from 'lucide-react';

type PersonalTableRow = {
  userId?: string | null;
  bohUserId?: string | null;
  patronPersonId?: string | null;
  legacyProfileId?: string | null;
  profile_id?: string | null;
  email: string | null;
  displayName?: string;
  display_name?: string;
  can_use_personal_room: boolean;
  personal_room_id: string | null;
  personal_room_slug: string | null;
  invite_code: string | null;
  tenant_slug?: string | null;
  tenantSlug?: string | null;
  room_title: string | null;
  room_status: string | null;
  is_open: boolean;
  room_updated_at: string | null;
  profile_updated_at: string | null;
};

const getRowIdentity = (row: PersonalTableRow) =>
  row.bohUserId || row.userId || row.patronPersonId || row.legacyProfileId || row.profile_id || row.email || '';
const getRowDisplayName = (row: PersonalTableRow) => row.displayName || row.display_name || row.email || 'Loft member';

const getAppOrigin = () => {
  try {
    return new URL(window.location.href).origin;
  } catch {
    return '';
  }
};

const getDefaultTenantSlug = () => {
  try {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes('jobzcafe.com')) return 'jobzcafe';
    if (hostname.includes('australis.cloud') || hostname.includes('australis-boh.pages.dev')) return 'australis';
  } catch {
    // Fall through to the current JOBZCAFE® production tenant while Loft is white-labeled there.
  }
  return 'jobzcafe';
};

const buildGuestInviteLink = (origin: string, row: PersonalTableRow) => {
  if (!row.invite_code || !origin) return '';
  const tenantSlug = (row.tenant_slug || row.tenantSlug || getDefaultTenantSlug()).toLowerCase();
  return `${origin}/t/${tenantSlug}/loft/join/${row.invite_code.toLowerCase()}?guest=new`;
};

const AdminPersonalTables: React.FC = () => {
  const { profile } = useSupabaseUser();
  const isSuperAdmin = Number((profile as any)?.user_type_id) === 5;
  const [rows, setRows] = useState<PersonalTableRow[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const appOrigin = useMemo(getAppOrigin, []);

  const fetchPersonalTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callEdgeFunction<{ personalTables: PersonalTableRow[] }>(
        'loft_admin_list_personal_tables',
        {}
      );
      setRows(result.personalTables || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Personal Tables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchPersonalTables();
    } else {
      setLoading(false);
    }
  }, [fetchPersonalTables, isSuperAdmin]);

  const managePersonalTable = async (
    action: 'enable' | 'disable' | 'rotate_invite',
    payload: { email?: string; userId?: string; bohUserId?: string; profileId?: string }
  ) => {
    const key = `${action}:${payload.bohUserId || payload.userId || payload.profileId || payload.email || 'new'}`;
    setProcessingKey(key);
    setNotice(null);
    setError(null);
    try {
      const result = await callEdgeFunction<{ message?: string }>('loft_admin_manage_personal_table', {
        action,
        ...payload,
      });
      setNotice(result.message || 'Personal Table access updated.');
      setEmail('');
      await fetchPersonalTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update Personal Table access');
    } finally {
      setProcessingKey(null);
    }
  };

  const handleEnableByEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    await managePersonalTable('enable', { email: trimmed });
  };

  const copyInviteLink = async (row: PersonalTableRow) => {
    const inviteLink = buildGuestInviteLink(appOrigin, row);
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setNotice(`Guest link copied for ${getRowDisplayName(row)}.`);
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="loft-card p-8 text-center space-y-4 max-w-md">
          <Shield className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-black uppercase tracking-tight text-main dark:text-white">
            Superadmin Access Required
          </h2>
          <p className="text-sm text-main/70 dark:text-white/70">
            Personal Table administration is only available to JOBZCAFE® superadmins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-12 pb-32">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <KeyRound className="w-8 h-8 text-cafe" />
                <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-main dark:text-white">
                  Personal Tables
                </h1>
              </div>
              <p className="text-sm text-main/70 dark:text-white/70 max-w-2xl">
                Manage which members can host a Personal Table. This area is restricted to JOBZCAFE® superadmins.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchPersonalTables}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-main transition hover:border-cafe/60 hover:text-cafe disabled:opacity-50 dark:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        <form onSubmit={handleEnableByEmail} className="loft-card p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="space-y-2">
              <span className="block text-[10px] font-black uppercase tracking-[0.28em] text-muted">
                Add member by email
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="member@company.com"
                className="w-full rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-4 py-3 text-sm font-bold text-main outline-none transition placeholder:text-muted focus:border-cafe/70 dark:text-white"
              />
            </label>
            <button
              type="submit"
              disabled={!email.trim() || !!processingKey}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cafe px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-white transition hover:bg-cafe/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {processingKey?.startsWith('enable:') ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Enable Personal Table
            </button>
          </div>
        </form>

        {notice && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm font-bold text-green-600 dark:text-green-300">
            {notice}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cafe animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="loft-card p-12 text-center">
            <p className="text-main/50 dark:text-white/50 font-bold uppercase tracking-widest text-sm">
              No Personal Table users found
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {rows.map((row) => {
              const rowIdentity = getRowIdentity(row);
              const targetPayload = row.bohUserId
                ? { bohUserId: row.bohUserId }
                : row.userId
                  ? { userId: row.userId }
                  : { profileId: row.legacyProfileId || row.profile_id || '' };
              const disableKey = `disable:${rowIdentity}`;
              const rotateKey = `rotate_invite:${rowIdentity}`;
              return (
                <article key={rowIdentity} className="loft-card p-5 md:p-6">
                  <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-black uppercase tracking-tight text-main dark:text-white">
                          {getRowDisplayName(row)}
                        </h2>
                        {row.can_use_personal_room ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-green-600 dark:text-green-300">
                            <CheckCircle className="w-3 h-3" />
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-300">
                            <XCircle className="w-3 h-3" />
                            Disabled
                          </span>
                        )}
                        {row.is_open && (
                          <span className="rounded-lg border border-cafe/30 bg-cafe/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-cafe">
                            Open
                          </span>
                        )}
                      </div>
                      <div className="grid gap-2 text-xs font-bold text-main/60 dark:text-white/60 md:grid-cols-2">
                        <p className="truncate">Email: {row.email || 'No email on profile'}</p>
                        <p>Table: {row.personal_room_id ? row.room_status || 'Created' : 'Not created yet'}</p>
                        <p className="truncate">Invite: {buildGuestInviteLink(appOrigin, row) || 'Created when member opens Personal Table'}</p>
                        <p className="truncate">Title: {row.room_title || 'Created on first use'}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => copyInviteLink(row)}
                        disabled={!row.invite_code}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-main transition hover:border-cafe/60 hover:text-cafe disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
                      >
                        <Copy className="w-4 h-4" />
                        Copy Link
                      </button>
                      <button
                        type="button"
                        onClick={() => managePersonalTable('rotate_invite', targetPayload)}
                        disabled={!row.personal_room_id || !!processingKey}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--loft-border)] bg-[var(--loft-surface-2)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-main transition hover:border-cafe/60 hover:text-cafe disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
                      >
                        {processingKey === rotateKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Rotate
                      </button>
                      <button
                        type="button"
                        onClick={() => managePersonalTable(row.can_use_personal_room ? 'disable' : 'enable', targetPayload)}
                        disabled={!rowIdentity || !!processingKey}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          row.can_use_personal_room
                            ? 'border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/15 dark:text-red-300'
                            : 'border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/15 dark:text-green-300'
                        }`}
                      >
                        {processingKey === disableKey || processingKey === `enable:${rowIdentity}` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {row.can_use_personal_room ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPersonalTables;

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface BohApp {
  id: string;
  slug: string | null;
  name: string | null;
  description: string | null;
  route: string | null;
  external_url: string | null;
  primary_color: string | null;
  type: 'internal_tool' | 'external_app' | null;
  is_active: boolean;
  sort_order: number | null;
  location: 'internal' | 'external' | null;
  created_at: string;
}

interface AppUserAccess {
  id: string;
  permission_level: 'view' | 'edit' | 'admin';
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    status: 'pending' | 'active' | 'inactive' | string;
  } | null;
}

interface BohUserOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string;
}

interface AppsAccessPageProps {
  // No props needed - page fetches its own data
}

const AppsAccessPage: React.FC<AppsAccessPageProps> = () => {
  const [apps, setApps] = useState<BohApp[]>([]);
  const [userCountByAppId, setUserCountByAppId] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-app users panel state
  const [selectedApp, setSelectedApp] = useState<BohApp | null>(null);
  const [isUsersPanelOpen, setIsUsersPanelOpen] = useState(false);
  const [appUsers, setAppUsers] = useState<AppUserAccess[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<BohUserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<'view' | 'edit' | 'admin'>('view');

  const getUserLabel = (user: { first_name: string | null; last_name: string | null } | null) =>
    user ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'Incomplete profile' : 'Incomplete profile';

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { data: appsData, error: appsError } = await supabase
          .from('boh_app')
          .select('*')
          .order('name', { ascending: true })
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (appsError) {
          throw new Error(`Failed to load apps: ${appsError.message}`);
        }

        const sortedApps = (appsData || []).sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setApps(sortedApps);

        const { data: appUserCounts, error: countsError } = await supabase
          .from('boh_user_app')
          .select('app_id, user_id')
          .eq('app_context', 'boh');

        if (countsError) {
          console.error('Error loading user counts:', countsError);
        }

        const countMap: Record<string, number> = {};
        if (appUserCounts) {
          appUserCounts.forEach((item) => {
            countMap[item.app_id] = (countMap[item.app_id] || 0) + 1;
          });
        }
        setUserCountByAppId(countMap);
      } catch (err) {
        console.error('Error loading apps data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load apps');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const formatDescription = (value: string | null) => {
    if (!value) return '—';
    const trimmed = value.trim();
    if (!trimmed) return '—';
    return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
  };

  const getTypeBadge = (type: string | null) => {
    if (!type) return null;
    const label = type === 'internal_tool' ? 'Internal' : type === 'external_app' ? 'External' : type;
    return (
      <span
        className="card-status"
        style={{
          backgroundColor:
            type === 'internal_tool' ? 'rgba(99, 92, 205, 0.15)' : 'rgba(64, 156, 255, 0.15)',
          color: type === 'internal_tool' ? '#635CCD' : '#409CFF',
          fontSize: '0.75rem',
          padding: '0.25rem 0.5rem',
        }}
      >
        {label}
      </span>
    );
  };

  const getStatusBadge = (isActive: boolean) => (
    <span
      className={`card-status ${isActive ? 'status-granted' : 'status-expired'}`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );

  const handleToggleStatus = async (app: BohApp) => {
    const newIsActive = !app.is_active;

    // Optimistic update
    setApps((prev) =>
      prev.map((a) => (a.id === app.id ? { ...a, is_active: newIsActive } : a))
    );

    const { error: updateError } = await supabase
      .from('boh_app')
      .update({ is_active: newIsActive })
      .eq('id', app.id);

    if (updateError) {
      console.error('[Apps & Permissions] Failed to toggle status', updateError);
      // Revert on error
      setApps((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, is_active: app.is_active } : a))
      );
    }
  };

  const loadUsersForApp = async (app: BohApp) => {
    setIsLoadingUsers(true);
    setUsersError(null);

    try {
      // Load existing user access for this app
      const { data, error: usersErr } = await supabase
        .from('boh_user_app')
        .select(
          `id, permission_level, user:boh_user (id, first_name, last_name, email, status)`
        )
        .eq('app_id', app.id)
        .eq('app_context', 'boh');

      if (usersErr) {
        throw usersErr;
      }

      const normalized = (data || []).map((record: any) => {
        const userRecord = Array.isArray(record.user) ? record.user[0] : record.user;
        return {
          ...record,
          user: userRecord,
        } as AppUserAccess;
      });
      setAppUsers(normalized);

      // Load all active BOH users for the add-user dropdown
      const { data: usersOptions, error: optionsErr } = await supabase
        .from('boh_user')
        .select('id, first_name, last_name, email, status')
        .eq('app_context', 'boh')
        .eq('status', 'active');

      if (optionsErr) {
        console.error('[Apps & Permissions] Error loading user options', optionsErr);
      }

      setAvailableUsers((usersOptions || []) as BohUserOption[]);
    } catch (err) {
      console.error('[Apps & Permissions] Error loading users for app', err);
      setUsersError(
        err instanceof Error ? err.message : 'Failed to load users for this app'
      );
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleOpenUsersPanel = (app: BohApp) => {
    setSelectedApp(app);
    setIsUsersPanelOpen(true);
    void loadUsersForApp(app);
  };

  const handleCloseUsersPanel = () => {
    setIsUsersPanelOpen(false);
    setSelectedApp(null);
    setAppUsers([]);
    setSelectedUserId('');
    setSelectedPermission('view');
    setUsersError(null);
  };

  const handleChangePermission = async (
    access: AppUserAccess,
    newPermission: 'view' | 'edit' | 'admin',
  ) => {
    if (newPermission === access.permission_level) return;

    const previous = access.permission_level;

    setAppUsers((prev) =>
      prev.map((a) =>
        a.id === access.id ? { ...a, permission_level: newPermission } : a,
      ),
    );

    const { error: updateError } = await supabase
      .from('boh_user_app')
      .update({ permission_level: newPermission })
      .eq('id', access.id);

    if (updateError) {
      console.error('[Apps & Permissions] Failed to update permission', updateError);
      setAppUsers((prev) =>
        prev.map((a) =>
          a.id === access.id ? { ...a, permission_level: previous } : a,
        ),
      );
    }
  };

  const handleRemoveAccess = async (access: AppUserAccess) => {
    const appId = selectedApp?.id;
    setAppUsers((prev) => prev.filter((a) => a.id !== access.id));

    if (appId) {
      setUserCountByAppId((prev) => ({
        ...prev,
        [appId]: Math.max((prev[appId] || 1) - 1, 0),
      }));
    }

    const { error: deleteError } = await supabase
      .from('boh_user_app')
      .delete()
      .eq('id', access.id);

    if (deleteError) {
      console.error('[Apps & Permissions] Failed to remove access', deleteError);
      // Revert list (we won't perfectly restore count here, but this is an edge case)
      void loadUsersForApp(selectedApp as BohApp);
    }
  };

  const handleAddUserAccess = async () => {
    if (!selectedApp || !selectedUserId) return;

    const { error: insertError, data } = await supabase
      .from('boh_user_app')
      .insert({
        user_id: selectedUserId,
        app_id: selectedApp.id,
        permission_level: selectedPermission,
        app_context: 'boh',
      })
      .select(
        `id, permission_level, user:boh_user (id, first_name, last_name, email, status)`,
      )
      .single();

    if (insertError) {
      console.error('[Apps & Permissions] Failed to add user access', insertError);
      return;
    }

    const normalized = Array.isArray(data?.user)
      ? { ...data, user: data.user[0] }
      : data;

    setAppUsers((prev) => [...prev, normalized as AppUserAccess]);

    setUserCountByAppId((prev) => ({
      ...prev,
      [selectedApp.id]: (prev[selectedApp.id] || 0) + 1,
    }));

    setSelectedUserId('');
    setSelectedPermission('view');
  };

  if (isLoading) {
    return (
      <div className="apps-access-content">
        <div className="content-panel">
          <p>Loading apps...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="apps-access-content">
        <div className="content-panel">
          <p style={{ color: 'var(--error-color, #dc2626)' }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="apps-access-content">
      <div className="content-panel">
        <div className="content-panel-header" style={{ alignItems: 'flex-end' }}>
          <div>
            <p className="eyebrow">Applications</p>
            <h3>Manage BOH apps</h3>
            <p className="panel-subtitle">
              Review every app, see how many crew members are mapped, and keep statuses accurate.
            </p>
          </div>
        </div>

        {/* Desktop / tablet table */}
        <div className="access-table-wrapper" style={{ marginTop: '1rem' }}>
          <table className="access-table">
            <thead>
              <tr>
                <th>App</th>
                <th>Description</th>
                <th>Type</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Users</th>
              </tr>
            </thead>
            <tbody>
              {apps.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}
                  >
                    No apps found.
                  </td>
                </tr>
              ) : (
                apps.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#FDF8FF' }}>
                        {app.name}
                      </div>
                    </td>
                    <td>
                      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                        {formatDescription(app.description)}
                      </div>
                    </td>
                    <td>{getTypeBadge(app.type)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(app)}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                      >
                        {getStatusBadge(app.is_active)}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      <button
                        type="button"
                        onClick={() => handleOpenUsersPanel(app)}
                        style={{
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: 'var(--boh-purple)',
                        }}
                      >
                        {userCountByAppId[app.id] || 0}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="access-mobile-cards" style={{ marginTop: '1.5rem' }}>
          {apps.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No apps found.
            </div>
          ) : (
            apps.map((app) => (
              <div
                key={app.id}
                className="user-card"
                style={{ marginBottom: 0 }}
              >
                <div className="user-card-header">
                  <span style={{ fontWeight: 700, color: '#FDF8FF' }}>{app.name || app.slug}</span>
                </div>
                <div
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.25rem',
                  }}
                >
                  {app.slug}
                </div>
                <div
                  style={{
                    marginTop: '0.75rem',
                    fontSize: '0.9rem',
                  }}
                >
                  {formatDescription(app.description)}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {getTypeBadge(app.type)}
                    {getStatusBadge(app.is_active)}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {userCountByAppId[app.id] || 0} users
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AppsAccessPage;

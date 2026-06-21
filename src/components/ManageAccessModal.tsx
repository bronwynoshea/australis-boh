import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AccessUserRecord,
  BohApp,
  BohRole,
  AccessUserAccessInput,
} from '../boh/api/bohApi';

type AppPermissionLevel = 'none' | 'view' | 'edit' | 'admin';

interface ManageAccessModalProps {
  isOpen: boolean;
  user: AccessUserRecord | null;
  apps: BohApp[];
  roles: BohRole[];
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: AccessUserAccessInput) => void;
}

const permissionOptions: Array<{ value: AppPermissionLevel; label: string }> = [
  { value: 'none', label: 'No access' },
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
  { value: 'admin', label: 'Admin' },
];

const ManageAccessModal: React.FC<ManageAccessModalProps> = ({
  isOpen,
  user,
  apps,
  roles,
  isSaving,
  error,
  onClose,
  onSave,
}) => {
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [appPermissions, setAppPermissions] = useState<Record<string, AppPermissionLevel>>({});
  const appCustomStateRef = useRef<Record<string, AppPermissionLevel>>({});

  const superAdminRole = useMemo(() => roles.find((role) => role.code === 'super_admin'), [roles]);
  const isSuperAdminSelected = useMemo(() => {
    if (!user) return false;
    if (superAdminRole) {
      return selectedRoleIds.has(superAdminRole.id);
    }
    return user.is_super_admin;
  }, [selectedRoleIds, superAdminRole, user]);

  useEffect(() => {
    if (!user) return;
    setSelectedRoleIds(new Set(user.roles.map((role) => role.role_id)));

    const defaultPermissions: Record<string, AppPermissionLevel> = {};
    const explicitDefaults: Record<string, AppPermissionLevel> = {};
    apps.forEach((app) => {
      const assignment = user.apps.find((grant) => grant.app_id === app.id);
      defaultPermissions[app.id] = (assignment?.permission_level ?? 'none') as AppPermissionLevel;

      const explicitGrant = user.apps.find((grant) => grant.app_id === app.id && grant.source !== 'super_admin');
      explicitDefaults[app.id] = (explicitGrant?.permission_level ?? 'none') as AppPermissionLevel;
    });
    setAppPermissions(defaultPermissions);
    appCustomStateRef.current = explicitDefaults;
  }, [user, apps]);

  const handleToggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      const willSelect = !next.has(roleId);
      if (willSelect) {
        next.add(roleId);
      } else {
        next.delete(roleId);
      }

      if (superAdminRole && roleId === superAdminRole.id) {
        if (willSelect) {
          const elevated: Record<string, AppPermissionLevel> = {};
          apps.forEach((app) => {
            elevated[app.id] = 'admin';
          });
          setAppPermissions(elevated);
        } else {
          const restored: Record<string, AppPermissionLevel> = {};
          apps.forEach((app) => {
            restored[app.id] = appCustomStateRef.current[app.id] ?? 'none';
          });
          setAppPermissions(restored);
        }
      }
      return next;
    });
  };

  const handlePermissionChange = (appId: string, value: AppPermissionLevel) => {
    if (isSuperAdminSelected) return;
    setAppPermissions((prev) => ({ ...prev, [appId]: value }));
    appCustomStateRef.current[appId] = value;
  };

  const assignedApps = useMemo(
    () =>
      isSuperAdminSelected
        ? []
        : Object.entries(appPermissions)
            .filter(([, level]) => level !== 'none')
            .map(([appId, level]) => ({ app_id: appId, permission_level: level as 'view' | 'edit' | 'admin' })),
    [appPermissions, isSuperAdminSelected],
  );

  const sortedApps = useMemo(
    () =>
      [...apps].sort((a, b) => {
        const aLabel = (a.name || a.slug || '').toLowerCase();
        const bLabel = (b.name || b.slug || '').toLowerCase();
        return aLabel.localeCompare(bLabel);
      }),
    [apps],
  );

  const pendingAccessSummary = isSuperAdminSelected
    ? 'Full platform access (Super Admin)'
    : assignedApps.length > 0
      ? `Access to ${assignedApps.length} app${assignedApps.length === 1 ? '' : 's'}`
      : 'No app access selected';

  const pendingAccessHint = isSuperAdminSelected
    ? 'Super admins inherit Admin-level permissions for every active BOH app.'
    : assignedApps.length > 0
      ? 'Only the selected apps below will remain accessible once you save.'
      : 'The crew member will lose access to every BOH app unless you grant at least one.';

  if (!isOpen || !user) return null;

  const handleSave = () => {
    const payload: AccessUserAccessInput = {
      userId: user.id,
      roleIds: Array.from(selectedRoleIds),
      appGrants: assignedApps,
    };
    onSave(payload);
  };

  return (
    <div
      id="manage-access-modal"
      className={`modal-backdrop ${isOpen ? 'visible' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content manage-access-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header manage-access-modal__header">
          <div>
            <p className="eyebrow">Managing access for</p>
            <h3>{user.full_name || user.email || 'Crew member'}</h3>
            <p>{user.email || 'No email on record'}</p>
          </div>
          <div className="status-badge">{user.status}</div>
        </div>

        {user.warnings.length > 0 && (
          <div className="alert warning" style={{ marginBottom: '1rem' }}>
            <ul>
              {user.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="manage-access-card">
          <header>
            <div>
              <p className="eyebrow">Access summary</p>
              <h4>Current vs pending access</h4>
            </div>
            <span className="section-hint">Preview before saving</span>
          </header>

          <div className="access-summary-grid">
            <div>
              <p className="summary-label">Current</p>
              <p className="summary-value">{user.access_summary}</p>
            </div>
            <div>
              <p className="summary-label">Pending</p>
              <p className="summary-value">{pendingAccessSummary}</p>
            </div>
          </div>
          <p className="summary-hint">{pendingAccessHint}</p>
        </section>

        <div className="modal-body manage-access-modal__body">
          <section className="manage-access-card">
            <header>
              <div>
                <p className="eyebrow">Roles</p>
                <h4>Select responsibilities</h4>
              </div>
              <span className="section-hint">Tap or click to toggle</span>
            </header>

            {roles.length === 0 ? (
              <p style={{ color: 'var(--boh-text-sub-light)' }}>No roles defined.</p>
            ) : (
              <div className="role-pill-grid">
                {roles.map((role) => {
                  const selected = selectedRoleIds.has(role.id);
                  return (
                    <label
                      key={role.id}
                      className={`role-pill ${selected ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => handleToggleRole(role.id)}
                        aria-label={role.label || role.code}
                      />
                      <span className={`role-pill-indicator ${selected ? 'active' : ''}`}>
                        {selected ? '✓' : ''}
                      </span>
                      <div>
                        <span className="role-name">{role.label || role.code}</span>
                        {(role.description || role.code === 'super_admin') && (
                          <span className="role-desc">
                            {role.code === 'super_admin'
                              ? 'Full platform control'
                              : role.description}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <section className="manage-access-card">
            <header>
              <div>
                <p className="eyebrow">Applications</p>
                <h4>Assign app permissions</h4>
              </div>
              <span className="section-hint">
                {isSuperAdminSelected
                  ? 'Super admins always have Admin access to every active app.'
                  : 'Set the lowest level needed'}
              </span>
            </header>

            {isSuperAdminSelected && (
              <div className="alert info" style={{ marginBottom: '1rem' }}>
                Remove the Super Admin role above to customize per-app permissions.
              </div>
            )}

            <div className="app-grid">
              {sortedApps.map((app) => (
                <div key={app.id} className="app-access-row">
                  <div>
                    <div className="app-name">{app.name}</div>
                    <div className="app-slug">{app.slug}</div>
                  </div>
                  <select
                    className="themed-select"
                    value={appPermissions[app.id] ?? 'none'}
                    onChange={(e) => handlePermissionChange(app.id, e.target.value as AppPermissionLevel)}
                    disabled={isSuperAdminSelected || isSaving}
                  >
                    {permissionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>
        </div>

        {error && (
          <div className="modal-error">{error}</div>
        )}

        <div className="modal-footer manage-access-modal__footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManageAccessModal;



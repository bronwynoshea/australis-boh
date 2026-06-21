import React from 'react';
import type { AccessUserRecord, AccessConflict } from '../../../boh/api/bohApi';

interface CrewAccessPageProps {
  users: AccessUserRecord[];
  conflicts: AccessConflict[];
  isLoading: boolean;
  error: string | null;
  onEditUser: (user: AccessUserRecord) => void;
}

const CrewAccessPage: React.FC<CrewAccessPageProps> = ({ users, conflicts, isLoading, error, onEditUser }) => {
  const activeUsers = users.filter((user) => user.status === 'active');
  const inactiveUsers = users.filter((user) => user.status !== 'active');

  const getStatusBadge = (status: string) => (
    <span className={`card-status status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );

  const hasSuperAdminRole = (member: AccessUserRecord) =>
    member.roles.some((role) => role.code === 'super_admin');

  const renderApps = (member: AccessUserRecord) => {
    if (hasSuperAdminRole(member)) {
      return (
        <span
          className="card-status"
          style={{
            backgroundColor: 'rgba(96, 165, 250, 0.15)',
            color: '#2563EB',
            fontSize: '0.78rem',
            padding: '0.25rem 0.6rem',
          }}
        >
          All apps via super admin
        </span>
      );
    }

    if (member.apps.length === 0) {
      return <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>—</span>;
    }

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {member.apps.map((grant) => (
          <span
            key={grant.app?.id ?? grant.app_id}
            className="card-status"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#059669',
              fontSize: '0.75rem',
              padding: '0.2rem 0.55rem',
            }}
          >
            {grant.app?.name ?? grant.app?.slug ?? 'App access'}
          </span>
        ))}
      </div>
    );
  };

  const renderWarnings = (member: AccessUserRecord) => (
    member.warnings && member.warnings.length > 0 && (
      <div style={{ fontSize: '0.8rem', color: 'var(--warning-color, #B45309)', marginTop: '0.35rem' }}>
        {member.warnings.map((warning) => (
          <div key={warning}>{warning}</div>
        ))}
      </div>
    )
  );

  if (isLoading) {
    return (
      <div className="content-panel">
        <p>Loading crew members…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-panel">
        <p style={{ color: 'var(--error-color, #dc2626)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="content-panel">
      <div className="content-panel-header" style={{ alignItems: 'flex-end' }}>
        <div>
          <p className="eyebrow">Crew</p>
          <h3>Crew members</h3>
          <p className="panel-subtitle">Review who has access and adjust their permissions.</p>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="alert warning" style={{ marginBottom: '1rem' }}>
          <strong>Potential conflicts detected</strong>
          <ul style={{ marginTop: '0.5rem' }}>
            {conflicts.map((conflict) => (
              <li key={`${conflict.type}-${conflict.userId ?? ''}-${conflict.inviteId ?? ''}`}>{conflict.description}</li>
            ))}
          </ul>
        </div>
      )}

      {users.length === 0 ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <p>No crew members found.</p>
        </div>
      ) : (
        <div className="access-table-wrapper">
          <table className="access-table crew-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Role(s)</th>
                <th>Apps</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((member) => (
                <tr key={member.id}>
                  <td>{member.full_name || 'Unknown'}</td>
                  <td>{member.email || '—'}</td>
                  <td>{getStatusBadge(member.status)}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {member.roles.length > 0 ? (
                        member.roles.map((role) => (
                          <span
                            key={role.code}
                            className="card-status"
                            style={{
                              backgroundColor: 'rgba(99, 92, 205, 0.15)',
                              color: '#635CCD',
                              fontSize: '0.75rem',
                              padding: '0.25rem 0.5rem',
                            }}
                          >
                            {role.label}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>—</span>
                      )}
                    </div>
                  </td>
                  <td>{renderApps(member)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-tertiary"
                      onClick={() => onEditUser(member)}
                    >
                      Edit access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inactiveUsers.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Inactive / pending users</h4>
          <div className="access-table-wrapper">
            <table className="access-table crew-table subdued">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Role(s)</th>
                  <th>Apps</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inactiveUsers.map((member) => (
                  <tr key={member.id}>
                    <td>{member.full_name || 'Unknown'}</td>
                    <td>{member.email || '—'}</td>
                    <td>{getStatusBadge(member.status)}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {member.roles.length > 0 ? (
                          member.roles.map((role) => (
                            <span
                              key={role.code}
                              className="card-status"
                              style={{
                                backgroundColor: 'rgba(99, 92, 205, 0.15)',
                                color: '#635CCD',
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                              }}
                            >
                              {role.label}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>—</span>
                        )}
                        {renderWarnings(member)}
                      </div>
                    </td>
                    <td>{renderApps(member)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-tertiary"
                        onClick={() => onEditUser(member)}
                      >
                        Edit access
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrewAccessPage;

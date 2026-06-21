import React, { useMemo, useState } from 'react';
import type { AccessInviteRecord, BohApp } from '../../../boh/api/bohApi';

interface TeamInvitesPageProps {
  invites: AccessInviteRecord[];
  apps: BohApp[];
  isLoading: boolean;
  error: string | null;
  onCreateInvite: (payload: { email: string; firstName: string; lastName: string; apps: string[] }) => Promise<void>;
  onResendInvite: (inviteId: string) => Promise<void>;
  onManualAcceptInvite: (inviteId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const TeamInvitesPage: React.FC<TeamInvitesPageProps> = ({
  invites,
  apps,
  isLoading,
  error,
  onCreateInvite,
  onResendInvite,
  onManualAcceptInvite,
  onRefresh,
}) => {
  const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedAppSlugs, setSelectedAppSlugs] = useState<string[]>([]);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const pendingInvites = useMemo(() => invites.filter((invite) => invite.status === 'pending'), [invites]);
  const acceptedInvites = useMemo(() => invites.filter((invite) => invite.status === 'accepted'), [invites]);

  const handleToggleApp = (appSlug: string) => {
    setSelectedAppSlugs((prev) =>
      prev.includes(appSlug)
        ? prev.filter((slug) => slug !== appSlug)
        : [...prev, appSlug]
    );
  };

  const allAppsSelected = apps.length > 0 && selectedAppSlugs.length === apps.length;

  const handleSelectAllApps = () => {
    if (allAppsSelected) {
      setSelectedAppSlugs([]);
    } else {
      setSelectedAppSlugs(apps.map((app) => app.slug));
    }
  };

  const resetInviteForm = () => {
    setInviteFirstName('');
    setInviteLastName('');
    setInviteEmail('');
    setSelectedAppSlugs([]);
    setInviteError(null);
    setInviteSuccess(null);
  };

  const handleSubmitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    if (!inviteFirstName.trim() || !inviteLastName.trim()) {
      setInviteError('Please enter a first and last name');
      return;
    }

    // Validation
    if (!inviteEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      setInviteError('Please enter a valid email address');
      return;
    }

    if (selectedAppSlugs.length === 0) {
      setInviteError('Please select at least one app');
      return;
    }

    try {
      setIsSubmittingInvite(true);

      await onCreateInvite({
        email: inviteEmail.trim().toLowerCase(),
        firstName: inviteFirstName.trim(),
        lastName: inviteLastName.trim(),
        apps: selectedAppSlugs,
      });

      await onRefresh();

      resetInviteForm();
      setIsInviteFormOpen(false);

      const sentAt = new Date().toLocaleString();
      setInviteSuccess(`Invite sent to ${inviteEmail.trim().toLowerCase()} at ${sentAt}`);
    } catch (err) {
      console.error('Error creating invite:', err);
      setInviteError(
        'We could not send that invite right now. Please try again in a moment or contact your BOH admin if it keeps happening.',
      );
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      setInviteError(null);
      setInviteSuccess(null);

      await onResendInvite(inviteId);
      await onRefresh();

      const sentAt = new Date().toLocaleString();
      setInviteSuccess(`Invite resent at ${sentAt}`);
    } catch (err) {
      console.error('Error resending invite:', err);
      setInviteError(
        'We could not resend that invite right now. Please try again in a moment or contact your BOH admin if it keeps happening.',
      );
    }
  };

  const handleManualAcceptInvite = async (inviteId: string) => {
    try {
      setInviteError(null);
      setInviteSuccess(null);

      await onManualAcceptInvite(inviteId);
      await onRefresh();

      setInviteSuccess('Invite manually accepted and linked to existing user');
    } catch (err) {
      console.error('Error manually accepting invite:', err);
      setInviteError(
        'Could not manually accept invite. The user may not exist in BOH yet.',
      );
    }
  };

  if (isLoading) {
    return (
      <div className="team-invites-content">
        <div className="content-panel">
          <p>Loading team data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="team-invites-content">
        <div className="content-panel">
          <p style={{ color: 'var(--error-color, #dc2626)' }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="team-invites-content">
      <div className="content-panel">
        <div className="content-panel-header">
          <div>
            <h3>Invitations</h3>
            <p className="panel-subtitle">Send new invites and keep track of pending requests.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onRefresh}
              disabled={isLoading}
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                resetInviteForm();
                setIsInviteFormOpen(true);
              }}
            >
              Invite teammate
            </button>
          </div>
        </div>

        {inviteError && (
          <p style={{ color: 'var(--error-color, #dc2626)', margin: '0.75rem 0 0.5rem' }}>
            {inviteError}
          </p>
        )}

        {inviteSuccess && !inviteError && (
          <p style={{ color: '#059669', margin: '0.75rem 0 0.5rem' }}>
            {inviteSuccess}
          </p>
        )}

        {isInviteFormOpen && (
          <form
            onSubmit={handleSubmitInvite}
            className="team-invite-form"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}
          >
            <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div
                className="form-field"
                style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
              >
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>First name</label>
                <input
                  type="text"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="Alex"
                />
              </div>
              <div
                className="form-field"
                style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
              >
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Last name</label>
                <input
                  type="text"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Nguyen"
                />
              </div>
            </div>

            <div
              className="form-field"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxWidth: '360px' }}
            >
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Email address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>

            <div
              className="form-field"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Apps to give access to</label>
                <button
                  type="button"
                  className="btn btn-tertiary"
                  onClick={handleSelectAllApps}
                  style={{
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.8rem',
                    backgroundColor: 'rgba(99, 92, 205, 0.08)',
                    color: '#4C1D95',
                    border: '1px solid rgba(99, 92, 205, 0.2)',
                  }}
                >
                  {allAppsSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {apps.map((app) => (
                  <label
                    key={app.slug}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      borderRadius: '999px',
                      padding: '0.25rem 0.75rem',
                      cursor: 'pointer',
                      border: selectedAppSlugs.includes(app.slug)
                        ? '1px solid #635CCD'
                        : '1px solid rgba(148, 163, 184, 0.4)',
                      backgroundColor: selectedAppSlugs.includes(app.slug)
                        ? 'rgba(99, 92, 205, 0.1)'
                        : 'transparent',
                      color: selectedAppSlugs.includes(app.slug) ? '#635CCD' : 'inherit',
                      fontSize: '0.85rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ accentColor: '#635CCD' }}
                      checked={selectedAppSlugs.includes(app.slug)}
                      onChange={() => handleToggleApp(app.slug)}
                    />
                    <span>{app.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div
              className="form-actions"
              style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}
            >
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmittingInvite}
              >
                {isSubmittingInvite ? 'Sending invite...' : 'Send invite'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsInviteFormOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: '2rem' }}>
          <h3>Pending invites</h3>
          {pendingInvites.length === 0 ? (
            <p className="panel-subtitle">
              When you send an invite, it will appear here so you can see who is still pending.
            </p>
          ) : (
            <ul
              style={{
                marginTop: '0.5rem',
                listStyle: 'none',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {pendingInvites.map((invite) => (
                <li
                  key={invite.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{invite.email}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                      {invite.last_sent_at &&
                        `  Last sent ${new Date(invite.last_sent_at).toLocaleString()}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleResendInvite(invite.id)}
                    >
                      Resend
                    </button>
                    <button
                      type="button"
                      className="btn btn-tertiary"
                      onClick={() => handleManualAcceptInvite(invite.id)}
                      style={{
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.8rem',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        color: '#16a34a',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                      }}
                    >
                      Manual Accept
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamInvitesPage;

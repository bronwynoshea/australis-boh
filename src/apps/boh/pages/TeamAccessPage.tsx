import React, { useMemo, useState } from 'react';
import AppsAccessPage from './AppsAccessPage.tsx';
import CrewAccessPage from './CrewAccessPage.tsx';
import TeamInvitesPage from './TeamInvitesPage.tsx';
import ManageAccessModal from '../../../components/ManageAccessModal';
import { useAccessAdminSnapshot } from '../../../shared/hooks/useAccessAdminSnapshot';
import {
  createInvite,
  resendInvite,
  manualAcceptInvite,
  saveUserAccessChanges,
  getCurrentBohUserId,
  type AccessUserRecord,
  type AccessUserAccessInput,
} from '../../../boh/api/bohApi';

type TeamAccessTab = 'apps' | 'crew' | 'invites';

const tabConfig: { key: TeamAccessTab; label: string }[] = [
  { key: 'apps', label: 'Applications' },
  { key: 'crew', label: 'Crew' },
  { key: 'invites', label: 'Invitations' },
];

const TeamAccessPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TeamAccessTab>('apps');
  const { snapshot, isLoading, error, refresh } = useAccessAdminSnapshot();
  const [editingUser, setEditingUser] = useState<AccessUserRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const users = snapshot?.users ?? [];
  const conflicts = snapshot?.conflicts ?? [];
  const apps = snapshot?.apps ?? [];
  const roles = snapshot?.roles ?? [];
  const invites = snapshot?.invites ?? [];

  const handleEditUser = (user: AccessUserRecord) => {
    setEditingUser(user);
    setIsModalOpen(true);
    setModalError(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setModalError(null);
  };

  const handleSaveAccess = async (input: AccessUserAccessInput) => {
    setIsSavingAccess(true);
    setModalError(null);
    try {
      await saveUserAccessChanges(input);
      await refresh();
      handleCloseModal();
    } catch (err) {
      console.error('[AccessAdmin] Failed to save user access', err);
      setModalError(err instanceof Error ? err.message : 'Failed to save access changes');
    } finally {
      setIsSavingAccess(false);
    }
  };

  const handleCreateInvite = async (payload: {
    email: string;
    firstName: string;
    lastName: string;
    apps: string[];
  }) => {
    const invitedBy = await getCurrentBohUserId();
    if (!invitedBy) {
      throw new Error('Unable to determine current BOH user. Please sign in again.');
    }

    await createInvite({
      email: payload.email,
      invited_by: invitedBy,
      apps: payload.apps,
      app_context: 'boh',
      first_name: payload.firstName,
      last_name: payload.lastName,
    });
  };

  const handleResendInvite = async (inviteId: string) => {
    await resendInvite(inviteId);
  };

  const handleManualAcceptInvite = async (inviteId: string) => {
    await manualAcceptInvite(inviteId);
  };

  const isSnapshotLoading = isLoading || (!snapshot && !error);

  return (
    <section id="team-access-section" className="main-section active">
      <div className="team-access-content">
        <div className="tabs-container" style={{ marginTop: '1.5rem' }}>
          <div className="tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
            {tabConfig.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderBottom: activeTab === tab.key ? '2px solid var(--accent-color, #7C3AED)' : '2px solid transparent',
                  fontWeight: activeTab === tab.key ? 600 : 500,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          {activeTab === 'apps' && <AppsAccessPage />}
          {activeTab === 'crew' && (
            <CrewAccessPage
              users={users}
              conflicts={conflicts}
              isLoading={isSnapshotLoading}
              error={error}
              onEditUser={handleEditUser}
            />
          )}
          {activeTab === 'invites' && (
            <TeamInvitesPage
              invites={invites}
              apps={apps}
              isLoading={isSnapshotLoading}
              error={error}
              onCreateInvite={handleCreateInvite}
              onResendInvite={handleResendInvite}
              onManualAcceptInvite={handleManualAcceptInvite}
              onRefresh={refresh}
            />
          )}
        </div>
      </div>

      <ManageAccessModal
        isOpen={isModalOpen}
        user={editingUser}
        apps={apps}
        roles={roles}
        isSaving={isSavingAccess}
        error={modalError}
        onClose={handleCloseModal}
        onSave={handleSaveAccess}
      />
    </section>
  );
};

export default TeamAccessPage;

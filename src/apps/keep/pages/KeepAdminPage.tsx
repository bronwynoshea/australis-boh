import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { ShieldIcon, UsersIcon, FolderOpenIcon, PlusIcon, Trash2Icon } from '../components/Icons';
import { useKeepAdmin } from '../hooks/useKeepAdmin';
import { KEEP_SECTIONS } from '../constants';
import ConfirmDialog from '../components/ConfirmDialog';

export default function KeepAdminPage() {
  const { userAccess, loading, grantAccess, revokeAccess } = useKeepAdmin();
  const [activeTab, setActiveTab] = useState<'sections' | 'users'>('sections');
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [accessPendingRevoke, setAccessPendingRevoke] = useState<string | null>(null);
  const [isRevokingAccess, setIsRevokingAccess] = useState(false);

  const handleGrantAccess = async () => {
    if (!selectedUserId || !selectedSection) return;

    try {
      await grantAccess(selectedUserId, selectedSection);
      setShowGrantModal(false);
      setSelectedUserId('');
      setSelectedSection('');
    } catch (error) {
      console.error('Failed to grant access:', error);
      toast.error('Failed to grant access');
    }
  };

  const handleRevokeAccess = async (id: string) => {
    setIsRevokingAccess(true);
    try {
      await revokeAccess(id);
      setAccessPendingRevoke(null);
    } catch (error) {
      console.error('Failed to revoke access:', error);
      toast.error('Failed to revoke access');
    } finally {
      setIsRevokingAccess(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-boh-primary/10">
            <ShieldIcon className="w-6 h-6 text-boh-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">
              Keep Admin
            </h1>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
              Manage access to Drive sections
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('sections')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'sections'
                ? 'bg-boh-primary text-white'
                : 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text hover:bg-boh-surface dark:hover:bg-boh-bg'
            }`}
          >
            <FolderOpenIcon className="w-4 h-4 inline mr-2" />
            Section Access
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-boh-primary text-white'
                : 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text hover:bg-boh-surface dark:hover:bg-boh-bg'
            }`}
          >
            <UsersIcon className="w-4 h-4 inline mr-2" />
            User Overrides
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'sections' && (
          <div className="space-y-4">
            <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-boh-bg-light dark:bg-boh-bg">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                      Section
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                      Access Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-boh-border-light dark:divide-boh-border">
                  {KEEP_SECTIONS.map((section) => (
                    <tr key={section.slug}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-boh-text-light dark:text-boh-text">
                          {section.label}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          Section Admins
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                        Accessible to users with admin role for this section
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Note:</strong> Section access is controlled by BOH app permissions. Users with admin access to an app can access that app's Drive section.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                Grant individual users access to specific sections
              </p>
              <button
                onClick={() => setShowGrantModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Grant Access
              </button>
            </div>

            <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-boh-text-sub-light dark:text-boh-text-sub">
                  Loading...
                </div>
              ) : userAccess.length === 0 ? (
                <div className="p-8 text-center text-boh-text-sub-light dark:text-boh-text-sub">
                  No user access overrides configured
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-boh-bg-light dark:bg-boh-bg">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                        User ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                        Section
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                        Granted
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-boh-text-sub-light dark:text-boh-text-sub uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-boh-border-light dark:divide-boh-border">
                    {userAccess.map((access) => (
                      <tr key={access.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-boh-text-light dark:text-boh-text">
                          {access.user_id.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                            {access.section_slug}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          {new Date(access.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => setAccessPendingRevoke(access.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                          >
                            <Trash2Icon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {showGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-boh-surface-light dark:bg-boh-surface rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-boh-text-light dark:text-boh-text mb-4">
              Grant User Access
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  placeholder="Enter BOH user ID"
                  className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text mb-2">
                  Section
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-boh-border-light dark:border-boh-border bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text"
                >
                  <option value="">Select a section</option>
                  {KEEP_SECTIONS.map((section) => (
                    <option key={section.slug} value={section.slug}>
                      {section.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGrantModal(false)}
                className="flex-1 px-4 py-2 border border-boh-border-light dark:border-boh-border rounded-lg hover:bg-boh-bg-light dark:hover:bg-boh-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGrantAccess}
                disabled={!selectedUserId || !selectedSection}
                className="flex-1 px-4 py-2 bg-boh-primary text-white rounded-lg hover:bg-boh-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Grant Access
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!accessPendingRevoke}
        title="Revoke access?"
        body="This will remove this Keep access override. The user may still keep access if they have it through their BOH app permissions."
        confirmLabel="Revoke access"
        confirmingLabel="Revoking..."
        isConfirming={isRevokingAccess}
        onCancel={() => {
          if (isRevokingAccess) return;
          setAccessPendingRevoke(null);
        }}
        onConfirm={() => {
          if (accessPendingRevoke) {
            handleRevokeAccess(accessPendingRevoke);
          }
        }}
      />
    </div>
  );
}

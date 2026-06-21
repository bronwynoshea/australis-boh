import React, { useState, useEffect } from 'react';
import { useCurrentTheme } from '../../../../shared/hooks/useCurrentTheme';
import { fetchReleaseVersions, createReleaseVersion, updateReleaseVersion } from '../api/counterTicketsApi';
import type { ReleaseVersion } from '../types';
import { PlusCircleIcon } from '../components/Icons';

interface SettingsPageProps {
  // Theme is now detected automatically from document.documentElement.classList
  theme?: never;
  toggleTheme?: never;
}

const SettingsPage: React.FC<SettingsPageProps> = () => {
  const theme = useCurrentTheme();
  
  // Release Management State
  const [releases, setReleases] = useState<ReleaseVersion[]>([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);
  const [isCreatingRelease, setIsCreatingRelease] = useState(false);
  const [newVersionLabel, setNewVersionLabel] = useState('');
  const [newVersionNumber, setNewVersionNumber] = useState('');
  const [newReleaseDate, setNewReleaseDate] = useState('');

  useEffect(() => {
    loadReleases();
  }, []);

  const loadReleases = async () => {
    setIsLoadingReleases(true);
    try {
      const data = await fetchReleaseVersions();
      setReleases(data);
    } catch (err) {
      console.error('Failed to load release versions', err);
    } finally {
      setIsLoadingReleases(false);
    }
  };

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionLabel.trim()) return;

    try {
      await createReleaseVersion(
        newVersionLabel.trim(), 
        newVersionNumber.trim() || undefined, 
        newReleaseDate || undefined
      );
      setNewVersionLabel('');
      setNewVersionNumber('');
      setNewReleaseDate('');
      setIsCreatingRelease(false);
      loadReleases();
    } catch (err) {
      console.error('Failed to create release', err);
    }
  };

  const handleToggleStatus = async (release: ReleaseVersion) => {
    try {
      // Toggle is_active boolean
      const newActiveState = !release.is_active;
      await updateReleaseVersion(release.id, { is_active: newActiveState });
      loadReleases();
    } catch (err) {
      console.error('Failed to update release status', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-boh-bg-light dark:bg-boh-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="space-y-1 mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-boh-text-light dark:text-boh-text">
            Settings
          </h1>
          <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
            Personalise your Counter experience.
          </p>
        </header>

        <section className="space-y-6">
          {/* Theme Settings */}
          <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-1">
              Theme
            </h2>
            <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub mb-4">
              Choose how Counter looks on this device.
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-boh-text-light dark:text-boh-text">
                  {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </p>
                <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub mt-1">
                  Theme is synced with Cafe. Change it in Cafe settings.
                </p>
              </div>
              <div className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                Synced with Cafe
              </div>
            </div>
          </div>

          {/* Release Version Management */}
          <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-boh-text-light dark:text-boh-text mb-1">
                  Release Versions
                </h2>
                <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                  Manage software release versions available for ticket assignment.
                </p>
              </div>
              <button
                onClick={() => setIsCreatingRelease(!isCreatingRelease)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-boh-primary hover:bg-boh-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-boh-primary"
              >
                <PlusCircleIcon className="w-4 h-4 mr-1.5" />
                New Version
              </button>
            </div>

            {isCreatingRelease && (
              <form onSubmit={handleCreateRelease} className="mb-6 p-4 bg-boh-bg-light dark:bg-boh-surface rounded-lg border border-boh-border-light dark:border-boh-border dark:border-boh-border-light dark:border-boh-border">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="label" className="block text-xs font-medium text-boh-text-light dark:text-boh-text-sub">
                      Version Name / Label
                    </label>
                    <input
                      type="text"
                      name="label"
                      id="label"
                      required
                      placeholder="e.g. Winter Update"
                      value={newVersionLabel}
                      onChange={(e) => setNewVersionLabel(e.target.value)}
                      className="mt-1 block w-full rounded-md border-boh-border-light dark:border-boh-border shadow-sm focus:border-boh-primary focus:ring-boh-primary sm:text-sm dark:bg-boh-surface dark:border-boh-border-light dark:border-boh-border dark:text-boh-text px-3 py-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="version" className="block text-xs font-medium text-boh-text-light dark:text-boh-text-sub">
                      Version Number (Optional)
                    </label>
                    <input
                      type="text"
                      name="version"
                      id="version"
                      placeholder="e.g. v2.4.0"
                      value={newVersionNumber}
                      onChange={(e) => setNewVersionNumber(e.target.value)}
                      className="mt-1 block w-full rounded-md border-boh-border-light dark:border-boh-border shadow-sm focus:border-boh-primary focus:ring-boh-primary sm:text-sm dark:bg-boh-surface dark:border-boh-border-light dark:border-boh-border dark:text-boh-text px-3 py-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="date" className="block text-xs font-medium text-boh-text-light dark:text-boh-text-sub">
                      Release Date (Optional)
                    </label>
                    <input
                      type="date"
                      name="date"
                      id="date"
                      value={newReleaseDate}
                      onChange={(e) => setNewReleaseDate(e.target.value)}
                      className="mt-1 block w-full rounded-md border-boh-border-light dark:border-boh-border shadow-sm focus:border-boh-primary focus:ring-boh-primary sm:text-sm dark:bg-boh-surface dark:border-boh-border-light dark:border-boh-border dark:text-boh-text px-3 py-2"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsCreatingRelease(false)}
                    className="inline-flex justify-center py-2 px-4 border border-boh-border-light dark:border-boh-border shadow-sm text-sm font-medium rounded-md text-boh-text-light dark:text-boh-text bg-boh-surface-light dark:bg-boh-surface focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-boh-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-boh-primary hover:bg-boh-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-boh-primary"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-boh-border-light dark:divide-boh-border">
                <thead className="bg-boh-bg-light dark:bg-boh-surface">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-xs font-semibold text-boh-text-light dark:text-boh-text sm:pl-6">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-boh-text-light dark:text-boh-text">
                      Number
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-boh-text-light dark:text-boh-text">
                      Release Date
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-semibold text-boh-text-light dark:text-boh-text">
                      Status
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-boh-border-light dark:divide-boh-border bg-boh-surface-light dark:bg-boh-surface">
                  {isLoadingReleases ? (
                     <tr>
                       <td colSpan={5} className="py-4 text-center text-sm text-boh-text-sub-light dark:text-boh-text-sub">Loading...</td>
                     </tr>
                  ) : releases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-sm text-boh-text-sub-light dark:text-boh-text-sub">No release versions found.</td>
                    </tr>
                  ) : (
                    releases.map((release) => (
                      <tr key={release.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-boh-text-light dark:text-boh-text sm:pl-6">
                          {release.version_label}
                        </td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          {release.version_number || '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          {release.release_date ? new Date(release.release_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-boh-text-sub-light dark:text-boh-text-sub">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            release.is_active 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-boh-text-sub' 
                              : 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text dark:bg-boh-surface dark:text-boh-text-sub'
                          }`}>
                            {release.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => handleToggleStatus(release)}
                            className="text-boh-primary hover:text-boh-primary-dark dark:text-boh-primary-light dark:hover:text-boh-primary"
                          >
                            {release.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;


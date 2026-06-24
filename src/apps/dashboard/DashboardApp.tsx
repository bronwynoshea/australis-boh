import React, { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BOHShell, DefaultIcons } from '../../boh/navigation';
import { bohApps as appRegistry } from '../../boh/navigation/appConfigs';
import type { BohAppDefinition } from '../../boh/navigation/types';
import { useBohAccess } from '../../shared/hooks/useBohAccess';
import DashboardPage from '../boh/pages/DashboardPage';
import TeamAccessPage from '../boh/pages/TeamAccessPage';
import BohSettingsProfilePage from '../boh/pages/BohSettingsProfilePage';

interface DashboardAppProps {
  isAdmin?: boolean;
}

// Desktop page header for Dashboard
const DashboardPageHeader: React.FC = () => (
  <div className="hidden lg:block mb-6">
    <div>
      <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">Home</p>
      <h1 className="text-3xl font-semibold text-boh-text-light dark:text-boh-text">BOH Dashboard</h1>
      <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">Overview and quick access</p>
    </div>
  </div>
);

const DashboardApp: React.FC<DashboardAppProps> = ({ isAdmin = false }) => {
  const access = useBohAccess();
  const shellApps = useMemo<BohAppDefinition[]>(() => {
    const registryBySlug = new Map(appRegistry.map((app) => [app.slug, app]));

    return access.appsWithAccess
      .filter((app) => app.slug && app.slug !== 'boh')
      .filter((app) => {
        const hasGrant = app.boh_user_app?.length > 0;
        return access.isSuperAdmin || hasGrant || app.tenant_app_status === 'coming_soon';
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((app) => {
        const registryApp = registryBySlug.get(app.slug);
        const isWorkspaceLink = app.app_kind === 'external';
        const isComingSoon = app.tenant_app_status === 'coming_soon';

        return {
          id: app.slug,
          slug: app.slug,
          name: app.name,
          route: isComingSoon ? '' : (app.route || registryApp?.route || ''),
          icon: registryApp?.icon || DefaultIcons.Generic,
          navConfig: registryApp?.navConfig,
          isExternal: isWorkspaceLink,
          externalUrl: isComingSoon ? undefined : (app.external_url || registryApp?.externalUrl),
          category: isWorkspaceLink ? 'customer' : 'internal',
          disabled: isComingSoon,
        } satisfies BohAppDefinition;
      });
  }, [access.appsWithAccess, access.isSuperAdmin]);

  return (
    <BOHShell apps={shellApps} isAdmin={isAdmin || access.isSuperAdmin} isDashboardMode={true}>
      <Routes>
        <Route path="/" element={<DashboardPage appsWithAccess={access.appsWithAccess} isLoadingApps={access.isLoading} isSuperAdmin={access.isSuperAdmin} />} />
        <Route path="access" element={<TeamAccessPage />} />
        <Route path="settings" element={<BohSettingsProfilePage />} />
        <Route path="*" element={<Navigate to="/boh" replace />} />
      </Routes>
    </BOHShell>
  );
};

export default DashboardApp;

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../../../components/ThemeToggle';
import type { Theme } from '../../../types';
import { useBohAccess } from '../../../shared/hooks/useBohAccess';
import { useCurrentTheme } from '../../../shared/hooks/useCurrentTheme';

interface DashboardPageProps {
  onRequestAccess?: (app: string) => void;
  onApproveAll?: () => void;
  theme?: Theme;
  onThemeToggle?: () => void;
  appsWithAccess?: any[];
  isLoadingApps?: boolean;
  onNavigate?: (section: string) => void;
  isSuperAdmin?: boolean;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  onRequestAccess: onRequestAccessProp,
  theme: themeProp,
  onThemeToggle: onThemeToggleProp,
  appsWithAccess: appsWithAccessProp,
  isLoadingApps: isLoadingAppsProp,
  isSuperAdmin: isSuperAdminProp,
}) => {
  const navigate = useNavigate();
  const hookData = useBohAccess();
  const appsWithAccess = appsWithAccessProp ?? hookData.appsWithAccess;
  const isLoadingApps = isLoadingAppsProp ?? hookData.isLoading;
  const isSuperAdmin = isSuperAdminProp ?? hookData.isSuperAdmin;
  const accessError = hookData.error;
  const workspaceName = hookData.bohUser?.tenant?.name?.trim() || 'Back of House';
  const detectedTheme = useCurrentTheme();
  const theme = themeProp ?? detectedTheme;

  const handleThemeToggle = () => {
    if (onThemeToggleProp) {
      onThemeToggleProp();
      return;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    import('../../../lib/bohAuth').then(({ setBohTheme }) => {
      setBohTheme(newTheme);
    });
  };

  const onRequestAccess = onRequestAccessProp ?? (() => {});
  const isComingSoon = (app: any) => app.tenant_app_status === 'coming_soon';
  const getAppGrant = (app: any) => app.boh_user_app?.[0] ?? null;

  const userHasAccess = (app: any): boolean => {
    if (isSuperAdmin) return true;

    const userApp = getAppGrant(app);
    if (!userApp) return false;
    if (typeof userApp.access_granted === 'boolean') return userApp.access_granted;

    return true;
  };

  const visibleApps = useMemo(() => {
    const appsBySlug = new Map<string, any>();

    (appsWithAccess ?? []).forEach((app) => {
      if (app.slug && app.slug !== 'boh') {
        appsBySlug.set(app.slug, app);
      }
    });

    return Array.from(appsBySlug.values());
  }, [appsWithAccess]);

  const accessibleApps = useMemo(
    () => visibleApps.filter(userHasAccess).sort((a, b) => a.name.localeCompare(b.name)),
    [visibleApps, isSuperAdmin],
  );

  const dashboardApps = accessibleApps;

  const groupedDashboardApps = useMemo(() => {
    const groups = {
      suite: [] as any[],
      links: [] as any[],
    };

    dashboardApps.forEach((app) => {
      if (app.app_kind === 'external' || app.type === 'external_app') {
        groups.links.push(app);
      } else {
        groups.suite.push(app);
      }
    });

    groups.suite.sort((a, b) => a.name.localeCompare(b.name));
    groups.links.sort((a, b) => a.name.localeCompare(b.name));

    return groups;
  }, [dashboardApps]);

  const handleAppClick = (app: any) => {
    if (isComingSoon(app)) return;

    if (!userHasAccess(app)) {
      onRequestAccess(app.slug);
      return;
    }

    const externalUrl = app.app_kind === 'external' || app.type === 'external_app'
      ? app.external_url
      : '';
    if (externalUrl) {
      navigate(`/boh/external/${app.slug}`);
      return;
    }

    if (app.route) {
      navigate(app.route);
      return;
    }
  };

  const formatDescription = (app: any) => {
    const text = app.description || '';
    const trimmed = text.trim();
    if (!trimmed) return '';
    return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
  };

  const renderAppCard = (app: any) => {
    const hasAccess = userHasAccess(app);
    const comingSoon = isComingSoon(app);
    const isExternal = app.app_kind === 'external' || app.type === 'external_app';
    const buttonLabel = comingSoon ? 'Planned' : hasAccess ? (isExternal ? 'Launch' : 'Open') : 'Request access';
    const buttonClass = comingSoon ? 'card-button btn-disabled' : 'card-button btn-primary';

    return (
      <div key={app.id} className="boh-workspace-app-tile">
        <div className="boh-workspace-app-title-row">
          <div className="title">{app.name}</div>
        </div>
        <div className="subtitle">{formatDescription(app)}</div>
        <div className="card-footer">
          <span aria-hidden="true" />
          <button
            type="button"
            className={buttonClass}
            onClick={() => handleAppClick(app)}
            disabled={comingSoon}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    );
  };

  const renderAppSection = (title: string, eyebrow: string, apps: any[]) => (
    <section className="boh-workspace-panel" aria-labelledby={`boh-dashboard-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="boh-workspace-section-kicker">
        <div>
          <p>{eyebrow}</p>
          <h2 id={`boh-dashboard-${title.toLowerCase().replace(/\s+/g, '-')}`}>{title}</h2>
        </div>
        <span>{apps.length}</span>
      </div>
      <div className="boh-workspace-app-grid">{apps.map(renderAppCard)}</div>
    </section>
  );

  return (
    <section id="dashboard-section" className="main-section active">
      <header className="main-header">
        <h1>Welcome to {workspaceName} Back of House</h1>
        <p>Your command center for {workspaceName} operations.</p>
        <ThemeToggle theme={theme} onToggle={handleThemeToggle} />
      </header>

      <div className="dashboard-content">
        <div className="boh-workspace-dashboard">
          {isLoadingApps ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {dashboardApps.length > 0 && (
                <div className="boh-workspace-columns">
                  {groupedDashboardApps.suite.length > 0 && renderAppSection('Internal apps', 'Workspace tools', groupedDashboardApps.suite)}
                  {groupedDashboardApps.links.length > 0 && renderAppSection('External links', 'Connected surfaces', groupedDashboardApps.links)}
                </div>
              )}
              {dashboardApps.length === 0 && (
                <div className="boh-workspace-empty">
                  <h3>App access did not load.</h3>
                  <p>
                    {accessError
                      ? `Access check: ${accessError}`
                      : 'No apps are available for the current workspace.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default DashboardPage;

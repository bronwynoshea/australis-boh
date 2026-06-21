import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../../../components/ThemeToggle';
import type { Theme } from '../../../types';
import { useBohAccess } from '../../../shared/hooks/useBohAccess';
import { useCurrentTheme } from '../../../shared/hooks/useCurrentTheme';
import { bohApps } from '../../../boh/navigation';

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

const customerSlugs = new Set(['studio', 'talent', 'dna', 'website']);
const hybridSlugs = new Set(['chatz', 'slotz']);
const hiddenDuplicateSlugs = new Set(['cafe', 'coach', 'journey', 'mentor']);
const customerSortPriority: Record<string, number> = {
  studio: 0,
  talent: 1,
};
const comingSoonSlugs = new Set(['central-command']);
const comingSoonNames = new Set(['Central Command']);

const getExternalAppUrl = (prodUrl: string, devUrl: string) => {
  const hostname = window.location.hostname;
  const isDev =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === 'dev-boh.jobzcafe.com' ||
    hostname === 'boh.australis.cloud';

  return isDev ? devUrl : prodUrl;
};

const externalUrlBySlug: Record<string, string> = {
  studio: getExternalAppUrl('https://app.jobzcafe.com', 'https://dev-app.jobzcafe.com'),
  talent: getExternalAppUrl('https://talent.jobzcafe.com', 'https://dev-talent.jobzcafe.com'),
};

const fallbackDescriptions: Record<string, string> = {
  cellar: 'Stock, inventory, and operational storage.',
  central: 'AI command workspace and assisted execution.',
  'central-command': 'AI command workspace and assisted execution.',
  chatz: 'Messaging for internal and connected app conversations.',
  forge: 'Delivery workstreams, submitted initiatives, and build readiness.',
  ledger: 'Finance, reporting, and internal records.',
  loft: 'Meetings, rooms, and video collaboration.',
  menu: 'Initiatives, user stories, and planning stages.',
  slotz: 'Calendar scheduling and appointment slots.',
  studio: 'Career Studio customer workspace.',
  journey: 'Job seeker journey workspace.',
  coach: 'Guided coaching and next-step support.',
  mentor: 'Mentor matching and support workflows.',
  tablez: 'Sections, tables, chairs, and task execution.',
  talent: 'Talent marketplace and recruiter workflows.',
  website: 'Public Jobs Cafe website.',
};

const localBohRoutesBySlug = new Map([
  ...bohApps
    .filter((app) =>
      [
        'cellar',
        'central',
        'cookbook',
        'counter',
        'crew',
        'forge',
        'keep',
        'ledger',
        'loft',
        'menu',
        'patron',
        'chatz',
        'slotz',
        'tablez',
      ].includes(app.slug),
    )
    .map((app) => [app.slug, app.route] as const),
  ['website', '/website'] as const,
]);

const normalizeStaticApp = (app: (typeof bohApps)[number]) => ({
  id: app.id,
  name: app.name,
  slug: app.slug,
  description: fallbackDescriptions[app.slug] ?? '',
  route: app.route,
  external_url: app.externalUrl ?? '',
  type: app.isExternal ? 'external_app' : 'internal_tool',
  is_active: true,
  boh_user_app: [{ permission_level: 'admin' as const }],
  is_static_fallback: true,
});

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
  const isComingSoon = (app: any) => comingSoonSlugs.has(app.slug) || comingSoonNames.has(app.name);
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
      if (app.slug && app.slug !== 'boh' && !hiddenDuplicateSlugs.has(app.slug)) {
        appsBySlug.set(app.slug, app);
      }
    });

    if (isSuperAdmin) {
      bohApps.forEach((app) => {
        if (app.slug !== 'boh' && !appsBySlug.has(app.slug)) {
          appsBySlug.set(app.slug, normalizeStaticApp(app));
        }
      });
    }

    return Array.from(appsBySlug.values());
  }, [appsWithAccess, isSuperAdmin]);

  const accessibleApps = useMemo(
    () => visibleApps.filter(userHasAccess).sort((a, b) => a.name.localeCompare(b.name)),
    [visibleApps, isSuperAdmin],
  );

  const dashboardApps = accessibleApps;

  const groupedDashboardApps = useMemo(() => {
    const groups = {
      internal: [] as any[],
      hybrid: [] as any[],
      customer: [] as any[],
    };

    dashboardApps.forEach((app) => {
      if (customerSlugs.has(app.slug)) {
        groups.customer.push(app);
      } else if (hybridSlugs.has(app.slug)) {
        groups.hybrid.push(app);
      } else {
        groups.internal.push(app);
      }
    });

    groups.customer.sort((a, b) => {
      const aPriority = customerSortPriority[a.slug] ?? 10;
      const bPriority = customerSortPriority[b.slug] ?? 10;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.name.localeCompare(b.name);
    });

    return groups;
  }, [dashboardApps]);

  const handleAppClick = (app: any) => {
    if (isComingSoon(app)) return;

    if (!userHasAccess(app)) {
      onRequestAccess(app.slug);
      return;
    }

    const localRoute = localBohRoutesBySlug.get(app.slug);
    if (localRoute) {
      navigate(localRoute);
      return;
    }

    if (app.route && !app.external_url) {
      navigate(app.route);
      return;
    }

    const externalUrl = externalUrlBySlug[app.slug] || app.external_url;
    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    navigate(app.route || `/boh/${app.slug}`);
  };

  const formatDescription = (app: any) => {
    const text = app.description || fallbackDescriptions[app.slug] || '';
    const trimmed = text.trim();
    if (!trimmed) return '';
    return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
  };

  const renderAppCard = (app: any) => {
    const hasAccess = userHasAccess(app);
    const comingSoon = isComingSoon(app);
    const buttonLabel = comingSoon ? 'Planned' : hasAccess ? 'Open' : 'Request access';
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

  const renderGroup = (title: string, description: string, apps: any[]) => (
    <section className="boh-workspace-panel">
      <div className="boh-workspace-panel-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {apps.length > 0 ? (
        <div className="boh-workspace-app-grid">{apps.map(renderAppCard)}</div>
      ) : (
        <div className="boh-workspace-empty compact">
          <p>No apps in this group for this view.</p>
        </div>
      )}
    </section>
  );

  return (
    <section id="dashboard-section" className="main-section active">
      <header className="main-header">
        <h1>Welcome to Back of House</h1>
        <p>Your internal command center for JOBZ CAFE operations.</p>
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
              <div className="boh-workspace-columns">
                {renderGroup('Internal Apps', 'Employee-facing BOH tools.', groupedDashboardApps.internal)}
                {renderGroup('Customer Apps', 'Top-level customer platforms.', groupedDashboardApps.customer)}
                {renderGroup('Hybrid Apps', 'Mixed internal and customer platforms.', groupedDashboardApps.hybrid)}
              </div>
              {dashboardApps.length === 0 && (
                <div className="boh-workspace-empty">
                  <h3>App access did not load.</h3>
                  <p>
                    {accessError
                      ? `Access check: ${accessError}`
                      : 'Access check returned no app rows for the current BOH session.'}
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

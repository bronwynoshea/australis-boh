import React from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import type { Theme } from '../types';

interface DashboardPageProps {
  onRequestAccess: (app: string) => void;
  onApproveAll: () => void;
  theme: Theme;
  onThemeToggle: () => void;
  appsWithAccess?: any[];
  isLoadingApps?: boolean;
  onNavigate?: (section: string) => void;
  isSuperAdmin?: boolean;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ 
  onRequestAccess, 
  onApproveAll,
  theme,
  onThemeToggle,
  appsWithAccess,
  isLoadingApps = false,
  onNavigate,
  isSuperAdmin = false
}) => {
  const navigate = useNavigate();

  const showSkeleton = isLoadingApps;

  const customerSlugs = new Set(['studio', 'talent', 'dna']);
  const hybridSlugs = new Set(['loft', 'chatz']);

  const comingSoonSlugs = new Set(['central-command']);
  const comingSoonNames = new Set(['Central Command']);

  const isComingSoon = (app: any) => comingSoonSlugs.has(app.slug) || comingSoonNames.has(app.name);

  const groupedApps = {
    internal: [] as any[],
    customer: [] as any[],
    hybrid: [] as any[],
  };

  (appsWithAccess ?? []).forEach((app) => {
    if (customerSlugs.has(app.slug)) {
      groupedApps.customer.push(app);
    } else if (hybridSlugs.has(app.slug)) {
      groupedApps.hybrid.push(app);
    } else if (app.type === 'internal_tool') {
      groupedApps.internal.push(app);
    }
  });

  const sortedInternalApps = groupedApps.internal.sort((a, b) => a.name.localeCompare(b.name));
  const sortedCustomerApps = groupedApps.customer.sort((a, b) => a.name.localeCompare(b.name));
  const sortedHybridApps = groupedApps.hybrid.sort((a, b) => a.name.localeCompare(b.name));

  const userHasAccess = (app: any): boolean => {
    if (isSuperAdmin) {
      return true;
    }

    const userApp = app.boh_user_app?.[0] ?? null;
    if (!userApp) {
      return false;
    }

    if (typeof userApp.access_granted === 'boolean') {
      return userApp.access_granted;
    }

    return true;
  };

  const handleAppClick = (app: any) => {
    const comingSoon = isComingSoon(app);
    if (comingSoon) {
      return;
    }

    const hasAccess = userHasAccess(app);
    if (!hasAccess) {
      onRequestAccess(app.slug);
      return;
    }

    if (app.external_url) {
      window.open(app.external_url, '_blank', 'noopener,noreferrer');
      return;
    }

    const internalTarget = app.route || `/boh/${app.slug}`;
    if (internalTarget) {
      navigate(internalTarget);
    }
  };

  const cardBaseClass = 'app-card flex flex-col w-full max-w-[220px] 2xl:max-w-[190px]';

  const shortenTitle = (name: string) => (name === 'Central Command' ? 'Central' : name);

  const formatDescription = (text: string | null | undefined) => {
    if (!text) return '';
    const trimmed = text.trim();
    if (!trimmed) return '';
    return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
  };

  const renderAppCard = (app: any) => {
    const hasAccess = userHasAccess(app);
    const comingSoon = isComingSoon(app);
    const buttonLabel = comingSoon ? 'Q2' : hasAccess ? 'Open' : 'Request access';
    const buttonDisabled = comingSoon;
    const buttonClass = comingSoon ? 'card-button btn-disabled' : 'card-button btn-primary';

    return (
      <div key={app.id} className={cardBaseClass}>
        <div className="card-header flex-1 min-h-[110px]">
          <div>
            <div className="title">{shortenTitle(app.name)}</div>
            <div className="subtitle">{formatDescription(app.description)}</div>
          </div>
        </div>
        <div className="card-footer mt-auto">
          <button
            type="button"
            className={buttonClass}
            onClick={() => !buttonDisabled && handleAppClick(app)}
            disabled={buttonDisabled}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    );
  };

  return (
    <section id="dashboard-section" className="main-section active">
      <header className="main-header">
        <h1>Welcome to Back of House</h1>
        <p>Your internal command center for JOBZ CAFE® operations.</p>
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
      </header>
      <div className="dashboard-content">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] 2xl:grid-cols-[minmax(0,3.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-6">
          {showSkeleton ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <div>
                <div className="mb-4">
                  <h2 className="text-boh-text-light dark:text-boh-text-sub">Internal Apps</h2>
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Employee-facing BOH tools</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 justify-items-start items-stretch">
                  {sortedInternalApps.map(renderAppCard)}
                </div>
              </div>

              <div>
                <div className="mb-4">
                  <h2 className="text-boh-text-light dark:text-boh-text-sub">Customer Apps</h2>
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Top-level customer platforms</p>
                </div>
                <div className="grid grid-cols-1 gap-4 justify-items-start items-stretch">
                  {sortedCustomerApps.map(renderAppCard)}
                </div>
              </div>

              <div>
                <div className="mb-4">
                  <h2 className="text-boh-text-light dark:text-boh-text-sub">Hybrid Apps</h2>
                  <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Mixed internal/customer platforms</p>
                </div>
                <div className="grid grid-cols-1 gap-4 justify-items-start items-stretch">
                  {sortedHybridApps.map(renderAppCard)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default DashboardPage;

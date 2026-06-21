import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { BOHShell, bohApps } from '../../../boh/navigation';
import MenuDashboard from './pages/MenuDashboard.tsx';
import MenuBoardView from './pages/MenuBoardView.tsx';
import MenuTimelineView from './pages/MenuTimelineView.tsx';
import MenuArchiveView from './pages/MenuArchiveView.tsx';
import MenuInitiativeDetail from './pages/MenuInitiativeDetail.tsx';
import MenuInitiativeForm from './pages/MenuInitiativeForm.tsx';
import MenuReportsPage from './pages/MenuReportsPage.tsx';
import ProductReleaseReportsPage from './pages/ProductReleaseReportsPage.tsx';
import ProductOfferingPage from './pages/ProductOfferingPage.tsx';
import { MenuFiltersProvider } from './contexts/MenuFiltersContext.tsx';

interface MenuAppProps {
  isAdmin?: boolean;
}

const getMenuPageHeader = (pathname: string) => {
  if (pathname.startsWith('/menu/offering')) {
    return {
      eyebrow: 'Menu master data',
      title: 'Product Offering',
      description: 'Manage app and module classification before work moves into Forge, Counter, or product builds.',
      showNewInitiative: false,
    };
  }

  if (pathname.startsWith('/menu/board')) {
    return {
      eyebrow: 'Strategic planning',
      title: 'Pipeline',
      description: 'Move initiatives through the Menu planning workflow.',
      showNewInitiative: true,
    };
  }

  if (pathname.startsWith('/menu/timeline')) {
    return {
      eyebrow: 'Strategic planning',
      title: 'Timeline',
      description: 'Review initiative timing and delivery windows.',
      showNewInitiative: true,
    };
  }

  if (pathname.startsWith('/menu/archive')) {
    return {
      eyebrow: 'Strategic planning',
      title: 'Archive',
      description: 'Review archived Menu initiatives.',
      showNewInitiative: true,
    };
  }

  if (pathname.startsWith('/menu/reports')) {
    return {
      eyebrow: 'Strategic planning',
      title: 'Reports',
      description: 'Review Menu reporting and planning signals.',
      showNewInitiative: true,
    };
  }

  return {
    eyebrow: 'Strategic planning',
    title: 'Menu',
    description: 'Define initiatives before they enter Forge.',
    showNewInitiative: true,
  };
};

// Mobile header component for Menu
const MenuMobileHeader: React.FC = () => {
  const location = useLocation();
  const header = getMenuPageHeader(location.pathname);

  return (
  <header className="lg:hidden flex items-center justify-between p-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
    <div>
      <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">{header.eyebrow}</p>
      <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">{header.title}</h1>
      <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">{header.description}</p>
    </div>
    {header.showNewInitiative && (
      <Link
        to="/menu/initiatives/new"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-boh-primary text-white font-medium hover:bg-boh-primary-dark transition-colors shadow-sm"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-sm">New</span>
      </Link>
    )}
  </header>
  );
};

// Desktop page header for Menu
const MenuPageHeader: React.FC = () => {
  const location = useLocation();
  const header = getMenuPageHeader(location.pathname);

  return (
  <div className="hidden lg:block mb-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">{header.eyebrow}</p>
        <h1 className="text-3xl font-semibold text-boh-text-light dark:text-boh-text">{header.title}</h1>
        <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">{header.description}</p>
      </div>
      {header.showNewInitiative && (
        <Link
          to="/menu/initiatives/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-boh-primary text-white font-medium hover:bg-boh-primary-dark transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Initiative
        </Link>
      )}
    </div>
  </div>
  );
};

const MenuApp: React.FC<MenuAppProps> = ({ isAdmin = false }) => {
  return (
    <MenuFiltersProvider>
      <BOHShell apps={bohApps} isAdmin={isAdmin} mobileHeader={<MenuMobileHeader />}>
        <MenuPageHeader />
        <Routes>
          <Route index element={<Navigate to="/menu/overview" replace />} />
          <Route path="overview" element={<MenuDashboard />} />
          <Route path="dashboard" element={<Navigate to="/menu/overview" replace />} />
          <Route path="board" element={<MenuBoardView />} />
          <Route path="timeline" element={<MenuTimelineView />} />
          <Route path="archive" element={<MenuArchiveView />} />
          <Route path="offering" element={<ProductOfferingPage />} />
          <Route path="reports" element={<MenuReportsPage />} />
          <Route path="reports/:reportType" element={<MenuReportsPage />} />
          <Route path="initiatives/new" element={<MenuInitiativeForm mode="create" />} />
          <Route path="initiatives/:id" element={<MenuInitiativeDetail />} />
          <Route path="initiatives/:id/edit" element={<MenuInitiativeForm mode="edit" />} />
          <Route path="*" element={<Navigate to="/menu/overview" replace />} />
        </Routes>
      </BOHShell>
    </MenuFiltersProvider>
  );
};

export default MenuApp;

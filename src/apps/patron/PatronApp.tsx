import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { BOHShell, bohApps } from '../../boh/navigation';
import PatronDashboardPage from './pages/PatronDashboardPage';
import PatronPeoplePage from './pages/PatronPeoplePage';
import PatronOrganisationsPage from './pages/PatronOrganisationsPage';
import PatronPipelineHandoffPage from './pages/PatronPipelineHandoffPage';
import PatronPersonDetailPage from './pages/PatronPersonDetailPage';
import PatronOrganisationDetailPage from './pages/PatronOrganisationDetailPage';
import { supabase } from '../../lib/supabase';

interface PatronAppProps {}

const PatronApp: React.FC<PatronAppProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activePage, setActivePage] = useState<'dashboard' | 'people' | 'organisations' | 'pipeline'>('dashboard');

  // Update active page based on route
  useEffect(() => {
    if (location.pathname.startsWith('/patron/dashboard')) {
      setActivePage('dashboard');
    } else if (location.pathname.startsWith('/patron/people')) {
      setActivePage('people');
    } else if (location.pathname.startsWith('/patron/organisations')) {
      setActivePage('organisations');
    } else if (location.pathname.startsWith('/patron/pipeline')) {
      setActivePage('pipeline');
    }
  }, [location.pathname]);

  // Check authentication on mount and when location changes
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const authenticated = session !== null;
      setIsAuthenticated(authenticated);
      
      if (!authenticated) {
        navigate('/boh/login');
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authenticated = session !== null;
      setIsAuthenticated(authenticated);
      
      if (!authenticated) {
        navigate('/boh/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Show nothing while checking authentication
  if (isAuthenticated === null) {
    return null;
  }

  // If not authenticated, the useEffect will redirect, but show nothing in the meantime
  if (!isAuthenticated) {
    return null;
  }

  const navigateTo = (page: 'dashboard' | 'people' | 'organisations' | 'pipeline') => {
    const routeMap: Record<'dashboard' | 'people' | 'organisations' | 'pipeline', string> = {
      'dashboard': '/patron/dashboard',
      'people': '/patron/people',
      'organisations': '/patron/organisations',
      'pipeline': '/patron/pipeline',
    };
    navigate(routeMap[page] || '/patron/dashboard');
  };

  // Mobile header component for Patron
  const PatronMobileHeader: React.FC = () => (
    <header className="lg:hidden flex items-center justify-between p-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
      <div>
        <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">CRM</p>
        <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Patron</h1>
        <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">People and organisations</p>
      </div>
    </header>
  );

  // Desktop page header for Patron
  const PatronPageHeader: React.FC = () => (
    <div className="hidden lg:block mb-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">CRM</p>
        <h1 className="text-3xl font-semibold text-boh-text-light dark:text-boh-text">Patron</h1>
        <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">People and organisations</p>
      </div>
    </div>
  );

  return (
    <BOHShell apps={bohApps} isAdmin={false} mobileHeader={<PatronMobileHeader />}>
      <PatronPageHeader />
      <Routes>
        <Route path="/" element={<Navigate to="/patron/dashboard" replace />} />
        <Route path="dashboard" element={<PatronDashboardPage />} />
        <Route path="people" element={<PatronPeoplePage />} />
        <Route path="people/:personId" element={<PatronPersonDetailPage />} />
        <Route path="organisations" element={<PatronOrganisationsPage />} />
        <Route path="organisations/:organisationId" element={<PatronOrganisationDetailPage />} />
        <Route path="pipeline" element={<PatronPipelineHandoffPage />} />
        <Route path="*" element={<Navigate to="/patron/dashboard" replace />} />
      </Routes>
    </BOHShell>
  );
};

export default PatronApp;


import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { BOHShell, bohApps } from '../../boh/navigation';
import TablezBottomNav from './layouts/TablezBottomNav';
import TablezBoardPage from './pages/TablezBoardPage';
import TablezTodayPage from './pages/TablezTodayPage';
import TablezProjectsPage from './pages/TablezProjectsPage';
import { supabase } from '../../lib/supabase';

interface TablezAppProps {
  isAdmin?: boolean;
}

const TablezApp: React.FC<TablezAppProps> = ({ isAdmin = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [activePage, setActivePage] = useState<'Board' | 'Today'>('Board');

  // Update active page based on route
  useEffect(() => {
    if (location.pathname === '/tablez/today' || location.pathname.endsWith('/today')) {
      setActivePage('Today');
    } else {
      setActivePage('Board');
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

  const navigateTo = (page: 'Board' | 'Today') => {
    const routeMap: Record<'Board' | 'Today', string> = {
      Board: '/tablez/dashboard',
      Today: '/tablez/today',
    };
    navigate(routeMap[page] || '/tablez/dashboard');
  };

  // Mobile header component for Tablez
  const TablezMobileHeader: React.FC = () => (
    <header className="lg:hidden flex items-center justify-between p-4 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
      <div>
        <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub">Planning</p>
        <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Tablez</h1>
        <p className="text-sm text-boh-text-sub-light dark:text-boh-text-sub">Task and project management</p>
      </div>
    </header>
  );

  // Desktop page header for Tablez
  const TablezPageHeader: React.FC = () => (
    <div className="hidden lg:block mb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-boh-text-sub-light dark:text-boh-text-sub mb-1">Planning</p>
          <h1 className="text-3xl font-semibold text-boh-text-light dark:text-boh-text">Tablez</h1>
          <p className="text-boh-text-sub-light dark:text-boh-text-sub mt-1">Task and project management</p>
        </div>
      </div>
    </div>
  );

  return (
    <BOHShell apps={bohApps} isAdmin={isAdmin} mobileHeader={<TablezMobileHeader />}>
      <TablezPageHeader />
      <Routes>
        <Route path="/" element={<Navigate to="/tablez/dashboard" replace />} />
        <Route path="/dashboard" element={<TablezBoardPage />} />
        <Route path="/today" element={<TablezTodayPage />} />
        <Route path="/projects" element={<TablezProjectsPage />} />
        <Route path="*" element={<Navigate to="/tablez/dashboard" replace />} />
      </Routes>
      <TablezBottomNav activePage={activePage} setActivePage={navigateTo} />
    </BOHShell>
  );
};

export default TablezApp;


import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import type { Theme, Section } from './types';
import Login from './components/Login';
import BohSidebar from './components/BohSidebar';
import ThemeToggle from './components/ThemeToggle';
import SetupWizardModal from './components/SetupWizardModal';
import BottomNav from './components/BottomNav';
import MobileSheet from './components/MobileSheet';
import Toast from './components/Toast';
import DashboardPage from './apps/boh/pages/DashboardPage';
import TeamAccessPage from './apps/boh/pages/TeamAccessPage';
import MenuApp from './apps/delivery/menu/MenuApp';
import CounterApp from './apps/delivery/counter/CounterApp';
import TablezApp from './apps/tablez/TablezApp';
import PatronApp from './apps/patron/PatronApp';
import CookbookApp from './apps/cookbook/CookbookApp';
import ForgeApp from './apps/delivery/forge/ForgeApp';
import LedgerApp from './apps/ledger/LedgerApp';
import CrewApp from './apps/crew/CrewApp';
import CentralApp from './apps/central/CentralApp';
import KeepApp from './apps/keep/KeepApp';
import LoftApp from './apps/loft/LoftApp';
import PersonalRoomPublicJoinPage from './apps/loft/pages/PersonalRoomPublicJoinPage';
import CellarApp from './apps/cellar/CellarApp';
import ChatzApp from './apps/chatz/App';
import SlotzApp from './apps/slotz/App';
import WebsiteApp from './apps/website/App';
import DashboardApp from './apps/dashboard/DashboardApp';
import StoryboardPage from './apps/cookbook/slowcook/storyboard/pages/StoryboardPage';
import MobileCloseButton from './components/boh/MobileCloseButton';
import { performBohLogout } from './lib/logout';
import { getBohTheme, setBohTheme } from './lib/bohAuth';
import { useBohAccess } from './shared/hooks/useBohAccess';
import { supabase } from './lib/supabase';
import { SidebarProvider } from './contexts/SidebarContext';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Supabase Auth is the login source of truth. BOH data identity resolves
  // through public.boh_user after the session is present.
  useEffect(() => {
    const checkLoginState = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.log('[App] Invalid session detected, logging out');
        performBohLogout(navigate);
        setIsLoggedIn(false);
        setIsAuthReady(true);
        return;
      }

      setIsLoggedIn(Boolean(sessionData.session));
      setIsAuthReady(true);
    };

    checkLoginState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
      setIsAuthReady(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = getBohTheme();
    return savedTheme || 'light';
  });
  const [activeSection, setActiveSection] = useState<Section>('dashboard-section');
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Onboarding visibility state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loadingSetupState, setLoadingSetupState] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Load BOH access for shell-level admin affordances.
  // DashboardPage loads its own access data so an early shell read cannot pin it empty.
  const { isSuperAdmin } = useBohAccess();

  // Apply theme to document and save to BOH localStorage
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    setBohTheme(theme);
  }, [theme]);

  // Ensure theme is synchronized on mount (fixes cases where dark class persists from previous session)
  useEffect(() => {
    const hasDarkClass = document.documentElement.classList.contains('dark');
    if (theme === 'dark' && !hasDarkClass) {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light' && hasDarkClass) {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Set active section based on route
  useEffect(() => {
    if (location.pathname === '/tablez' || location.pathname.startsWith('/tablez/')) {
      setActiveSection('tablez-section');
    } else if (location.pathname === '/boh/settings' || location.pathname.startsWith('/boh/settings/')) {
      setActiveSection('settings-section');
    } else if (
      location.pathname === '/forge' ||
      location.pathname.startsWith('/forge/')
    ) {
      setActiveSection('forge-section');
    } else if (location.pathname === '/boh' || location.pathname === '/boh/') {
      setActiveSection('dashboard-section');
    }
  }, [location.pathname]);

  // Handle modal open/close body scroll lock
  useEffect(() => {
    if (isSetupWizardOpen || isMoreMenuOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [isSetupWizardOpen, isMoreMenuOpen]);

  // Determine whether onboarding should be shown based on Supabase state
  useEffect(() => {
    const loadSetupState = async () => {
      setLoadingSetupState(true);
      setSetupError(null);

      // 1. Get current auth user
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();

      if (authErr) {
        const isAuthSessionMissing =
          (authErr as any)?.name === 'AuthSessionMissingError' ||
          typeof (authErr as any)?.message === 'string' &&
            (authErr as any).message.includes('AuthSessionMissingError');

        if (isAuthSessionMissing) {
          // User is simply not logged in yet; this is expected on /boh/login.
          setShowOnboarding(false);
          setLoadingSetupState(false);
          return;
        }

        console.error('Error getting auth user', authErr);
        setShowOnboarding(false);
        setSetupError('Unable to determine user.');
        setLoadingSetupState(false);
        return;
      }

      if (!user) {
        // Not signed in, nothing to show here.
        setShowOnboarding(false);
        setLoadingSetupState(false);
        return;
      }

      // 2. Get boh_user row for this auth user
      const {
        data: bohUser,
        error: userErr,
      } = await supabase
        .from('boh_user')
        .select('*')
        .eq('auth_user_id', user.id)
        .eq('app_context', 'boh')
        .single();

      if (userErr || !bohUser) {
        console.error('Error loading boh_user', userErr);
        // Edge case: if no boh_user row, treat as needing setup.
        setShowOnboarding(true);
        setLoadingSetupState(false);
        return;
      }

      // App access is handled by useBohAccess. Do not query role/app tables here;
      // BOH-dev RLS policies may rely on helper functions not needed for login.
      setShowOnboarding(false);
      setLoadingSetupState(false);
    };

    void loadSetupState();
  }, []);

  // Open or close the setup wizard modal based on onboarding state
  useEffect(() => {
    if (!loadingSetupState && showOnboarding) {
      setIsSetupWizardOpen(true);
    } else if (!showOnboarding) {
      setIsSetupWizardOpen(false);
    }
  }, [loadingSetupState, showOnboarding]);


  const handleLogin = (email: string) => {
    setIsLoggedIn(true);
  };

  const handleSignOut = () => {
    performBohLogout(navigate);
  };

  const handleThemeToggle = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleRequestAccess = async (app: string) => {
    // TODO: Implement API call to request access
    // For now, just show a toast
    setToastMessage(`Access requested for ${app}`);
    setShowToast(true);
  };

  const handleApproveAll = () => {
    // Debug function - no longer needed but keeping for compatibility
    setToastMessage('All apps approved (debug mode)');
    setShowToast(true);
  };

  const handleSetupSubmit = (roles: string[], apps: string[]) => {
    setHasCompletedSetup(true);
    setIsSetupWizardOpen(false);
    // TODO: Save setup preferences
  };

  const renderProtectedRoute = (element: React.ReactElement) => {
    if (!isAuthReady) {
      return null;
    }

    if (!isLoggedIn) {
      return <Navigate to="/boh/login" replace />;
    }

    return element;
  };

  // Render BOH main UI with sidebar and navigation
  const renderBohMainUI = () => {
    const isTablezRoute = location.pathname === '/apps/tablez';
    
    if (!isLoggedIn) {
      return <Navigate to="/boh/login" replace />;
    }
    return (
    <div className={`min-h-screen w-full app-container boh-hide-scrollbars ${theme === 'dark' ? 'bg-boh-bg text-boh-text' : 'bg-boh-bg-light text-boh-text-light'}`}>
      <BohSidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        isAdmin={isSuperAdmin}
      />

      <main className="main-content boh-hide-scrollbars">
        <MobileCloseButton />
        {/* Render active section */}
        {activeSection === 'dashboard-section' && (
          <DashboardPage
            onRequestAccess={handleRequestAccess}
            onApproveAll={handleApproveAll}
            theme={theme}
            onThemeToggle={handleThemeToggle}
            onNavigate={setActiveSection}
          />
        )}

        {activeSection === 'team-access-section' && (
          <>
            <header className="main-header apps-page-header">
              <div className="label">Administration</div>
              <h2>Access</h2>
              <p>Permissions, app access, and invites.</p>
            </header>
            <TeamAccessPage />
          </>
        )}

        {activeSection === 'forge-section' && (
          <Navigate to="/forge" replace />
        )}

        {activeSection === 'settings-section' && (
          <Navigate to="/boh/settings" replace />
        )}
        

        {/* Tablez is now handled by /apps/tablez route */}
      </main>

      <BottomNav
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onMoreClick={() => setIsMoreMenuOpen(true)}
      />

      <MobileSheet
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        onNavigate={(section) => {
          setActiveSection(section);
          setIsMoreMenuOpen(false);
        }}
      />

      <SetupWizardModal
        isOpen={isSetupWizardOpen}
        onClose={() => setIsSetupWizardOpen(false)}
        onSubmit={handleSetupSubmit}
      />

      <Toast
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
    );
  };

  return (
    <SidebarProvider>
      <Routes>
      <Route path="/boh/cookbook/slow-cook/:projectType/new" element={renderProtectedRoute(<StoryboardPage mode="create" />)} />
      <Route path="/boh/cookbook/slow-cook/:projectType" element={renderProtectedRoute(<StoryboardPage mode="edit" />)} />
      <Route path="/boh/cookbook/*" element={renderProtectedRoute(<CookbookApp />)} />
      <Route path="/boh/login" element={<Login onLogin={handleLogin} />} />
      <Route path="/boh/*" element={renderProtectedRoute(<DashboardApp isAdmin={isSuperAdmin} />)} />
      <Route path="/menu/*" element={renderProtectedRoute(<MenuApp isAdmin={isSuperAdmin} />)} />
      <Route path="/ledger/*" element={renderProtectedRoute(<LedgerApp isAdmin={isSuperAdmin} />)} />
      <Route path="/crew/*" element={renderProtectedRoute(<CrewApp isAdmin={isSuperAdmin} />)} />
      <Route path="/central/*" element={renderProtectedRoute(<CentralApp isAdmin={isSuperAdmin} />)} />
      <Route path="/keep/*" element={renderProtectedRoute(<KeepApp isAdmin={isSuperAdmin} />)} />
      <Route path="/loft/join/:slug" element={<PersonalRoomPublicJoinPage />} />
      <Route path="/loft/*" element={renderProtectedRoute(<LoftApp isAdmin={isSuperAdmin} />)} />
      <Route path="/cellar/*" element={renderProtectedRoute(<CellarApp isAdmin={isSuperAdmin} />)} />
      <Route path="/apps/chatz/*" element={renderProtectedRoute(<ChatzApp isAdmin={isSuperAdmin} />)} />
      <Route path="/apps/slotz/*" element={renderProtectedRoute(<SlotzApp isAdmin={isSuperAdmin} />)} />
      <Route path="/website/*" element={renderProtectedRoute(<WebsiteApp isAdmin={isSuperAdmin} />)} />
      <Route path="/forge/*" element={renderProtectedRoute(<ForgeApp isAdmin={isSuperAdmin} />)} />
      <Route path="/counter/*" element={renderProtectedRoute(<CounterApp />)} />
      <Route path="/cookbook/*" element={renderProtectedRoute(<CookbookApp />)} />
      <Route path="/tablez/*" element={renderProtectedRoute(<TablezApp />)} />
      {/* Legacy Tablez paths redirect to new /tablez/dashboard */}
      <Route path="/apps/tablez/*" element={<Navigate to="/tablez/dashboard" replace />} />
      <Route path="/apps/tablez" element={<Navigate to="/tablez/dashboard" replace />} />
      <Route path="/patron/*" element={renderProtectedRoute(<PatronApp />)} />
      <Route path="/" element={<Navigate to="/boh" replace />} />
      <Route path="*" element={renderBohMainUI()} />
    </Routes>
    <Toaster 
      position="bottom-center"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--boh-surface)',
          color: 'var(--boh-text)',
          border: '1px solid var(--boh-border)',
        },
        success: {
          iconTheme: {
            primary: 'var(--boh-primary)',
            secondary: 'white',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: 'white',
          },
        },
      }}
    />
    </SidebarProvider>
  );
}

export default App;

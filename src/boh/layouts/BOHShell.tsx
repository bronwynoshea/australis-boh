import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppRail from '../navigation/AppRail';
import ContextualSidebar from '../navigation/ContextualSidebar';
import { useBohNavigation } from '../navigation/useBohNavigation';
import type { BohAppDefinition } from '../navigation/types';

interface BOHShellProps {
  children: React.ReactNode;
  apps: BohAppDefinition[];
  isAdmin?: boolean;
  defaultHomeRoute?: string;
  mobileHeader?: React.ReactNode;
  /**
   * When true, renders the shell in dashboard mode with expanded primary sidebar.
   * When false (default), renders in app mode with collapsed rail + contextual sidebar.
   */
  isDashboardMode?: boolean;
  /**
   * Some apps render their own in-content navigation and only need the global
   * BOH rail. Keep true by default for existing BOH app behavior.
   */
  showContextualSidebar?: boolean;
  /**
   * Removes the standard BOH page padding for embedded full-viewport apps.
   */
  flushContent?: boolean;
}

const BOHShell: React.FC<BOHShellProps> = ({
  children,
  apps,
  isAdmin = false,
  defaultHomeRoute = '/boh',
  mobileHeader,
  isDashboardMode = false,
  showContextualSidebar = true,
  flushContent = false,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAppMenuExpanded, setIsAppMenuExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const { activeApp, activeNavItem } = useBohNavigation(apps);
  const isPrimaryMenuExpanded = isDashboardMode || isAppMenuExpanded;

  // Track desktop state
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const handleAppSelect = useCallback(() => {
    setIsMobileMenuOpen(false);
    setIsAppMenuExpanded(false);
  }, []);

  const handleBrandClick = useCallback(() => {
    if (isPrimaryMenuExpanded) {
      setIsMobileMenuOpen(false);
      setIsAppMenuExpanded(false);
      navigate(defaultHomeRoute);
      return;
    }

    setIsAppMenuExpanded(true);
  }, [defaultHomeRoute, isPrimaryMenuExpanded, navigate]);

  // Calculate the appropriate class for main content margin
  const getMainContentClass = () => {
    // In dashboard mode: content area accounts for expanded sidebar
    if (isPrimaryMenuExpanded) {
      return 'boh-main-content-dashboard';
    }
    // In app mode: content area accounts for rail + contextual sidebar if present
    if (showContextualSidebar && activeApp?.navConfig && !isSidebarCollapsed) {
      return 'boh-main-content-with-sidebar';
    }
    if (showContextualSidebar && activeApp?.navConfig && isSidebarCollapsed) {
      return 'boh-main-content-sidebar-collapsed';
    }
    return 'boh-main-content-rail-only';
  };

  return (
    <div className={`boh-shell ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="boh-mobile-overlay visible lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Global App Rail - Collapsed in app mode, expanded in dashboard mode */}
      <div className={`boh-rail-container ${isMobileMenuOpen ? 'mobile-open' : ''} ${isPrimaryMenuExpanded ? 'dashboard-mode' : ''} ${isAppMenuExpanded ? 'full-menu-open' : ''}`}>
        <AppRail
          apps={apps}
          activeAppId={activeApp?.id}
          isAdmin={isAdmin}
          onAppSelect={handleAppSelect}
          onMenuItemSelect={handleAppSelect}
          onBrandClick={handleBrandClick}
          homeRoute={defaultHomeRoute}
          showHome={false}
          isExpanded={isPrimaryMenuExpanded}
        />
      </div>

      {/* Contextual Sidebar - Shows when app is selected in app mode (not dashboard) */}
      {!isPrimaryMenuExpanded && showContextualSidebar && activeApp?.navConfig && (
        <div 
          className={`boh-sidebar-container ${isSidebarCollapsed ? 'collapsed' : ''} ${isMobileMenuOpen ? 'mobile-open' : ''}`}
        >
          <ContextualSidebar
            config={activeApp.navConfig}
            activeItemKey={activeNavItem}
            isCollapsed={isSidebarCollapsed}
            onToggle={toggleSidebar}
          />
        </div>
      )}

      {/* Mobile Menu Toggle - Only visible on small screens */}
      <button
        className="boh-mobile-menu-toggle lg:hidden"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle navigation menu"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isMobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Main Content Area */}
      <main className={`boh-main-content ${getMainContentClass()}`}>
        {/* Mobile Header (if provided) */}
        {mobileHeader}

        {/* Content */}
        <div className={`boh-content-wrapper ${flushContent ? 'boh-content-wrapper-flush' : ''}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default BOHShell;

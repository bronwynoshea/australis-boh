import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { performBohLogout } from '../../lib/logout';
import type { BohAppDefinition } from './types';

interface AppRailProps {
  apps: BohAppDefinition[];
  activeAppId?: string | null;
  isAdmin?: boolean;
  onAppSelect?: (app: BohAppDefinition) => void;
  onMenuItemSelect?: () => void;
  homeRoute?: string;
  showHome?: boolean;
  onBrandClick?: () => void;
  /**
   * When true, renders as expanded sidebar with app names visible (dashboard mode).
   * When false (default), renders as collapsed icon rail (app mode).
   */
  isExpanded?: boolean;
}

// Default icons for common apps
export const DefaultIcons = {
  Home: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Menu: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  Ledger: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Tablez: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  Cookbook: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  Patron: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Counter: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  ),
  Forge: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  Crew: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Settings: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Logout: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Chatz: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  Slotz: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M5 11h14M7 21h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2zm3-6h.01M14 15h.01M10 18h.01M14 18h.01" />
    </svg>
  ),
  Generic: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  Studio: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  Central: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  Keep: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Loft: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Cellar: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="21 10 62 74" aria-hidden="true">
      <path
        d="M24 22C24 15.925 28.925 11 35 11H71C75.971 11 80 15.029 80 20V82H69V27C69 24.239 66.761 22 64 22H37C34.239 22 32 24.239 32 27V62C32 64.761 34.239 67 37 67H52V78H35C28.925 78 24 73.075 24 67V22Z"
        fill="currentColor"
      />
      <path
        d="M53 43.5C53 41.71 53.949 40.055 55.494 39.151L69 31.25V82L55.494 74.099C53.949 73.195 53 71.54 53 69.75V43.5Z"
        fill="currentColor"
        opacity="0.78"
      />
      <path d="M37 67H52V78L37 67Z" fill="currentColor" opacity="0.58" />
      <path
        d="M36 26H63C64.105 26 65 26.895 65 28V33.6L53.474 40.343C50.709 41.961 49 44.923 49 48.127V63H37C36.448 63 36 62.552 36 62V27C36 26.448 36.448 26 37 26Z"
        fill="currentColor"
        opacity="0.24"
      />
    </svg>
  ),
  Talent: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  GoldVault: ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v6m-3-3h6" />
    </svg>
  ),
};

const AppRail: React.FC<AppRailProps> = ({ 
  apps, 
  activeAppId, 
  isAdmin = false,
  onAppSelect,
  onMenuItemSelect,
  homeRoute = '/boh',
  showHome = true,
  onBrandClick,
  isExpanded = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [tooltip, setTooltip] = useState<{ text: string; y: number } | null>(null);

  const groupedApps = React.useMemo(() => {
    const visibleApps = apps
      .filter(app => app.id !== 'home' && app.id !== 'boh')
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      suite: visibleApps.filter((app) => (app.category ?? 'internal') !== 'customer'),
      links: visibleApps.filter((app) => app.category === 'customer'),
    };
  }, [apps]);

  const handleAppClick = (app: BohAppDefinition, e: React.MouseEvent) => {
    if (app.disabled) {
      e.preventDefault();
      return;
    }
    
    if (app.isExternal && app.externalUrl && !app.route) {
      e.preventDefault();
      window.open(app.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    onAppSelect?.(app);
    onMenuItemSelect?.();
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    performBohLogout(navigate);
  };

  const showTooltip = (text: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ text, y: rect.top + rect.height / 2 });
  };

  const hideTooltip = () => {
    setTooltip(null);
  };

  // Check if we're on the home/dashboard route
  const isHomeActive = location.pathname === homeRoute || location.pathname === `${homeRoute}/`;

  // Dashboard mode: expanded sidebar with app names
  if (isExpanded) {
    return (
      <aside className="boh-dashboard-sidebar">
        {/* Logo / Brand */}
        <div className="boh-dashboard-brand">
          <button
            type="button"
            className="boh-dashboard-logo"
            title="Back of House"
            aria-label="Back of House"
            onClick={onBrandClick}
          >
            <span className="boh-dashboard-logo-text">B</span>
            <span className="boh-dashboard-logo-label">Back of House</span>
          </button>
        </div>

        {/* App List */}
        <nav className="boh-dashboard-apps" aria-label="BOH Applications">
          {[
            { key: 'suite', label: 'BOH Suite', apps: groupedApps.suite },
            { key: 'links', label: 'Workspace Links', apps: groupedApps.links },
          ].map((group) => group.apps.length > 0 && (
            <div key={group.key} className="boh-dashboard-app-group">
              <div className="boh-dashboard-section-label">{group.label}</div>
              {group.apps.map((app) => {
            const IconComponent = app.icon || DefaultIcons.Generic;
            const isActive = activeAppId === app.id;
            
            return (
              <Link
                key={app.id}
                to={app.route || '#'}
                className={`boh-dashboard-app-item ${isActive ? 'active' : ''} ${app.disabled ? 'disabled' : ''}`}
                onClick={(e) => handleAppClick(app, e)}
                aria-current={isActive ? 'page' : undefined}
              >
                <IconComponent className="boh-dashboard-app-icon" />
                <span className="boh-dashboard-app-name">{app.name}{app.disabled ? ' · Planned' : ''}</span>
              </Link>
            );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="boh-dashboard-footer">
          {isAdmin && (
            <>
              <Link
                to="/boh/settings"
                className={`boh-dashboard-app-item ${location.pathname.startsWith('/boh/settings') ? 'active' : ''}`}
                onClick={onMenuItemSelect}
              >
                <DefaultIcons.Settings className="boh-dashboard-app-icon" />
                <span className="boh-dashboard-app-name">Settings</span>
              </Link>
            </>
          )}
          
          <button
            className="boh-dashboard-app-item boh-dashboard-button"
            onClick={handleLogout}
          >
            <DefaultIcons.Logout className="boh-dashboard-app-icon" />
            <span className="boh-dashboard-app-name">Logout</span>
          </button>
        </div>
      </aside>
    );
  }

  // App mode: collapsed icon rail
  return (
    <aside className="boh-app-rail">
      {/* Logo / Brand */}
      <div className="boh-rail-brand">
        <button
          type="button"
          className="boh-rail-logo"
          title="Back of House"
          aria-label="Back of House"
          onClick={onBrandClick}
        >
          <span className="boh-rail-logo-text">B</span>
        </button>
      </div>

      {/* Main app icons */}
      <nav className="boh-rail-apps" aria-label="BOH Applications">
        {showHome && (
          <Link
            to={homeRoute}
            className={`boh-rail-item ${isHomeActive ? 'active' : ''}`}
            onMouseEnter={(e) => showTooltip('Home', e)}
            onFocus={(e) => showTooltip('Home', e)}
            onMouseLeave={hideTooltip}
            onBlur={hideTooltip}
            title="Home"
            aria-label="Home"
          >
            <DefaultIcons.Home className="boh-rail-icon" />
          </Link>
        )}

        {apps
          .filter(app => app.id !== 'home' && app.id !== 'boh')
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((app) => {
          const IconComponent = app.icon || DefaultIcons.Generic;
          const isActive = activeAppId === app.id;
          
          return (
            <Link
              key={app.id}
              to={app.route || '#'}
              className={`boh-rail-item ${isActive ? 'active' : ''} ${app.disabled ? 'disabled' : ''}`}
              onClick={(e) => handleAppClick(app, e)}
              onMouseEnter={(e) => showTooltip(app.disabled ? `${app.name} · Planned` : app.name, e)}
              onFocus={(e) => showTooltip(app.disabled ? `${app.name} · Planned` : app.name, e)}
              onMouseLeave={hideTooltip}
              onBlur={hideTooltip}
              title={app.disabled ? `${app.name} · Planned` : app.name}
              aria-label={app.disabled ? `${app.name} · Planned` : app.name}
              aria-current={isActive ? 'page' : undefined}
            >
              <IconComponent className="boh-rail-icon" />
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="boh-rail-footer">
        {isAdmin && (
          <Link
            to="/boh/settings"
            className={`boh-rail-item ${location.pathname.startsWith('/boh/settings') ? 'active' : ''}`}
            onClick={onMenuItemSelect}
            onMouseEnter={(e) => showTooltip('Settings', e)}
            onFocus={(e) => showTooltip('Settings', e)}
            onMouseLeave={hideTooltip}
            onBlur={hideTooltip}
            title="Settings"
            aria-label="Settings"
          >
            <DefaultIcons.Settings className="boh-rail-icon" />
          </Link>
        )}
        
        <button
          className="boh-rail-item boh-rail-button"
          onClick={handleLogout}
          onMouseEnter={(e) => showTooltip('Logout', e as unknown as React.MouseEvent<HTMLAnchorElement>)}
          onFocus={(e) => showTooltip('Logout', e as unknown as React.MouseEvent<HTMLAnchorElement>)}
          onMouseLeave={hideTooltip}
          onBlur={hideTooltip}
          title="Logout"
          aria-label="Logout"
        >
          <DefaultIcons.Logout className="boh-rail-icon" />
        </button>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div 
          className="boh-rail-tooltip"
          style={{ top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </aside>
  );
};

export default AppRail;

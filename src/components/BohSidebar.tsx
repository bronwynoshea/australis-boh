import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { performBohLogout } from '../lib/logout';
import BohSidebarHeader from './BohSidebarHeader';
import { DashboardIcon, InboxIcon, TicketIcon, PlusCircleIcon, AgentsIcon, SettingsIcon } from '../apps/delivery/counter/components/Icons';
import { COUNTER_NAV_ITEMS } from '../apps/delivery/counter/config/nav';
import { useSidebar } from '../contexts/SidebarContext';

interface BohSidebarProps {
  onNavigate?: (section: string) => void;
  activeSection?: string;
  isAdmin?: boolean;
}

const BohSidebar: React.FC<BohSidebarProps> = ({ onNavigate, activeSection, isAdmin = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isCollapsed } = useSidebar();
  const [counterModules, setCounterModules] = React.useState<any[] | null>(null);
  const [cookbookModules, setCookbookModules] = React.useState<any[] | null>(null);
  const [tablezActivePage, setTablezActivePage] = React.useState<string | null>(null);

  // Get current app info from pathname
  const getCurrentAppInfo = () => {
    const path = location.pathname;
    
    if (path === '/counter' || path.startsWith('/counter/')) {
      return { name: 'Counter', type: 'counter' };
    }
    if (path === '/cookbook' || path.startsWith('/cookbook/')) {
      return { name: 'Cookbook', type: 'cookbook' };
    }
    if (path === '/tablez' || path.startsWith('/tablez/')) {
      return { name: 'Tablez', type: 'tablez' };
    }
    if (path === '/chatz' || path.startsWith('/chatz/') || path === '/apps/chatz' || path.startsWith('/apps/chatz/')) {
      return { name: 'Chatz', type: 'chatz' };
    }
    if (path === '/patron' || path.startsWith('/patron/')) {
      return { name: 'Patron', type: 'patron' };
    }
    if (path === '/menu' || path.startsWith('/menu/')) {
      return { name: 'Menu', type: 'boh' };
    }
    if (path === '/ledger' || path.startsWith('/ledger/')) {
      return { name: 'Ledger', type: 'boh' };
    }
    if (path === '/forge' || path.startsWith('/forge/')) {
      return { name: 'Forge', type: 'boh' };
    }
    if (path === '/crew' || path.startsWith('/crew/')) {
      return { name: 'Crew', type: 'boh' };
    }
    return { name: null, type: 'boh' };
  };
  
  const { name: currentAppName, type: currentAppType } = getCurrentAppInfo();
  
  // Get active Counter page from pathname
  const getCounterActivePage = (): string | null => {
    if (!location.pathname.startsWith('/counter')) return null;
    const path = location.pathname.replace('/counter', '') || '/';
    if (path === '/all') return 'all';
    if (path === '/new') return 'new';
    if (path === '/agents') return 'agents';
    if (path === '/settings') return 'settings';
    return null;
  };

  const counterActivePage = getCounterActivePage();

  // Icon map for Counter modules
  const counterIconMap: Record<string, React.ComponentType<any>> = {
    inbox: InboxIcon,
    all_tickets: TicketIcon,
    new_ticket: PlusCircleIcon,
    agents: AgentsIcon,
    settings: SettingsIcon,
  };

  const normalizeCounterRoute = (route?: string | null): string | null => {
    if (!route) return null;
    const trimmed = route.trim();
    if (!trimmed) return null;

    if (trimmed === '/counter' || trimmed === '/counter/') {
      return '/counter/dashboard';
    }

    if (trimmed.startsWith('/counter')) {
      return trimmed;
    }

    const embeddedIndex = trimmed.indexOf('/counter/');
    if (embeddedIndex !== -1) {
      return trimmed.slice(embeddedIndex);
    }

    return null;
  };

  const resolveCounterModuleRoute = (module: any): string => {
    const configuredRoute = normalizeCounterRoute(module.route);
    if (configuredRoute) return configuredRoute;

    const label = String(module.label || '').toLowerCase();
    if (label.includes('my ticket')) return '/counter/my';
    if (label.includes('inbox')) return '/counter/inbox';
    if (label.includes('all ticket') || (label.includes('all') && label.includes('ticket'))) return '/counter/all';
    if (label.includes('new') || label.includes('create') || label.includes('ticket')) return '/counter/new';
    if (label.includes('agent') || label.includes('team')) return '/counter/agents';
    if (label.includes('setting')) return '/counter/settings';
    if (label.includes('dashboard')) return '/counter/dashboard';

    return '/counter/dashboard';
  };

  // Load modules data (kept for backward compatibility with Counter and Cookbook)
  React.useEffect(() => {
    const loadModules = async () => {
      try {
        // Import supabase dynamically to avoid unused import
        const { supabase } = await import('../lib/supabase');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Load Counter and Cookbook modules
        const { data: appsData } = await supabase
          .from('boh_app')
          .select('*')
          .eq('is_active', true);

        // Load Counter modules
        const { data: counterModulesData } = await supabase
          .from('boh_app_module')
          .select('*')
          .eq('app_id', appsData?.find(app => app.slug === 'counter')?.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (counterModulesData) {
          setCounterModules(counterModulesData);
        }

        // Load Cookbook modules
        const { data: cookbookModulesData } = await supabase
          .from('boh_app_module')
          .select('*')
          .eq('app_id', appsData?.find(app => app.slug === 'cookbook')?.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (cookbookModulesData) {
          setCookbookModules(cookbookModulesData);
        }
      } catch (error) {
        console.error('Error loading modules:', error);
      }
    };

    loadModules();
  }, []);

  // Render app-specific navigation
  const renderAppNav = () => {
    if (currentAppType === 'boh' && currentAppName === 'Menu') {
      const menuNavItems = [
        { key: 'overview', label: 'Overview', to: '/menu/overview' },
        { key: 'board', label: 'Pipeline', to: '/menu/board' },
        { key: 'timeline', label: 'Timeline', to: '/menu/timeline' },
        { key: 'archive', label: 'Archive', to: '/menu/archive' },
        { key: 'reports', label: 'Reports', to: '/menu/reports' },
      ];

      return (
        <ul>
          {menuNavItems.map((item) => {
            const isActive = location.pathname === item.to || 
              (item.key === 'overview' && (location.pathname === '/menu/overview' || location.pathname === '/menu/overview/')) ||
              (item.key === 'planning' && (location.pathname === '/menu' || location.pathname === '/menu/'));
            return (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {item.key === 'overview' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    )}
                    {item.key === 'planning' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    )}
                    {item.key === 'board' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    )}
                    {item.key === 'timeline' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                    {item.key === 'archive' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    )}
                    {item.key === 'reports' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v6m0 4V8a2 2 0 012-2h8a2 2 0 012 2v8" />
                    )}
                  </svg>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    }
    
    if (currentAppType === 'counter') {
      const hasCounterModules = !!counterModules && counterModules.length > 0;

      if (hasCounterModules) {
        return (
          <ul>
            {counterModules
              ?.filter((module) => module.route !== '/counter/settings')
              .map((module) => {
                const targetPath: string = resolveCounterModuleRoute(module);
                const isActive =
                  location.pathname === targetPath ||
                  (targetPath === '/counter/dashboard' &&
                    (location.pathname === '/counter' || location.pathname === '/counter/'));
                const IconComponent =
                  (module.icon_key && counterIconMap[module.icon_key]) || DashboardIcon;

                return (
                  <li key={module.id}>
                    <Link
                      to={targetPath}
                      className={`nav-link ${isActive ? 'active' : ''}`}
                    >
                      <IconComponent className="w-5 h-5" />
                      <span>{module.label}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        );
      }

      return (
        <ul>
          {COUNTER_NAV_ITEMS.filter(item => item.page !== 'Settings').map((item) => {
            const currentPath = location.pathname.replace(/^\/counter/, '') || '/';
            const isActive = (activeSection && activeSection === item.page) ||
              counterActivePage === item.path ||
              (item.path === 'dashboard' && (currentPath === '/' || currentPath === '/dashboard'));
            return (
              <li key={item.page}>
                <Link
                  to={`/counter/${item.path}`}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    }
    
    if (currentAppType === 'cookbook') {
      const hasCookbookModules = !!cookbookModules && cookbookModules.length > 0;

      if (hasCookbookModules) {
        const resolveModuleHref = (appRoute: string | null | undefined, moduleRoute: string | null): string => {
          const appRouteValue = (appRoute as string | undefined) ?? '/cookbook';
          const base = appRouteValue.replace(/\/$/, '');
          if (!moduleRoute) return base;
          if (moduleRoute.startsWith('/')) return moduleRoute;
          const segment = moduleRoute.replace(/^\/+/, '');
          return `${base}/${segment}`;
        };

        const sortedCookbookModules = [...(cookbookModules || [])].sort((a, b) => {
          const al = (a.label as string | null) ?? "";
          const bl = (b.label as string | null) ?? "";
          return al.localeCompare(bl);
        });

        return (
          <ul>
            {sortedCookbookModules.map((module) => {
              const normalisedAppBase = '/cookbook';

              let rawRoute: string | null = module.route || null;

              // If the module route is just the app base (e.g. '/cookbook' or '/boh/cookbook'),
              // treat it as missing so we can use a label-based fallback.
              if (rawRoute) {
                const normalisedRaw = rawRoute.replace(/\/$/, '');
                if (normalisedRaw === normalisedAppBase) {
                  rawRoute = null;
                }
              }

              // Fallback for modules where the route isn't set correctly in boh_app_module.
              if (!rawRoute && typeof module.label === 'string') {
                const label = module.label.toLowerCase();
                if (label.includes('slow cook')) {
                  rawRoute = 'slowcook';
                } else if (label.includes('pantry')) {
                  rawRoute = 'pantry';
                } else if (label.includes('quick')) {
                  rawRoute = 'quickserve';
                } else if (label.includes('reservation')) {
                  rawRoute = 'reservations';
                } else if (label.includes('recipe')) {
                  rawRoute = 'recipes';
                }
              }

              const targetPath: string = resolveModuleHref('/cookbook', rawRoute);
              const isActive =
                location.pathname === targetPath ||
                location.pathname.startsWith(`${targetPath}/`);

              return (
                <li key={module.id}>
                  <Link
                    to={targetPath}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h12a2 2 0 012 2v14l-3.5-2L11 20l-3.5-2L4 20V4z" />
                    </svg>
                    <span>{module.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        );
      }

      // Default navigation when no modules exist - render app root
      return (
        <ul>
          <li>
            <Link
              to="/cookbook"
              className={`nav-link ${location.pathname === '/cookbook' || location.pathname === '/cookbook/' ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Overview</span>
            </Link>
          </li>
        </ul>
      );
    }

    if (currentAppType === 'tablez') {
      const isBoardActive = tablezActivePage === 'Board' || 
        location.pathname === '/tablez' ||
        location.pathname === '/tablez/' ||
        location.pathname === '/tablez/dashboard';
      const isTodayActive = tablezActivePage === 'Today' || 
        location.pathname === '/tablez/today';
      const isProjectsActive = location.pathname === '/tablez/projects';
      
      return (
        <ul>
          <li>
            <Link
              to="/tablez/dashboard"
              onClick={() => setTablezActivePage?.('Board')}
              className={`nav-link ${isBoardActive ? 'active' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>Board</span>
            </Link>
          </li>
          <li>
            <Link
              to="/tablez/today"
              onClick={() => setTablezActivePage?.('Today')}
              className={`nav-link ${isTodayActive ? 'active' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Today</span>
            </Link>
          </li>
          <li>
            <Link
              to="/tablez/projects"
              className={`nav-link ${isProjectsActive ? 'active' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span>Projects</span>
            </Link>
          </li>
        </ul>
      );
    }
    
    // Forge navigation
    if (currentAppType === 'boh' && currentAppName === 'Forge') {
      const forgeNavItems = [
        { key: 'overview', label: 'Overview', to: '/forge' },
        { key: 'intake', label: 'Intake', to: '/forge/intake' },
        { key: 'workstreams', label: 'Workstreams', to: '/forge/workstreams' },
        { key: 'internal-releases', label: 'Internal Releases', to: '/forge/internal-releases' },
        { key: 'external-releases', label: 'External Releases', to: '/forge/external-releases' },
        { key: 'reports', label: 'Reports', to: '/forge/reports' },
      ];

      return (
        <ul>
          {forgeNavItems.map((item) => {
            const isActive = location.pathname === item.to || 
              (item.key === 'overview' && (location.pathname === '/forge' || location.pathname === '/forge/')) ||
              (item.key === 'reports' && (location.pathname.startsWith('/forge/reports'))) ||
              (item.key === 'intake' && location.pathname === '/forge/intake');
            return (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {item.key === 'overview' && (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1H2a1 1 0 00-1 1v4a1 1 0 001 1h3zm-6 0h6" />
                    )}
                    {item.key === 'intake' && (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    )}
                    {item.key === 'workstreams' && (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    )}
                    {item.key === 'internal-releases' && (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h10m-7 5h10" />
                    )}
                    {item.key === 'external-releases' && (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h10m-7 5h10M7 2h10" />
                    )}
                    {item.key === 'reports' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v1a1 1 0 001 1h4a1 1 0 001-1v-1m3-2V8a2 2 0 00-2-2H8a2 2 0 00-2 2v6m0 4V8a2 2 0 012-2h8a2 2 0 012 2v8" />
                    )}
                  </svg>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
    }
    
    // BOH dashboard navigation (when not in an app)
    return null;
  };

  return (
    <aside className={`sidebar transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`} style={{ 
      overflowY: 'auto',
      scrollbarWidth: 'none', /* Firefox */
      msOverflowStyle: 'none', /* Internet Explorer 10+ */
    }}>
      <style>{`
        .sidebar::-webkit-scrollbar {
          display: none; /* Safari and Chrome */
        }
      `}</style>
      <BohSidebarHeader currentAppName={currentAppName} />
      
      <nav className={`sidebar-nav ${isCollapsed ? 'hidden' : ''}`}>
        {renderAppNav()}
      </nav>
      
      {/* Administration section - admin only */}
      {isAdmin && (
        <div className="sidebar-section">
          <div className="sidebar-section-label">ADMINISTRATION</div>
          <ul>
            <li>
              <a 
                href="/boh" 
                className={`nav-link ${activeSection === 'team-access-section' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/boh');
                  onNavigate?.('team-access-section');
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v-1a6 6 0 00-12 0v-1a6 6 0 00-6 6H3z" />
                </svg>
                <span>Access</span>
              </a>
            </li>
          </ul>
        </div>
      )}
      
      {/* Settings and Logout - always shown in footer */}
      <div className="sidebar-footer">
        <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); navigate('/counter/settings'); }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Settings</span>
        </a>
        <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); performBohLogout(navigate); }}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Logout</span>
        </a>
      </div>
    </aside>
  );
};

export default BohSidebar;

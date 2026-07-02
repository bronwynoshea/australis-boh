import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Section } from '../types';
import { performBohLogout } from '../lib/logout';
import BohSidebarHeader from './BohSidebarHeader';
import { DashboardIcon, InboxIcon, TicketIcon, PlusCircleIcon, AgentsIcon } from '../apps/delivery/counter/components/Icons';

interface SidebarProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onSignOut: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, onNavigate, onSignOut }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine current app name and type based on route
  const getCurrentAppInfo = (): { name: string | null; type: 'counter' | 'tablez' | 'boh' | null } => {
    if (location.pathname.startsWith('/counter')) {
      return { name: 'Counter', type: 'counter' };
    }
    if (location.pathname === '/tablez' || location.pathname.startsWith('/tablez') || activeSection === 'tablez-section') {
      return { name: 'Tablez & Chairz', type: 'tablez' };
    }
    return { name: null, type: 'boh' };
  };
  
  const { name: currentAppName, type: currentAppType } = getCurrentAppInfo();
  
  // Get active Counter page from pathname
  const getCounterActivePage = (): string | null => {
    if (!location.pathname.startsWith('/counter')) return null;
    const path = location.pathname.replace('/counter', '') || '/dashboard';
    if (path === '/' || path === '/dashboard') return 'dashboard';
    if (path === '/inbox') return 'inbox';
    if (path === '/my') return 'my';
    if (path === '/all') return 'all';
    if (path === '/new') return 'new';
    if (path === '/agents') return 'agents';
    return null;
  };

  const counterActivePage = getCounterActivePage();

  // Render app-specific navigation
  const renderAppNav = () => {
    if (currentAppType === 'counter') {
      return (
        <ul>
          <li>
            <a 
              href="#" 
              className={`nav-link ${counterActivePage === 'dashboard' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigate('/counter/dashboard');
              }}
            >
              <DashboardIcon className="w-5 h-5" />
              <span>Dashboard</span>
            </a>
          </li>
          <li>
            <a 
              href="#" 
              className={`nav-link ${counterActivePage === 'inbox' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigate('/counter/inbox');
              }}
            >
              <InboxIcon className="w-5 h-5" />
              <span>Inbox</span>
            </a>
          </li>
          <li>
            <a 
              href="#" 
              className={`nav-link ${counterActivePage === 'my' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigate('/counter/my');
              }}
            >
              <TicketIcon className="w-5 h-5" />
              <span>My Tickets</span>
            </a>
          </li>
          <li>
            <a 
              href="#" 
              className={`nav-link ${counterActivePage === 'all' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigate('/counter/all');
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
              <span>All Tickets</span>
            </a>
          </li>
          <li>
            <a 
              href="#" 
              className={`nav-link ${counterActivePage === 'new' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigate('/counter/new');
              }}
            >
              <PlusCircleIcon className="w-5 h-5" />
              <span>New Ticket</span>
            </a>
          </li>
          <li>
            <a 
              href="#" 
              className={`nav-link ${counterActivePage === 'agents' ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                navigate('/counter/agents');
              }}
            >
              <AgentsIcon className="w-5 h-5" />
              <span>Agents</span>
            </a>
          </li>
        </ul>
      );
    }
    
    // BOH dashboard navigation (when not in an app)
    return (
      <ul>
        <li>
          <a 
            href="#" 
            className={`nav-link ${activeSection === 'dashboard-section' ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('dashboard-section');
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span>Dashboard</span>
          </a>
        </li>
        <li>
          <a 
            href="#" 
            className={`nav-link ${activeSection === 'apps-access-section' ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('apps-access-section');
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 21a6 6 0 006-6v-1a3 3 0 00-3-3H9a3 3 0 00-3 3v1a6 6 0 006 6z" />
            </svg>
            <span>Apps & Access</span>
          </a>
        </li>
        <li>
          <a 
            href="#" 
            className={`nav-link ${activeSection === 'team-invites-section' ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('team-invites-section');
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Team & Invites</span>
          </a>
        </li>
      </ul>
    );
  };

  return (
    <aside className="sidebar">
      <BohSidebarHeader currentAppName={currentAppName} />
      <nav className="sidebar-nav">
        {renderAppNav()}
        <div className="sidebar-section">
          <div className="sidebar-section-label">APPS</div>
          <ul>
            <li>
              <a 
                href="#" 
                className={`nav-link ${currentAppType === 'counter' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/counter/dashboard');
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 00-2-2H5z" />
                </svg>
                <span>Counter</span>
              </a>
            </li>
            <li>
              <a 
                href="#" 
                className={`nav-link ${currentAppType === 'tablez' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/apps/tablez');
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span>Tablez & Chairz</span>
              </a>
            </li>
          </ul>
        </div>
      </nav>
      <div className="sidebar-footer">
        <a 
          href="#" 
          className="nav-link"
          onClick={(e) => {
            e.preventDefault();
            if (currentAppType === 'counter') {
              navigate('/counter/settings');
            } else {
              // BOH settings - placeholder for now
              console.log('BOH Settings');
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" />
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

export default Sidebar;


import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Page } from '../types';
import { COUNTER_NAV_ITEMS } from '../config/nav';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const location = useLocation();
  
  return (
    <aside className="hidden lg:flex flex-col w-64 bg-boh-surface-light dark:bg-boh-surface border-r border-boh-border-light dark:border-boh-border">
      <div className="flex flex-col items-start px-6 py-5">
        <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text">Australis</h1>
        <p className="text-lg text-boh-text-sub-light dark:text-boh-text-sub">Counter</p>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-2">
        {COUNTER_NAV_ITEMS.map((item) => {
          // Remove /counter prefix for matching
          const currentPath = location.pathname.replace(/^\/counter/, '') || '/';
          const isActive = activePage === item.page || 
            currentPath === `/${item.path}` || 
            (item.path === 'dashboard' && (currentPath === '/' || currentPath === '/dashboard'));
          return (
            <Link
              key={item.page}
              to={item.path}
              onClick={() => setActivePage(item.page)}
              className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                isActive
                  ? 'bg-boh-primary text-white'
                  : 'text-boh-text-sub-light dark:text-boh-text-sub hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50'
              }`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
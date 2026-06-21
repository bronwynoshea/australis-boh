import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Page } from '../types';
import { COUNTER_NAV_ITEMS, COUNTER_ROUTES } from '../config/nav';
import { performBohLogout } from '../../../../lib/logout';
import BohHomeButton from '../../../../components/boh/BohHomeButton';

interface CounterSidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
}

const CounterSidebar: React.FC<CounterSidebarProps> = ({ activePage, setActivePage }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  return (
    <aside className="hidden lg:flex flex-col w-64 bg-boh-surface-light dark:bg-boh-surface border-r border-boh-border-light dark:border-boh-border">
      <div className="flex flex-col items-start px-6 py-5">
        <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text mb-2">Australis</h1>
        <p className="text-lg text-boh-text-sub-light dark:text-boh-text-sub mb-2">Counter</p>
        <BohHomeButton 
          showText={true} 
          iconSize="w-4 h-4"
          className="text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text"
        />
      </div>
      <nav className="flex-1 px-4 py-4 space-y-2">
        {COUNTER_NAV_ITEMS.map((item) => {
          // Use absolute path from COUNTER_ROUTES
          const absolutePath = COUNTER_ROUTES[item.routeKey].path;
          const isActive = activePage === item.page || location.pathname === absolutePath;
          return (
            <Link
              key={item.page}
              to={absolutePath}
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
      <div className="px-4 py-4 border-t border-boh-border-light dark:border-boh-border">
        <button
          onClick={() => performBohLogout(navigate)}
          className="flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 text-boh-text-sub-light dark:text-boh-text-sub hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 w-full text-left"
        >
          <svg className="w-5 h-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default CounterSidebar;


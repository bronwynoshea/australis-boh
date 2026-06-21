import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { performBohLogout } from '../../../lib/logout';
import BohHomeButton from '../../../components/boh/BohHomeButton';

interface TablezSidebarProps {
  activePage: 'Board';
  setActivePage: (page: 'Board') => void;
}

const BoardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const TablezSidebar: React.FC<TablezSidebarProps> = ({ activePage, setActivePage }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  return (
    <aside className="hidden lg:flex flex-col w-64 bg-boh-surface-light dark:bg-boh-surface border-r border-boh-border-light dark:border-boh-border">
      <div className="flex flex-col items-start px-6 py-5">
        <h1 className="text-2xl font-bold text-boh-text-light dark:text-boh-text mb-2">Australis</h1>
        <p className="text-lg text-boh-text-sub-light dark:text-boh-text-sub mb-2">Tablez</p>
        <BohHomeButton 
          showText={true} 
          iconSize="w-4 h-4"
          className="text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text"
        />
      </div>
      <nav className="flex-1 px-4 py-4 space-y-2">
        <Link
          to="/"
          onClick={() => setActivePage('Board')}
          className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
            activePage === 'Board' || location.pathname === '/apps/tablez' || location.pathname === '/apps/tablez/'
              ? 'bg-boh-primary text-white'
              : 'text-boh-text-sub-light dark:text-boh-text-sub hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50'
          }`}
        >
          <BoardIcon className="w-5 h-5 mr-3" />
          Board
        </Link>
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

export default TablezSidebar;



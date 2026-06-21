import React from 'react';
import { useNavigate } from 'react-router-dom';
import { performBohLogout } from '../../../lib/logout';

interface TablezBottomNavProps {
  activePage: 'Board' | 'Today' | 'Projects';
  setActivePage: (page: 'Board' | 'Today' | 'Projects') => void;
}

const BoardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const TodayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ProjectsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const TablezBottomNav: React.FC<TablezBottomNavProps> = ({ activePage, setActivePage }) => {
  const navigate = useNavigate();

  const handleNavClick = (page: 'Board' | 'Today' | 'Projects', path: string) => {
    navigate(path);
    setActivePage(page);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-boh-surface-light dark:bg-boh-surface border-t border-boh-border-light dark:border-boh-border flex justify-center items-center lg:hidden z-50">
      <button
        type="button"
        onClick={() => handleNavClick('Board', '/')}
        className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
          activePage === 'Board' ? 'text-boh-primary' : 'text-boh-text-sub-light dark:text-boh-text-sub'
        }`}
      >
        <BoardIcon className="w-6 h-6 mb-1" />
        <span className="text-xs font-medium">Board</span>
      </button>
      <button
        type="button"
        onClick={() => handleNavClick('Today', '/today')}
        className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
          activePage === 'Today' ? 'text-boh-primary' : 'text-boh-text-sub-light dark:text-boh-text-sub'
        }`}
      >
        <TodayIcon className="w-6 h-6 mb-1" />
        <span className="text-xs font-medium">Today</span>
      </button>

      <button
        type="button"
        onClick={() => handleNavClick('Projects', '/projects')}
        className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
          activePage === 'Projects' ? 'text-boh-primary' : 'text-boh-text-sub-light dark:text-boh-text-sub'
        }`}
      >
        <ProjectsIcon className="w-6 h-6 mb-1" />
        <span className="text-xs font-medium">Projects</span>
      </button>
    </nav>
  );
};

export default TablezBottomNav;


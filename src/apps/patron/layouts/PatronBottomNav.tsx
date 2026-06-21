import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface PatronBottomNavProps {
  activePage: 'dashboard' | 'people' | 'organisations' | 'pipeline';
  setActivePage: (page: 'dashboard' | 'people' | 'organisations' | 'pipeline') => void;
}

const PatronBottomNav: React.FC<PatronBottomNavProps> = ({ activePage, setActivePage }) => {
  const location = useLocation();

  const navItems = [
    { page: 'dashboard' as const, label: 'Dashboard', path: '/patron/dashboard', icon: '📊' },
    { page: 'people' as const, label: 'People', path: '/patron/people', icon: '👥' },
    { page: 'organisations' as const, label: 'Orgs', path: '/patron/organisations', icon: '🏢' },
    { page: 'pipeline' as const, label: 'Pipeline', path: '/patron/pipeline', icon: '📋' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-boh-surface-light dark:bg-boh-bg border-t border-boh-border-light dark:border-boh-border lg:hidden z-40">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const isActive = activePage === item.page || location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.page}
              to={item.path}
              onClick={() => setActivePage(item.page)}
              className={`flex flex-col items-center justify-center px-4 py-2 flex-1 ${
                isActive
                  ? 'text-blue-600 dark:text-boh-text'
                  : 'text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-sub'
              }`}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default PatronBottomNav;


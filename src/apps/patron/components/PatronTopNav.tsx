import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface PatronTopNavProps {
  activePage: 'dashboard' | 'people' | 'organisations' | 'pipeline';
}

const PatronTopNav: React.FC<PatronTopNavProps> = ({ activePage }) => {
  const location = useLocation();

  const navItems = [
    { page: 'dashboard' as const, label: 'Dashboard', path: '/patron/dashboard' },
    { page: 'people' as const, label: 'People', path: '/patron/people' },
    { page: 'organisations' as const, label: 'Organisations', path: '/patron/organisations' },
    { page: 'pipeline' as const, label: 'Pipeline', path: '/patron/pipeline' },
  ];

  return (
    <div className="border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8" aria-label="Tabs">
          {navItems.map((item) => {
            const isActive = activePage === item.page || 
                           (item.page === 'people' && location.pathname.startsWith('/patron/people/') && location.pathname !== '/patron/people') ||
                           (item.page === 'organisations' && location.pathname.startsWith('/patron/organisations/') && location.pathname !== '/patron/organisations');
            
            return (
              <Link
                key={item.page}
                to={item.path}
                className={`${isActive ? 'active' : 'inactive'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default PatronTopNav;

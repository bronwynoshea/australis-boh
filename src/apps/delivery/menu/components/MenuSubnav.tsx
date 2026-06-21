import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

interface NavItem {
  key: string;
  label: string;
  to: string;
}

interface MenuSubnavProps {
  items: NavItem[];
  hideNewInitiativeButton?: boolean;
}

const MenuSubnav: React.FC<MenuSubnavProps> = ({ items, hideNewInitiativeButton = false }) => {
  const navigate = useNavigate();

  return (
    <div className="px-6 border-b border-boh-border-light dark:border-boh-border bg-boh-surface-light dark:bg-boh-surface sticky top-0 z-20">
      <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.to === '/menu'}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-boh-text-light dark:text-boh-text'
                    : 'text-boh-text-sub-light dark:text-boh-text-sub hover:text-boh-text-light dark:hover:text-boh-text'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`h-6 w-1 rounded-full transition-all ${
                      isActive ? 'bg-boh-primary' : 'bg-transparent group-hover:bg-boh-primary/60'
                    }`}
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>

        {!hideNewInitiativeButton && (
          <button
            type="button"
            onClick={() => navigate('/menu/initiatives/new')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-boh-primary text-white shadow-sm hover:bg-boh-primary/90 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Initiative
          </button>
        )}
      </div>
    </div>
  );
};

export default MenuSubnav;

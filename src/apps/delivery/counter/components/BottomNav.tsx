import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Page } from '../types';
import { COUNTER_MAIN_NAV_ITEMS, COUNTER_MORE_NAV_ITEMS } from '../config/nav';

interface BottomNavProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activePage, setActivePage }) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavClick = (page: Page, path: string) => {
    // Navigate to the path relative to /counter
    navigate(path);
    setActivePage(page);
    setIsMoreMenuOpen(false);
  };

  return (
    <>
      {isMoreMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden" 
          onClick={() => setIsMoreMenuOpen(false)}
        >
          <div 
            className="absolute bottom-16 left-0 right-0 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-lg shadow-lg">
                {COUNTER_MORE_NAV_ITEMS.map((item) => (
                     <button
                        key={item.page}
                        type="button"
                        onClick={() => handleNavClick(item.page, item.path)}
                        className="flex items-center p-4 text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light/50 dark:hover:bg-boh-bg/50 transition-colors w-full text-left"
                     >
                        <item.icon className="w-6 h-6 mr-4" />
                        <span className="font-medium">{item.label}</span>
                     </button>
                ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-boh-surface-light dark:bg-boh-surface border-t border-boh-border-light dark:border-boh-border flex justify-around items-center lg:hidden z-50">
        {COUNTER_MAIN_NAV_ITEMS.map((item) => (
          <button
            key={item.page}
            type="button"
            onClick={() => handleNavClick(item.page, item.path)}
            className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
              activePage === item.page ? 'text-boh-primary' : 'text-boh-text-sub-light dark:text-boh-text-sub'
            }`}
          >
            <item.icon className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
          className="flex flex-col items-center justify-center w-full h-full transition-colors text-boh-text-sub-light dark:text-boh-text-sub"
        >
          <svg className="w-6 h-6 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
          <span className="text-xs font-medium">More</span>
        </button>
      </nav>
    </>
  );
};

export default BottomNav;
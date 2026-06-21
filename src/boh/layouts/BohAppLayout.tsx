import React from 'react';
import BohSidebar from '../../components/BohSidebar';
import { useSidebar } from '../../contexts/SidebarContext';

interface BohAppLayoutProps {
  children: React.ReactNode;
  // Optional props for app-specific navigation
  tablezActivePage?: 'Board' | 'Today';
  setTablezActivePage?: (page: 'Board' | 'Today') => void;
  // Optional mobile header
  mobileHeader?: React.ReactNode;
  // Optional navigation
  topNav?: React.ReactNode;
  bottomNav?: React.ReactNode;
  // Admin access
  isAdmin?: boolean;
}

const BohAppLayout: React.FC<BohAppLayoutProps> = ({ 
  children,
  tablezActivePage,
  setTablezActivePage,
  mobileHeader,
  topNav,
  bottomNav,
  isAdmin = false
}) => {
  const { isCollapsed } = useSidebar();
  
  return (
    <div className="flex h-screen w-full font-sans bg-boh-bg-light dark:bg-boh-bg text-boh-text-light dark:text-boh-text">
      <BohSidebar 
        tablezActivePage={tablezActivePage}
        setTablezActivePage={setTablezActivePage}
        isAdmin={isAdmin}
      />
      <div className={`flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300 ${
        isCollapsed ? 'lg:ml-16' : 'lg:ml-[260px]'
      }`}>
        {mobileHeader}
        {topNav}
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto boh-hide-scrollbars lg:boh-show-scrollbars pb-16 lg:pb-0">
          {children}
        </main>
        {bottomNav}
      </div>
    </div>
  );
};

export default BohAppLayout;


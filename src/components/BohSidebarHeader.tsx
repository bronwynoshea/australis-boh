import React from 'react';
import { useNavigate } from 'react-router-dom';

interface BohSidebarHeaderProps {
  currentAppName: string | null;
}

const BohSidebarHeader: React.FC<BohSidebarHeaderProps> = ({ currentAppName }) => {
  const navigate = useNavigate();
  const displayName = currentAppName ?? null;
  
  const handleLogoClick = () => {
    navigate('/boh');
  };
  
  return (
    <div className="px-4 pt-4 pb-3">
      <button
        onClick={handleLogoClick}
        className="logo-main text-sm md:text-base font-semibold tracking-tight text-boh-text-light dark:text-boh-text hover:text-boh-accent transition-colors text-left"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        JOBZ CAFE®
      </button>
      {displayName && (
        <div className="text-xs md:text-sm font-medium text-boh-text-sub-light dark:text-boh-text-sub mt-0.5">
          {displayName}
        </div>
      )}
    </div>
  );
};

export default BohSidebarHeader;


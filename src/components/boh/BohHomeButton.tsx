import React from 'react';
import { useNavigate } from 'react-router-dom';

interface BohHomeButtonProps {
  className?: string;
  showText?: boolean;
  iconSize?: string;
}

const BohHomeButton: React.FC<BohHomeButtonProps> = ({ 
  className = '', 
  showText = false,
  iconSize = 'w-6 h-6'
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/boh');
  };

  const icon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className={iconSize}
    >
      {/* 2x2 grid of squares */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  );

  if (showText) {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 text-xs text-boh-text-sub-light dark:text-boh-text-sub dark:text-boh-text-light dark:text-boh-text dark:hover:bg-boh-surface transition-colors ${className}`}
        aria-label="Back to Back of House"
      >
        {icon}
        Back of House
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={`boh-home-button ${className}`}
      aria-label="Back to Back of House dashboard"
      title="Back to Back of House"
    >
      {icon}
    </button>
  );
};

export default BohHomeButton;


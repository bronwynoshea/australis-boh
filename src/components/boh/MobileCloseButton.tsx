import React from 'react';
import { useNavigate } from 'react-router-dom';

const MobileCloseButton: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/boh');
  };

  return (
    <button
      onClick={handleClick}
      className="md:hidden absolute top-3 right-3 z-50 rounded-full bg-boh-surface-light dark:bg-boh-surface/90 border border-boh-border-light dark:border-boh-border-light shadow-lg backdrop-blur-sm p-1.5 hover:bg-boh-surface-light dark:hover:bg-boh-surface transition-colors"
      aria-label="Close"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5 text-boh-text-light dark:text-boh-text"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  );
};

export default MobileCloseButton;


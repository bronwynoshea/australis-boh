import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Section } from '../types';
import { performBohLogout } from '../lib/logout';

interface MobileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: Section) => void;
}

const MobileSheet: React.FC<MobileSheetProps> = ({ isOpen, onClose, onNavigate }) => {
  const navigate = useNavigate();
  if (!isOpen) return null;

  return (
    <div 
      className={`mobile-sheet-backdrop ${isOpen ? 'visible' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest('a')) {
          onClose();
        }
      }}
    >
      <div className="mobile-sheet-content">
        <a 
          href="#" 
          className="nav-link"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('dashboard-section');
            onClose();
          }}
        >
          Dashboard
        </a>
        <a 
          href="#" 
          className="nav-link"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('team-access-section');
            onClose();
          }}
        >
          Team & Access
        </a>
        <a 
          href="#" 
          className="nav-link"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('releases-section');
            onClose();
          }}
        >
          Releases
        </a>
        <a 
          href="#" 
          className="nav-link"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('tablez-section');
            onClose();
          }}
        >
          Tablez
        </a>
        <a
          href="#"
          className="nav-link"
          onClick={(e) => {
            e.preventDefault();
            navigate('/boh/settings');
            onClose();
          }}
        >
          Settings
        </a>
        <a href="#">Support</a>
        <a 
          href="#" 
          className="nav-link"
          onClick={(e) => {
            e.preventDefault();
            performBohLogout(navigate);
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5 mr-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </a>
        <a 
          href="#" 
          className="mobile-sheet-cancel"
          onClick={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          Cancel
        </a>
      </div>
    </div>
  );
};

export default MobileSheet;


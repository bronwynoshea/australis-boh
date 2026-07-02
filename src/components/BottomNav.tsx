import React from 'react';
import type { Section } from '../types';

interface BottomNavProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onMoreClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeSection, onNavigate, onMoreClick }) => {
  return (
    <nav className="bottom-nav">
      <a 
        href="/counter" 
        className="bottom-nav-item"
        onClick={(e) => {
          e.preventDefault();
          window.location.href = '/counter';
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 00-2-2H5z" />
        </svg>
        <span>Counter</span>
      </a>
      <a 
        href="#" 
        className="bottom-nav-item"
        onClick={(e) => {
          e.preventDefault();
          onMoreClick();
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span>More</span>
      </a>
    </nav>
  );
};

export default BottomNav;

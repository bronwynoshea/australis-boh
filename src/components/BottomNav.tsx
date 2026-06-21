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
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <span>Studio</span>
      </a>
      <a 
        href="#" 
        className="bottom-nav-item"
        onClick={(e) => {
          e.preventDefault();
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span>Talent</span>
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


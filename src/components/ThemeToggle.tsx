import React from 'react';
import type { Theme } from '../types';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onToggle }) => {
  return (
    <label className="theme-switch">
      <input 
        type="checkbox" 
        checked={theme === 'dark'} 
        onChange={onToggle}
      />
      <span className="theme-slider"></span>
    </label>
  );
};

export default ThemeToggle;



import React from 'react';
import type { Theme } from '../types';

interface ThemeToggleProps {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, toggleTheme }) => {
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`relative inline-flex items-center h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2 ${
        isDark ? 'bg-boh-primary' : 'bg-boh-border-light dark:bg-boh-border'
      }`}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="sr-only">Use {isDark ? "light" : "dark"} theme</span>
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 transform rounded-full bg-boh-surface-light dark:bg-boh-surface shadow-lg ring-0 transition duration-200 ease-in-out ${
          isDark ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

export default ThemeToggle;

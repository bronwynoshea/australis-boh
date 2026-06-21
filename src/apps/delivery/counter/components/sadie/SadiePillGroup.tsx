// Universal pill group component for Sadie

import React from 'react';
import type { SadiePillOption } from './SadieTypes';

interface SadiePillGroupProps {
  options: SadiePillOption[];
  value: string | null;
  onChange: (value: string) => void;
  className?: string;
}

const SadiePillGroup: React.FC<SadiePillGroupProps> = ({
  options,
  value,
  onChange,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              rounded-full px-4 py-2 text-sm font-medium transition-colors
              focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2
              ${isSelected
                ? 'bg-boh-primary text-white'
                : 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text border border-boh-border-light dark:border-boh-border hover:opacity-80'
              }
            `}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SadiePillGroup;


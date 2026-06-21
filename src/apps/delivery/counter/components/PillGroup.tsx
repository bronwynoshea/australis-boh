import React from 'react';

export interface PillOption {
  value: string;
  label: string;
  description?: string;
}

interface PillGroupProps {
  name: string;
  options: PillOption[];
  value: string | null | string[] | Set<string>; // Support single value, array, or Set
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  multiSelect?: boolean; // If true, allows multiple selections
}

const PillGroup: React.FC<PillGroupProps> = ({ 
  name, 
  options, 
  value, 
  onChange, 
  ariaLabel,
  className = '',
  multiSelect = false
}) => {
  // Normalize value to check if selected
  const isSelected = (optValue: string): boolean => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.includes(optValue);
    if (value instanceof Set) return value.has(optValue);
    return value === optValue;
  };

  return (
    <div 
      className={`flex flex-wrap gap-2 ${className}`}
      role={multiSelect ? "group" : "radiogroup"}
      aria-label={ariaLabel || `Select ${name}`}
    >
      {options.map((opt) => {
        const selected = isSelected(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-boh-primary focus:ring-offset-2 ${
              selected
                ? 'bg-boh-primary/10 text-boh-primary border border-boh-primary'
                : 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-sub-light dark:text-boh-text-sub border border-boh-border-light dark:border-boh-border hover:border-boh-primary hover:text-boh-primary'
            }`}
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default PillGroup;


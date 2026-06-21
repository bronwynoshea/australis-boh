import React, { useState, useRef, useEffect } from 'react';

interface PatronSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

const PatronSelect: React.FC<PatronSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const selectRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);
  const displayValue = selectedOption?.label || placeholder;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex(prev => 
            prev < options.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : options.length - 1
          );
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (highlightedIndex >= 0) {
            onChange(options[highlightedIndex].value);
            setIsOpen(false);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, highlightedIndex, options, onChange]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-boh-border-light dark:border-boh-border rounded-md bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text focus:outline-none focus:ring-2 focus:ring-boh-primary flex items-center justify-between hover:bg-boh-bg-light dark:hover:bg-boh-surface transition-colors"
      >
        <span className={value ? '' : 'text-boh-text-sub-light dark:text-boh-text-sub'}>
          {displayValue}
        </span>
        <svg
          className={`w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-boh-surface-light dark:bg-boh-surface border border-boh-border-light dark:border-boh-border rounded-md shadow-lg max-h-60 overflow-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-boh-text-sub-light dark:text-boh-text-sub text-sm">
              No options available
            </div>
          ) : (
            options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-boh-bg-light dark:hover:bg-boh-bg focus:outline-none focus:bg-boh-surface-light dark:focus:bg-boh-surface transition-colors ${
                  option.value === value
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-boh-text-sub font-medium'
                    : 'text-boh-text-light dark:text-boh-text'
                } ${
                  index === highlightedIndex
                    ? 'bg-boh-surface-light dark:bg-boh-surface dark:bg-boh-surface'
                    : ''
                }`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default PatronSelect;

import React, { useState, useRef, useEffect } from 'react';

export interface BohSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface BohSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: BohSelectOption[];
  label?: string;
  helperText?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * Fully Custom Select Dropdown Component with BOH Theme Support
 * 
 * Features:
 * - NO native select element - fully custom styled div-based dropdown
 * - Complete visual control over dropdown menu
 * - Automatic dark/light mode theming
 * - Keyboard navigation support (Enter, Escape, Arrow keys)
 * - Click outside to close
 * 
 * Usage:
 * <BohSelect
 *   label="Style Variant"
 *   value={variant}
 *   onChange={(value) => setVariant(value)}
 *   options={[
 *     { value: 'primary', label: 'Primary' },
 *     { value: 'secondary', label: 'Secondary' },
 *   ]}
 * />
 */
export const BohSelect: React.FC<BohSelectProps> = ({
  value,
  onChange,
  options,
  label,
  helperText,
  error,
  placeholder = 'Select an option...',
  disabled = false,
  required = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const estimatedMenuHeight = Math.min(240, Math.max(44, options.length * 40 + 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    setOpenUp(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow);
  }, [isOpen, options.length]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          const option = options[highlightedIndex];
          if (!option.disabled) {
            onChange(option.value);
            setIsOpen(false);
          }
        } else {
          setIsOpen(!isOpen);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        }
        setHighlightedIndex(prev => {
          const next = prev < options.length - 1 ? prev + 1 : 0;
          // Skip disabled options
          if (options[next]?.disabled) {
            return next < options.length - 1 ? next + 1 : 0;
          }
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        }
        setHighlightedIndex(prev => {
          const next = prev > 0 ? prev - 1 : options.length - 1;
          // Skip disabled options
          if (options[next]?.disabled) {
            return next > 0 ? next - 1 : options.length - 1;
          }
          return next;
        });
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (option: BohSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className={`space-y-1 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-boh-text-light dark:text-boh-text">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`
            w-full flex items-center justify-between
            px-3 h-11
            rounded-xl border
            text-sm text-left
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-boh-primary/30
            ${disabled 
              ? 'bg-boh-surface-light/50 dark:bg-boh-surface/50 text-boh-text-sub-light/50 dark:text-boh-text-sub/50 cursor-not-allowed' 
              : 'bg-boh-surface-light dark:bg-boh-surface text-boh-text-light dark:text-boh-text hover:border-boh-primary/50 cursor-pointer'
            }
            ${error 
              ? 'border-red-500 focus:ring-red-500/30' 
              : 'border-boh-border-light dark:border-boh-border'
            }
            ${isOpen && !error ? 'ring-2 ring-boh-primary/30 border-boh-primary' : ''}
          `}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={!selectedOption ? 'text-boh-text-sub-light dark:text-boh-text-sub' : ''}>
            {selectedOption?.label || placeholder}
          </span>
          
          {/* Custom Chevron */}
          <svg
            className={`w-4 h-4 text-boh-text-sub-light dark:text-boh-text-sub transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 20 20"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8l5 5 5-5" />
          </svg>
        </button>

        {/* Custom Dropdown Menu */}
        {isOpen && (
          <div
            className={`absolute z-50 w-full rounded-xl border border-boh-border-light bg-boh-surface-light shadow-lg dark:border-boh-border dark:bg-boh-surface max-h-60 overflow-y-auto ${
              openUp ? 'bottom-full mb-1' : 'mt-1'
            }`}
            role="listbox"
          >
            <div className="py-1">
              {options.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                    option.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  } ${
                    option.value === value
                      ? 'bg-boh-primary text-white'
                      : index === highlightedIndex && !option.disabled
                        ? 'bg-boh-primary/10 dark:bg-boh-primary/20'
                        : 'text-boh-text-light dark:text-boh-text hover:bg-boh-bg-light dark:hover:bg-boh-bg'
                  }`}
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {helperText && !error && (
        <p className="text-xs text-boh-text-sub-light dark:text-boh-text-sub">
          {helperText}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

export default BohSelect;
